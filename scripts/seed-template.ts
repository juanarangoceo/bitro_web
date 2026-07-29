/**
 * Siembra una plantilla del catálogo en Supabase (runbook R4).
 *
 * El manifest, el `content_schema` y el `default_content` viven en
 * `packages/templates`. Este script los lleva a `templates` y
 * `template_versions` sin copiarlos a mano: el código es la única fuente, y la
 * base es un reflejo suyo.
 *
 * Es idempotente. Correrlo dos veces con la misma versión no duplica nada, y
 * sobre una versión ya publicada **no escribe**: §7.3 dice que una versión
 * publicada es inmutable, y hay un trigger que lo hace cumplir. Corregir algo
 * publicado exige una versión nueva.
 *
 * Uso:
 *   pnpm db:seed-template                      # siembra en estado development
 *   pnpm db:seed-template -- --publish         # además la pasa a published
 *   pnpm db:seed-template -- --template=coffee-maker
 */

import { parseArgs } from 'node:util';

import {
  RENDERER_VERSION,
  isRendererCompatible,
  validateManifest,
  type TemplateManifest,
} from '@nitro-web/contracts';
import { createSecretClient, type Json, type NitroWebClient } from '@nitro-web/db';
import { TEMPLATE_MANIFESTS, isComponentRegistered } from '@nitro-web/templates';

// Cargar antes de tocar el cliente: createSecretClient() lanza si falta una
// variable, y el error de "falta SUPABASE_SECRET_KEY" es más útil que un fallo
// de red diez líneas después.
try {
  process.loadEnvFile('.env.local');
} catch {
  // Sin .env.local se sigue: en CI las variables llegan por el entorno.
}

const { values } = parseArgs({
  options: {
    template: { type: 'string', default: 'coffee-maker' },
    publish: { type: 'boolean', default: false },
  },
});

const templateKey = values.template as string;
const shouldPublish = values.publish as boolean;

main().catch((error: unknown) => {
  fallar(error instanceof Error ? error.message : String(error));
});

async function main(): Promise<void> {
  const manifest = TEMPLATE_MANIFESTS[templateKey];
  if (!manifest) {
    fallar(
      `No existe la plantilla '${templateKey}'. Conocidas: ${Object.keys(TEMPLATE_MANIFESTS).join(', ')}`,
    );
  }

  comprobarAntesDeEscribir(manifest);

  const supabase = createSecretClient();
  const templateId = await upsertTemplate(supabase, manifest);
  await upsertVersion(supabase, manifest, templateId);
}

/**
 * Pasos 1 y 2 de R4, que son los automatizables.
 *
 * Los pasos 3 y 4 (probar en preview, revisar peso y consola) siguen siendo
 * humanos: ningún script puede mirar una landing en un teléfono.
 */
function comprobarAntesDeEscribir(manifest: TemplateManifest): void {
  const validacion = validateManifest(manifest);
  if (!validacion.ok) {
    fallar(`El manifest no cumple el contrato:\n  - ${validacion.errors.join('\n  - ')}`);
  }

  // Un component_key sin componente registrado no da una página fea: da una
  // landing en blanco, y se descubre con tráfico pagado encima.
  if (!isComponentRegistered(manifest.component_key)) {
    fallar(
      `component_key '${manifest.component_key}' no está registrado en el renderer. ` +
        'Añádelo a REGISTERED_COMPONENT_KEYS y al mapa COMPONENTS de apps/renderer.',
    );
  }

  if (!isRendererCompatible(manifest, RENDERER_VERSION)) {
    fallar(
      `La plantilla exige renderer >= ${manifest.compatibility.min_renderer_version} ` +
        `y el desplegado es ${RENDERER_VERSION}. Despliega el renderer antes de sembrar.`,
    );
  }

  console.log(`✓ Manifest válido: ${manifest.template_key} ${manifest.version}`);
  console.log(`✓ component_key '${manifest.component_key}' registrado`);
  console.log(`✓ Compatible con renderer ${RENDERER_VERSION}`);
}

