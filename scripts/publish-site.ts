/**
 * Publica un sitio (runbook R4, paso 5, y R9).
 *
 * Usa un cliente **con sesión del usuario**, no el secreto. No es una
 * formalidad: `publishSite()` se apoya en RLS para verificar que quien publica
 * pertenece al tenant y tiene rol de escritura, y con la clave secreta esa
 * comprobación se saltaría por completo. Publicar con `service_role` haría que
 * la operación funcionara siempre, incluso cuando no debería.
 *
 * Mientras no exista `apps/dashboard`, la sesión se obtiene canjeando un magic
 * link generado por la Admin API. `generate_link` **no envía correo**: devuelve
 * el token para canjearlo aquí mismo.
 *
 * Uso:
 *   pnpm db:publish-site -- --as=owner@ejemplo.com
 *   pnpm db:publish-site -- --as=owner@ejemplo.com --reviewed-by="Juan Arango"
 */

import { parseArgs } from 'node:util';

import {
  createSecretClient,
  createUserClient,
  publishSite,
  type Json,
  type NitroWebClient,
} from '@nitro-web/db';

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
    as: { type: 'string' },
    'reviewed-by': { type: 'string' },
  },
});

main().catch((error: unknown) => {
  fallar(error instanceof Error ? error.message : String(error));
});

async function main(): Promise<void> {
  const email = values.as as string | undefined;
  if (!email) fallar('Falta --as=<correo del usuario que publica>.');

  const admin = createSecretClient();
  const sitio = await cargarSitio(admin, values.tenant as string, values.site as string);

  // R9: la primera publicación de una cuenta nueva exige revisión humana
  // (§12.4). La reputación del dominio raíz es compartida entre tenants, así
  // que una oferta fraudulenta en un subdominio arrastra a todos los clientes.
  // El script no puede hacer esa revisión; solo puede negarse a publicar
  // mientras nadie declare haberla hecho.
  const revisor = values['reviewed-by'] as string | undefined;
  if (!sitio.primeraRevisionHecha && !revisor) {
    fallar(
      'Este sitio nunca se ha publicado y R9 exige revisión humana previa:\n' +
        '  producto real y legal, afirmaciones sustentadas, contacto verificable,\n' +
        '  política de datos publicada.\n' +
        'Cuando la hayas hecho, vuelve con --reviewed-by="<quién revisó>".',
    );
  }

  const accessToken = await abrirSesion(email);
  const usuario = createUserClient(accessToken);

  const resultado = await publishSite(usuario, sitio.id);

  if (!resultado.ok) {
    fallar(`No se pudo publicar (${resultado.code}):\n  - ${resultado.errors.join('\n  - ')}`);
  }

  console.log(`✓ Publicación #${resultado.publicationNumber} → ${resultado.publicationId}`);

  if (!sitio.primeraRevisionHecha && revisor) {
    await admin
      .from('sites')
      .update({ first_publish_reviewed_at: new Date().toISOString() })
      .eq('id', sitio.id);
    console.log(`✓ Revisión de primera publicación registrada (${revisor})`);
  }

  await auditar(admin, {
    tenantId: sitio.tenantId,
    action: 'site.published',
    entityId: sitio.id,
    payload: {
      runbook: 'R4',
      publication_id: resultado.publicationId,
      publication_number: resultado.publicationNumber,
      published_by: email,
      first_publish_reviewed_by: revisor ?? null,
    },
  });

  console.log('\n· El sitio está publicado, pero solo es accesible desde un hostname');
  console.log('  registrado en `domains`. Sin dominio, la landing existe y no se ve.');
}

async function cargarSitio(
  admin: NitroWebClient,
  tenantSlug: string,
  nombreSitio: string,
): Promise<{ id: string; tenantId: string; primeraRevisionHecha: boolean }> {
  const { data: tenant } = await admin
    .from('tenants')
    .select('id')
    .eq('slug', tenantSlug)
    .maybeSingle();

  if (!tenant) fallar(`No existe el tenant '${tenantSlug}'.`);

  const { data: sitio } = await admin
    .from('sites')
    .select('id, first_publish_reviewed_at')
    .eq('tenant_id', tenant.id)
    .eq('name', nombreSitio)
    .maybeSingle();

  if (!sitio) fallar(`El tenant '${tenantSlug}' no tiene un sitio llamado '${nombreSitio}'.`);

  console.log(`✓ Sitio: ${nombreSitio} (${sitio.id})`);
  return {
    id: sitio.id,
    tenantId: tenant.id,
    primeraRevisionHecha: sitio.first_publish_reviewed_at !== null,
  };
}

/**
 * Sesión del usuario sin pasar por una contraseña.
 *
 * Es un apaño consciente para el piloto. Cuando exista el dashboard, publicar
 * será un botón con la sesión que el usuario ya tiene, y esta función sobra.
 */
async function abrirSesion(email: string): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) fallar('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY.');

  const cabeceras = {
    apikey: secret,
    Authorization: `Bearer ${secret}`,
    'Content-Type': 'application/json',
  };

  const enlace = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: cabeceras,
    body: JSON.stringify({ type: 'magiclink', email }),
  }).then((r) => r.json() as Promise<{ hashed_token?: string; msg?: string }>);

  if (!enlace.hashed_token) {
    fallar(`No se pudo generar la sesión para ${email}: ${enlace.msg ?? 'respuesta inesperada'}`);
  }

  const sesion = await fetch(`${url}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: secret, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: enlace.hashed_token }),
  }).then((r) => r.json() as Promise<{ access_token?: string; msg?: string }>);

  if (!sesion.access_token) {
    fallar(`No se pudo canjear la sesión: ${sesion.msg ?? 'respuesta inesperada'}`);
  }

  console.log(`✓ Sesión abierta como ${email}`);
  return sesion.access_token;
}

/** La auditoría pasa por el cliente secreto: `audit_log` no admite INSERT de usuarios. */
async function auditar(
  admin: NitroWebClient,
  evento: {
    tenantId: string;
    action: string;
    entityId: string;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await admin.from('audit_log').insert({
    tenant_id: evento.tenantId,
    action: evento.action,
    entity_type: 'site',
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
