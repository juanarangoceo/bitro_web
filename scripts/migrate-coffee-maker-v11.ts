/**
 * Migra deliberadamente un sitio Coffee Maker 1.0 a 1.1.
 *
 * Las versiones no se migran solas (§7.3). Este script conserva el contenido
 * editado, añade solo las secciones nuevas y deja una traza de auditoría.
 * La fotografía desktop existente se reutiliza en los hotspots: evita inventar
 * un asset y el cliente puede reemplazarla luego desde el editor.
 */

import { parseArgs } from 'node:util';

import { createSecretClient, type Json } from '@nitro-web/db';
import { coffeeMakerDefaultContentV11 } from '@nitro-web/templates';

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
    .eq('version', '1.1.0')
    .single();
  if (versionError) {
    throw new Error(`Coffee Maker 1.1 no está sembrada: ${versionError.message}`);
  }

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

  const current = (draft.content_json ?? {}) as Record<string, unknown>;
  const hero = (current.hero ?? {}) as Record<string, unknown>;
  const desktopImage = typeof hero.image_desktop === 'string' ? hero.image_desktop : undefined;
  if (!desktopImage) {
    throw new Error('El borrador no tiene hero.image_desktop; no se puede completar hotspots.image.');
  }

  const next = {
    ...coffeeMakerDefaultContentV11,
    ...current,
    hotspots: {
      ...coffeeMakerDefaultContentV11.hotspots,
      ...((current.hotspots ?? {}) as Record<string, unknown>),
      image: ((current.hotspots ?? {}) as Record<string, unknown>).image ?? desktopImage,
    },
    recipes: {
      ...coffeeMakerDefaultContentV11.recipes,
      ...((current.recipes ?? {}) as Record<string, unknown>),
    },
    offer: {
      ...coffeeMakerDefaultContentV11.offer,
      ...((current.offer ?? {}) as Record<string, unknown>),
    },
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
      to_version: '1.1.0',
      strategy: 'preserve_current_and_add_interactive_sections',
    },
  });

  console.log(`✓ Sitio migrado a Coffee Maker 1.1: ${site.id}`);
  console.log(`✓ Borrador actualizado a revisión ${draft.revision + 1}`);
  console.log(`· Preview: /preview/${site.preview_token}`);
}

function argumentos(): string[] {
  const args = process.argv.slice(2);
  return args[0] === '--' ? args.slice(1) : args;
}

function aJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}
