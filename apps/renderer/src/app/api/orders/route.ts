import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSecretClient } from '@nitro-web/db';
import { extractAttribution, normalizeEmail, normalizePhone } from '@nitro-web/shared';

/**
 * Endpoint público de creación de pedidos.
 *
 * Es la única superficie de escritura expuesta a internet anónimo, así que
 * concentra todas las defensas del §14.2:
 *
 *   - Validación de schema en servidor (no se confía en el formulario)
 *   - Honeypot
 *   - Rate limiting por IP
 *   - Idempotency key
 *   - **El total lo calcula `create_public_order()`**, no esta ruta ni el cliente
 *
 * Nótese lo que NO acepta el schema: ningún campo de precio, total o descuento.
 * No es que se ignoren — es que no existen en el contrato de entrada.
 */

const orderInputSchema = z.object({
  site_id: z.guid(),
  customer_name: z.string().trim().min(3, 'Escribe tu nombre completo').max(120),
  customer_phone: z.string().trim().min(7, 'Escribe un teléfono válido').max(30),
  customer_email: z.string().trim().max(160).nullish(),
  city: z.string().trim().min(2, 'Escribe tu ciudad').max(80),
  address: z.string().trim().min(5, 'Escribe tu dirección completa').max(250),
  delivery_notes: z.string().trim().max(500).nullish(),
  quantity: z.number().int().min(1).max(20).default(1),
  website: z.string().max(200).optional(),
  attribution: z.record(z.string(), z.string()).default({}),
  idempotency_key: z.guid().optional(),
});

/**
 * Rate limiting en memoria.
 *
 * Acota ráfagas desde una misma IP. Es deliberadamente simple: en Vercel cada
 * instancia tiene su propio mapa, así que no es un límite global. Para el piloto
 * basta —el objetivo es frenar un script, no un ataque distribuido— y la
 * idempotencia cubre los duplicados legítimos. Un límite compartido de verdad
 * requiere almacenamiento externo y está anotado en DECISIONES-PENDIENTES.
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  requestLog.set(ip, recent);

  // Poda para que el mapa no crezca sin límite en una instancia de larga vida.
  if (requestLog.size > 5000) {
    for (const [key, times] of requestLog) {
      if (times.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) requestLog.delete(key);
    }
  }

  return recent.length > RATE_LIMIT_MAX;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconocida';

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.' },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
  }

  const parsed = orderInputSchema.safeParse(body);
  if (!parsed.success) {
    // Se devuelve el primer mensaje, no el detalle completo: el formulario ya
    // valida en el cliente, así que un fallo aquí es o un bot o una manipulación.
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Revisa los datos del formulario' },
      { status: 400 },
    );
  }

  const input = parsed.data;

  // Honeypot: un humano nunca ve este campo. Se responde 200 a propósito, para
  // que el bot crea que funcionó y no reintente con otra estrategia.
  if (input.website && input.website.trim() !== '') {
    return NextResponse.json({ order_number: 'NW-000000' }, { status: 200 });
  }

  const phone = normalizePhone(input.customer_phone);
  if (!phone) {
    return NextResponse.json(
      { error: 'El teléfono no parece válido. Revisa el número.' },
      { status: 400 },
    );
  }

  const attribution = extractAttribution({
    searchParams: input.attribution,
    referrer: input.attribution.referrer ?? null,
    landingUrl: input.attribution.landing_url ?? null,
  });

  const supabase = createSecretClient();

  // Toda la lógica sensible vive en la función de base de datos: precio,
  // inventario, consecutivo, snapshot de oferta y agregado diario, en una sola
  // transacción. Esta ruta solo valida la entrada y traduce el resultado.
  const { data, error } = await supabase.rpc('create_public_order', {
    p_site_id: input.site_id,
    p_customer_name: input.customer_name,
    p_customer_phone: phone,
    p_city: input.city,
    p_address: input.address,
    p_quantity: input.quantity,
    // `undefined` y no `null`: omitir el argumento deja que aplique el DEFAULT
    // de la función, que es exactamente el valor que se quiere.
    p_customer_email: normalizeEmail(input.customer_email ?? null) ?? undefined,
    p_delivery_notes: input.delivery_notes ?? undefined,
    p_payment_method: 'cod',
    p_attribution: attribution,
    p_idempotency_key: input.idempotency_key ?? undefined,
  });

  if (error) {
    // Los mensajes de la base pueden revelar estructura interna; se traducen a
    // algo que el comprador pueda entender y accionar.
    console.error('[orders] fallo al crear pedido', { siteId: input.site_id, error });

    const message = error.message.includes('no está publicado')
      ? 'Esta oferta ya no está disponible.'
      : error.message.includes('Inventario')
        ? 'Nos quedamos sin unidades disponibles.'
        : 'No pudimos registrar tu pedido. Intenta de nuevo en un momento.';

    return NextResponse.json({ error: message }, { status: 409 });
  }

  const result = Array.isArray(data) ? data[0] : data;

  return NextResponse.json(
    {
      order_number: result?.order_number,
      total_amount: result?.total_amount,
      currency: result?.currency,
    },
    { status: 201 },
  );
}
