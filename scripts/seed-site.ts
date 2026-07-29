/**
 * Crea el primer sitio de un tenant a partir de una plantilla ya sembrada.
 *
 * Deja listo lo que el corte vertical necesita antes de poder publicar:
 * la fila en `sites`, su borrador inicializado con el `default_content` de la
 * versión, y la oferta con el precio real.
 *
 * Lo que NO hace, a propósito:
 *
 *   - **No crea dominios.** El dominio operativo sigue sin decidirse (§25.1) y
 *     un hostname mal elegido queda en un índice único que hay que limpiar a
 *     mano. Mientras tanto el sitio se ve por su token de preview.
 *   - **No publica.** Publicar exige imágenes, y el `default_content` no trae
 *     ninguna a propósito: nadie debe publicar con las fotos de otro producto.
 *   - **No inventa el precio.** `--price` es obligatorio. Un precio por defecto
 *     en un script es un número que termina cobrándosele a alguien.
 *
 * Uso:
 *   pnpm db:seed-site -- --price=490000
 *   pnpm db:seed-site -- --price=490000 --shipping=0 --compare-at=690000
 */

import { parseArgs } from 'node:util';

import { createSecretClient, type Json, type NitroWebClient } from '@nitro-web/db';
import {
  formatMoney,
  isSupportedCurrency,
  savingsPercent,
  type Currency,
} from '@nitro-web/shared';

try {
  process.loadEnvFile('.env.local');
} catch {
  // Sin .env.local se sigue: en CI las variables llegan por el entorno.
}

const { values } = parseArgs({
  args: argumentos(),
  options: {
    tenant: { type: 'string', default: 'coffee-maker-pro' },
    template: { type: 'string', default: 'coffee-maker' },
    name: { type: 'string', default: 'Cafetera Espresso' },
    title: { type: 'string' },
    price: { type: 'string' },
    shipping: { type: 'string', default: '0' },
    'compare-at': { type: 'string' },
  },
});

main().catch((error: unknown) => {
  fallar(error instanceof Error ? error.message : String(error));
});

async function main(): Promise<void> {
  const precio = leerMonto(values.price, '--price');
  const envio = leerMonto(values.shipping, '--shipping') ?? 0;
  const precioAnterior = leerMonto(values['compare-at'], '--compare-at');

  if (precio === undefined) {
    fallar('Falta --price. El precio va en la unidad mínima de la moneda: 490000, no 4900.00');
  }

  // Lo impide un CHECK en la tabla, pero el mensaje de Postgres no explica por
  // qué: un "precio anterior" menor al actual mostraría un descuento negativo.
  if (precioAnterior !== undefined && precioAnterior <= precio) {
    fallar(
      `--compare-at (${precioAnterior}) debe ser mayor que --price (${precio}): ` +
        'un precio anterior más bajo no es un ahorro.',
    );
  }

  const supabase = createSecretClient();

  const tenant = await cargarTenant(supabase, values.tenant as string);
  const version = await cargarVersion(supabase, values.template as string);

  const sitio = await crearSitio(supabase, {
    tenantId: tenant.id,
    templateVersionId: version.id,
    nombre: values.name as string,
    defaultContent: version.default_content,
  });

  await upsertOferta(supabase, {
    siteId: sitio.id,
    tenantId: tenant.id,
    titulo: (values.title as string | undefined) ?? (values.name as string),
    precio,
    precioAnterior,
    envio,
    moneda: tenant.currency,
  });

  resumen(sitio, { precio, precioAnterior, envio, moneda: tenant.currency });
}

async function cargarTenant(
  supabase: NitroWebClient,
  slug: string,
): Promise<{ id: string; name: string; currency: Currency }> {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, currency, status')
    .eq('slug', slug)
    .maybeSingle();

  if (error) fallar(`No se pudo leer 'tenants': ${error.message}`);
  if (!data) fallar(`No existe el tenant '${slug}'. Créalo con el runbook R3.`);
  if (data.status !== 'active') fallar(`El tenant '${slug}' está en estado '${data.status}'.`);

  // `currency` es `text` en la base y `Currency` en el código. Se estrecha aquí,
  // en el único punto donde el valor entra al script.
  if (!isSupportedCurrency(data.currency)) {
    fallar(`El tenant usa la moneda '${data.currency}', que no está soportada.`);
  }

  console.log(`✓ Tenant: ${data.name} (${slug})`);
  return { id: data.id, name: data.name, currency: data.currency };
}

