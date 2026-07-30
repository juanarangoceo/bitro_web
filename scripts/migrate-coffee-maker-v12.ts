/**
 * Prepara el sitio piloto para revisar Coffee Maker 1.2 sin tocar su snapshot
 * público. El preview leerá este borrador; producción seguirá en 1.1 hasta una
 * publicación explícita.
 */

import { parseArgs } from 'node:util';
import { createSecretClient, type Json } from '@nitro-web/db';
import { coffeeMakerDefaultContentV12 } from '@nitro-web/templates';

try {
  process.loadEnvFile('.env.local');
} catch {
  // En CI las variables llegan por el entorno.
}

const { values } = parseArgs({
  args: argumentos(),
  options: {
    tenant: { type: 'string', default: 'coffee-maker-pro' },
    site: { type: 'string', default: 'Cafetera Espresso' },
  },
});

main().catch((error: unknown) => {
  console.error(`\nERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

async function main(): Promise<void> {
  const db = createSecretClient();
  const { data: tenant, error: tenantError } = await db
    .from('tenants')
    .select('id')
    .eq('slug', values.tenant as string)
    .single();
  if (tenantError) throw tenantError;

  const { data: template, error: templateError } = await db
    .from('templates')
    .select('id')
    .eq('template_key', 'coffee-maker')
    .single();
  if (templateError) throw templateError;

  const { data: version, error: versionError } = await db
    .from('template_versions')
    .select('id')
    .eq('template_id', template.id)
    .eq('version', '1.2.0')
    .single();
  if (versionError) throw new Error(`Coffee Maker 1.2 no está sembrada: ${versionError.message}`);

  const { data: site, error: siteError } = await db
    .from('sites')
    .select('id, template_version_id, preview_token')
    .eq('tenant_id', tenant.id)
    .eq('name', values.site as string)
    .single();
  if (siteError) throw siteError;

  const { data: draft, error: draftError } = await db
    .from('site_content_drafts')
    .select('content_json, revision')
    .eq('site_id', site.id)
    .single();
  if (draftError) throw draftError;

  const current = objeto(draft.content_json);
  const next = {
    ...coffeeMakerDefaultContentV12,
    hero: { ...objeto(coffeeMakerDefaultContentV12.hero), ...objeto(current.hero) },
    hotspots: { ...objeto(coffeeMakerDefaultContentV12.hotspots), ...objeto(current.hotspots) },
    social_proof: {
      ...objeto(coffeeMakerDefaultContentV12.social_proof),
      ...objeto(current.social_proof),
    },
    offer: { ...objeto(coffeeMakerDefaultContentV12.offer), ...objeto(current.offer) },
    seo: { ...objeto(coffeeMakerDefaultContentV12.seo), ...objeto(current.seo) },
  };

  const { error: siteUpdateError } = await db
    .from('sites')
    .update({ template_version_id: version.id })
    .eq('id', site.id);
  if (siteUpdateError) throw siteUpdateError;

  const { error: draftUpdateError } = await db
    .from('site_content_drafts')
    .update({ content_json: aJson(next), revision: draft.revision + 1 })
    .eq('site_id', site.id);
  if (draftUpdateError) {
    await db.from('sites').update({ template_version_id: site.template_version_id }).eq('id', site.id);
    throw draftUpdateError;
  }

  await db.from('audit_log').insert({
    tenant_id: tenant.id,
    action: 'site.template_version_migrated',
    entity_type: 'site',
    entity_id: site.id,
    payload_json: {
      from_template_version_id: site.template_version_id,
      to_template_version_id: version.id,
      to_version: '1.2.0',
      strategy: 'restore_reference_layout_and_assets_in_preview',
    },
  });

  console.log(`✓ Borrador migrado a Coffee Maker 1.2: ${site.id}`);
  console.log(`✓ Revisión ${draft.revision + 1}; la publicación actual permanece intacta`);
  console.log(`· Preview: /preview/${site.preview_token}`);
}

function argumentos(): string[] {
  const args = process.argv.slice(2);
  return args[0] === '--' ? args.slice(1) : args;
}

function objeto(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function aJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}