async function upsertTemplate(
  supabase: NitroWebClient,
  manifest: TemplateManifest,
): Promise<string> {
  const fila = {
    template_key: manifest.template_key,
    display_name: manifest.display_name,
    category: manifest.category ?? null,
    description: manifest.description ?? null,
    visibility: manifest.visibility,
    origin: manifest.origin,
    owner_tenant_id: manifest.owner_tenant_id,
  };

  const { data, error } = await supabase
    .from('templates')
    .upsert(fila, { onConflict: 'template_key' })
    .select('id')
    .single();

  if (error || !data) {
    fallar(`No se pudo escribir en 'templates': ${error?.message ?? 'sin datos'}`);
  }

  console.log(`✓ templates: ${manifest.template_key} → ${data.id}`);
  return data.id;
}

async function upsertVersion(
  supabase: NitroWebClient,
  manifest: TemplateManifest,
  templateId: string,
): Promise<void> {
  const { data: existente, error: errorLectura } = await supabase
    .from('template_versions')
    .select('id, status')
    .eq('template_id', templateId)
    .eq('version', manifest.version)
    .maybeSingle();

  if (errorLectura) {
    fallar(`No se pudo leer 'template_versions': ${errorLectura.message}`);
  }

  // Inmutabilidad (§7.3). Se comprueba aquí además del trigger para dar un
  // mensaje que diga qué hacer, en vez de un error de Postgres.
  if (existente?.status === 'published') {
    console.log(
      `\n· La versión ${manifest.version} ya está publicada y es inmutable: no se toca.\n` +
        '  Para corregirla, sube la versión en el manifest (1.0.1) y vuelve a sembrar.',
    );
    return;
  }

  const contenido = {
    template_id: templateId,
    version: manifest.version,
    component_key: manifest.component_key,
    manifest_json: aJson(manifest),
    content_schema: aJson(manifest.content_schema),
    default_content: aJson(manifest.default_content),
    min_renderer_version: manifest.compatibility.min_renderer_version,
    status: shouldPublish ? ('published' as const) : ('development' as const),
    published_at: shouldPublish ? new Date().toISOString() : null,
  };

  const { data, error } = existente
    ? await supabase
        .from('template_versions')
        .update(contenido)
        .eq('id', existente.id)
        .select('id, status')
        .single()
    : await supabase.from('template_versions').insert(contenido).select('id, status').single();

  if (error || !data) {
    fallar(`No se pudo escribir la versión: ${error?.message ?? 'sin datos'}`);
  }

  console.log(`✓ template_versions: ${manifest.version} (${data.status}) → ${data.id}`);

  await registrarEnAuditoria(supabase, {
    action: existente ? 'template_version.updated' : 'template_version.created',
    entityId: data.id,
    payload: {
      runbook: 'R4',
      template_key: manifest.template_key,
      version: manifest.version,
      component_key: manifest.component_key,
      status: data.status,
      renderer_version: RENDERER_VERSION,
    },
  });

  if (shouldPublish) {
    console.log(
      '\n· Publicada. Recuerda que R4 pasos 3 y 4 (preview en móvil y escritorio,\n' +
        '  presupuesto de peso, consola sin errores) son humanos y no los cubre este script.',
    );
  } else {
    console.log('\n· Sembrada en `development`. Para publicarla: pnpm db:seed-template -- --publish');
  }
}

/**
 * El catálogo de plantillas es de plataforma, no de un tenant: `tenant_id` va en
 * NULL, que es justo el caso que `audit_log` contempla para acciones que no
 * afectan a un cliente concreto.
 */
async function registrarEnAuditoria(
  supabase: NitroWebClient,
  evento: { action: string; entityId: string; payload: Record<string, unknown> },
): Promise<void> {
  const { error } = await supabase.from('audit_log').insert({
    tenant_id: null,
    action: evento.action,
    entity_type: 'template_version',
    entity_id: evento.entityId,
    payload_json: aJson(evento.payload),
  });

  // La auditoría no debe tumbar la siembra, pero tampoco pasar desapercibida.
  if (error) {
    console.warn(`! No se pudo registrar en audit_log: ${error.message}`);
  }
}

/**
 * Convierte un valor a `Json` para una columna `jsonb`.
 *
 * No es un cast: el round-trip por `JSON` es exactamente lo que hará el driver
 * al enviar el valor, así que un objeto que no sobreviva aquí tampoco llegaría
 * bien a la base. Falla ruidosamente en vez de guardar algo distinto de lo que
 * declara el manifest.
 */
function aJson(valor: unknown): Json {
  return JSON.parse(JSON.stringify(valor)) as Json;
}

function fallar(mensaje: string): never {
  console.error(`\nERROR: ${mensaje}`);
  process.exit(1);
}