/**
 * Toma la versión más reciente de la plantilla, sin filtrar por estado.
 *
 * Deliberado: el orden de R4 es sembrar en `development`, crear el sitio, verlo
 * en preview y publicar después. Exigir aquí una versión publicada haría
 * imposible ese orden.
 */
async function cargarVersion(
  supabase: NitroWebClient,
  templateKey: string,
): Promise<{ id: string; version: string; status: string; default_content: Json }> {
  const { data, error } = await supabase
    .from('template_versions')
    .select('id, version, status, default_content, templates!inner(template_key)')
    .eq('templates.template_key', templateKey)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) fallar(`No se pudo leer 'template_versions': ${error.message}`);
  if (!data) {
    fallar(`La plantilla '${templateKey}' no está sembrada. Corre: pnpm db:seed-template`);
  }

  console.log(`✓ Plantilla: ${templateKey} ${data.version} (${data.status})`);
  return {
    id: data.id,
    version: data.version,
    status: data.status,
    default_content: data.default_content,
  };
}

/**
 * Crea el sitio y su borrador.
 *
 * Si el sitio ya existe **no se toca el borrador**: puede tener ediciones
 * reales, y perderlas por volver a correr un script sería el peor resultado
 * posible de una operación que se supone segura de repetir.
 */
async function crearSitio(
  supabase: NitroWebClient,
  params: {
    tenantId: string;
    templateVersionId: string;
    nombre: string;
    defaultContent: Json;
  },
): Promise<{ id: string; preview_token: string; nuevo: boolean }> {
  const { data: existente } = await supabase
    .from('sites')
    .select('id, preview_token')
    .eq('tenant_id', params.tenantId)
    .eq('name', params.nombre)
    .maybeSingle();

  if (existente) {
    console.log(`· sites: '${params.nombre}' ya existe → ${existente.id} (borrador intacto)`);
    return { id: existente.id, preview_token: existente.preview_token, nuevo: false };
  }

  const { data: sitio, error } = await supabase
    .from('sites')
    .insert({
      tenant_id: params.tenantId,
      template_version_id: params.templateVersionId,
      name: params.nombre,
      status: 'draft',
    })
    .select('id, preview_token')
    .single();

  if (error || !sitio) fallar(`No se pudo crear el sitio: ${error?.message ?? 'sin datos'}`);

  const { error: errorBorrador } = await supabase.from('site_content_drafts').insert({
    site_id: sitio.id,
    tenant_id: params.tenantId,
    content_json: params.defaultContent,
  });

  if (errorBorrador) {
    fallar(
      `El sitio se creó (${sitio.id}) pero su borrador no: ${errorBorrador.message}. ` +
        'Bórralo y vuelve a correr el script.',
    );
  }

  console.log(`✓ sites: '${params.nombre}' → ${sitio.id}`);
  console.log('✓ site_content_drafts: inicializado desde default_content');

  await registrarEnAuditoria(supabase, {
    tenantId: params.tenantId,
    action: 'site.created',
    entityId: sitio.id,
    payload: {
      runbook: 'R4',
      name: params.nombre,
      template_version_id: params.templateVersionId,
    },
  });

  return { id: sitio.id, preview_token: sitio.preview_token, nuevo: true };
}

