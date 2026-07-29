/**
 * Registra un hostname para un sitio (§12.3).
 *
 * Existe como script y no como SQL suelto por una razón concreta: el hostname
 * **debe** pasar por `normalizeHostname()` de `@nitro-web/shared`, que es la
 * única normalización autorizada (ADR 0005). Un espacio, una mayúscula o un
 * punto final producen una fila que nunca coincide con lo que busca el
 * renderer, y el síntoma es una landing que "a veces" da 404.
 *
 * No toca Vercel. Añadir el dominio al proyecto y verificar su DNS es la otra
 * mitad (R6); esto solo enseña a la base qué sitio corresponde a qué hostname.
 *
 * Uso:
 *   pnpm db:seed-domain -- --hostname=mi-landing.ejemplo.com
 *   pnpm db:seed-domain -- --hostname=alterna.ejemplo.com --no-canonical
 */

import { parseArgs } from 'node:util';

import { createSecretClient, type Json, type NitroWebClient } from '@nitro-web/db';
import { normalizeHostname } from '@nitro-web/shared';

try {
  process.loadEnvFile('.env.local');
} catch {
  // Sin .env.local se sigue: en CI las variables llegan por el entorno.
}

const { values } = parseArgs({
  args: argumentos(),
  options: {
    tenant: { type: 'string', default: 'coffee-maker-pro' },
    site: { type: 'string', default: 'Cafetera Espresso' },
    hostname: { type: 'string' },
    'no-canonical': { type: 'boolean', default: false },
    subdomain: { type: 'boolean', default: false },
  },
});

main().catch((error: unknown) => {
  fallar(error instanceof Error ? error.message : String(error));
});

async function main(): Promise<void> {
  const crudo = values.hostname as string | undefined;
  if (!crudo) fallar('Falta --hostname=<host>.');

  const hostname = normalizeHostname(crudo);
  if (!hostname) fallar(`'${crudo}' no es un hostname válido tras normalizar.`);
  if (hostname !== crudo) console.log(`· Normalizado: '${crudo}' → '${hostname}'`);

  const supabase = createSecretClient();
  const sitio = await cargarSitio(supabase, values.tenant as string, values.site as string);

  const esCanonico = !(values['no-canonical'] as boolean);

  // El índice único parcial ya lo impide, pero su error no explica nada. Un
  // hostname apuntando a dos sitios sirve la landing de un cliente bajo el
  // dominio de otro: el peor fallo posible del producto.
  const { data: enUso } = await supabase
    .from('domains')
    .select('id, site_id')
    .eq('hostname', hostname)
    .neq('status', 'removed')
    .maybeSingle();

  if (enUso && enUso.site_id !== sitio.id) {
    fallar(`'${hostname}' ya está asignado a otro sitio (${enUso.site_id}).`);
  }
  if (enUso) {
    console.log(`· '${hostname}' ya estaba registrado para este sitio: no se toca.`);
    return;
  }

  const { data, error } = await supabase
    .from('domains')
    .insert({
      tenant_id: sitio.tenantId,
      site_id: sitio.id,
      hostname,
      // `active` porque este script se usa con hostnames que ya resuelven. Un
      // dominio propio de cliente nace en `pending` y lo mueve la verificación
      // DNS de R6, no una inserción manual.
      status: 'active',
      is_canonical: esCanonico,
      is_subdomain: values.subdomain as boolean,
      verified_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) fallar(`No se pudo registrar el dominio: ${error?.message ?? 'sin datos'}`);

  console.log(`✓ domains: ${hostname} → ${sitio.id} (${esCanonico ? 'canónico' : 'alterno'})`);

  await auditar(supabase, {
    tenantId: sitio.tenantId,
    entityId: data.id,
    payload: {
      runbook: 'R6',
      hostname,
      site_id: sitio.id,
      is_canonical: esCanonico,
    },
  });

  console.log(`\n· La landing responde en https://${hostname}`);
}

async function cargarSitio(
  supabase: NitroWebClient,
  tenantSlug: string,
  nombreSitio: string,
): Promise<{ id: string; tenantId: string }> {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', tenantSlug)
    .maybeSingle();

  if (!tenant) fallar(`No existe el tenant '${tenantSlug}'.`);

  const { data: sitio } = await supabase
    .from('sites')
    .select('id, status')
    .eq('tenant_id', tenant.id)
    .eq('name', nombreSitio)
    .maybeSingle();

  if (!sitio) fallar(`El tenant '${tenantSlug}' no tiene un sitio llamado '${nombreSitio}'.`);

  if (sitio.status !== 'published') {
    console.log(`· Aviso: el sitio está en '${sitio.status}'. El dominio quedará listo,`);
    console.log('  pero el renderer devolverá 404 hasta que se publique.');
  }

  console.log(`✓ Sitio: ${nombreSitio} (${sitio.id})`);
  return { id: sitio.id, tenantId: tenant.id };
}

async function auditar(
  supabase: NitroWebClient,
  evento: { tenantId: string; entityId: string; payload: Record<string, unknown> },
): Promise<void> {
  const { error } = await supabase.from('audit_log').insert({
    tenant_id: evento.tenantId,
    action: 'domain.registered',
    entity_type: 'domain',
    entity_id: evento.entityId,
    payload_json: JSON.parse(JSON.stringify(evento.payload)) as Json,
  });

  if (error) console.warn(`! No se pudo registrar en audit_log: ${error.message}`);
}

function argumentos(): string[] {
  const args = process.argv.slice(2);
  return args[0] === '--' ? args.slice(1) : args;
}

function fallar(mensaje: string): never {
  console.error(`\nERROR: ${mensaje}`);
  process.exit(1);
}