async function upsertOferta(
  supabase: NitroWebClient,
  params: {
    siteId: string;
    tenantId: string;
    titulo: string;
    precio: number;
    precioAnterior: number | undefined;
    envio: number;
    moneda: Currency;
  },
): Promise<void> {
  const { data, error } = await supabase
    .from('offers')
    .upsert(
      {
        site_id: params.siteId,
        tenant_id: params.tenantId,
        title: params.titulo,
        price_amount: params.precio,
        compare_at_amount: params.precioAnterior ?? null,
        shipping_amount: params.envio,
        currency: params.moneda,
        is_active: true,
        payment_methods: ['cod'],
      },
      { onConflict: 'site_id' },
    )
    .select('id')
    .single();

  if (error || !data) fallar(`No se pudo escribir la oferta: ${error?.message ?? 'sin datos'}`);

  console.log(`✓ offers: ${formatMoney(params.precio, params.moneda)} → ${data.id}`);

  await registrarEnAuditoria(supabase, {
    tenantId: params.tenantId,
    action: 'offer.upserted',
    entityId: data.id,
    payload: {
      runbook: 'R4',
      site_id: params.siteId,
      price_amount: params.precio,
      compare_at_amount: params.precioAnterior ?? null,
      shipping_amount: params.envio,
      currency: params.moneda,
    },
  });
}

function resumen(
  sitio: { id: string; preview_token: string },
  oferta: { precio: number; precioAnterior: number | undefined; envio: number; moneda: Currency },
): void {
  const ahorro =
    oferta.precioAnterior !== undefined
      ? savingsPercent(oferta.precioAnterior, oferta.precio)
      : null;

  console.log('\n── Sitio listo para editar ──');
  console.log(`  site_id       ${sitio.id}`);
  console.log(`  preview       /preview/${sitio.preview_token}`);
  console.log(`  precio        ${formatMoney(oferta.precio, oferta.moneda)}`);
  if (ahorro !== null) console.log(`  ahorro        ${ahorro}%`);
  console.log(`  envío         ${formatMoney(oferta.envio, oferta.moneda)}`);

  console.log('\n· Todavía NO es publicable: faltan las imágenes de hero_mobile y');
  console.log('  hero_desktop. La validación en modo `publish` las exige, y el');
  console.log('  contenido por defecto no trae ninguna a propósito.');
  console.log('\n· Para verlo en local:');
  console.log(`    pnpm dev:renderer  →  http://localhost:3000/preview/${sitio.preview_token}`);
}

async function registrarEnAuditoria(
  supabase: NitroWebClient,
  evento: {
    tenantId: string;
    action: string;
    entityId: string;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.from('audit_log').insert({
    tenant_id: evento.tenantId,
    action: evento.action,
    entity_type: evento.action.split('.')[0] ?? null,
    entity_id: evento.entityId,
    payload_json: JSON.parse(JSON.stringify(evento.payload)) as Json,
  });

  if (error) console.warn(`! No se pudo registrar en audit_log: ${error.message}`);
}

/**
 * El dinero es siempre un entero en la unidad mínima de la moneda.
 *
 * Un `parseInt` aceptaría '4900.50' y guardaría 4900, perdiendo medio peso sin
 * avisar. Aquí un valor con decimales es un error, no un redondeo.
 */
function leerMonto(valor: string | undefined, bandera: string): number | undefined {
  if (valor === undefined) return undefined;

  if (!/^\d+$/.test(valor)) {
    fallar(`${bandera}='${valor}' debe ser un entero en la unidad mínima de la moneda.`);
  }

  const monto = Number(valor);
  if (!Number.isSafeInteger(monto)) fallar(`${bandera}='${valor}' está fuera de rango.`);

  return monto;
}

/**
 * Argumentos del script, sin el `--` separador.
 *
 * `pnpm run x -- --flag` reenvía el `--` tal cual, y `parseArgs` lo interpreta
 * como "aquí terminan las opciones", así que `--flag` llegaría como posicional.
 * Descartarlo hace que la forma documentada y la invocación directa con tsx se
 * comporten igual.
 */
function argumentos(): string[] {
  const args = process.argv.slice(2);
  return args[0] === '--' ? args.slice(1) : args;
}

function fallar(mensaje: string): never {
  console.error(`\nERROR: ${mensaje}`);
  process.exit(1);
}
