/**
 * El manifest de una plantilla (§7.1).
 *
 * Declara qué es la plantilla, qué componente la renderiza, qué imágenes exige y
 * qué secciones puede tocar la IA. Junto con el `content_schema` forma el
 * contrato completo: una plantilla que cumple ambos se puede instalar, editar,
 * generar y publicar sin tocar el núcleo de Nitro Web.
 */

import { z } from 'zod';
import { contentSchemaSchema, type ContentSchema } from './content-schema';

/**
 * Requisitos de una imagen que la plantilla espera.
 *
 * `ratio` y las dimensiones mínimas no son cosmética: una foto de producto
 * subida en 4:5 dentro de un slot 16:9 se recorta por donde no debe, y una
 * imagen de 10 MB multiplica por cinco la transferencia de la landing (§9).
 */
export const assetSlotSchema = z.object({
  /** Relación de aspecto esperada, p. ej. "4:5" o "1:1". */
  ratio: z.string().regex(/^\d+:\d+$/).optional(),
  required: z.boolean().default(false),
  /** Máximo de imágenes cuando el slot es una galería. */
  max: z.number().int().positive().optional(),
  minWidth: z.number().int().positive().optional(),
  minHeight: z.number().int().positive().optional(),
  /** Para qué sirve la imagen. Se muestra al cliente al subirla. */
  purpose: z.string().optional(),
});

export type AssetSlot = z.infer<typeof assetSlotSchema>;

export const templateManifestSchema = z.object({
  /** Identificador estable entre versiones, p. ej. 'coffee-maker'. */
  template_key: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'template_key debe ser kebab-case en minúsculas'),

  /** Semver. Inmutable una vez publicada (§7.3). */
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'version debe ser semver (x.y.z)'),

  display_name: z.string().min(1),
  category: z.string().optional(),
  description: z.string().optional(),

  /**
   * Clave del componente en el registro del renderer.
   *
   * Se valida contra el registro antes de publicar: un `component_key` sin
   * componente registrado produciría una landing en blanco en producción.
   */
  component_key: z.string().min(1),

  content_schema: contentSchemaSchema,

  /** Contenido demostrativo con el que nace un sitio nuevo. */
  default_content: z.record(z.string(), z.unknown()),

  asset_slots: z.record(z.string(), assetSlotSchema).default({}),

  /**
   * Secciones que la IA puede generar.
   *
   * Redundante con `aiGeneratable` del schema a propósito: el manifest es lo que
   * lee el admin al aprobar una plantilla, y ahí debe verse de un vistazo qué
   * puede escribir el modelo.
   */
  ai_sections: z.array(z.string()).default([]),

  compatibility: z
    .object({
      /** Versión mínima del renderer requerida. */
      min_renderer_version: z.string().regex(/^\d+\.\d+\.\d+$/).default('1.0.0'),
      capabilities: z.array(z.string()).default([]),
    })
    .default({ min_renderer_version: '1.0.0', capabilities: [] }),

  visibility: z.enum(['public', 'private', 'hidden']).default('hidden'),
  owner_tenant_id: z.string().uuid().nullable().default(null),
  origin: z.enum(['catalog', 'custom']).default('catalog'),
});

export type TemplateManifest = z.infer<typeof templateManifestSchema>;

/** Resultado de validar un manifest completo. */
export type ManifestValidation =
  | { ok: true; manifest: TemplateManifest }
  | { ok: false; errors: string[] };

/**
 * Valida un manifest y la coherencia interna de sus partes.
 *
 * Zod cubre la forma; esta función cubre lo que Zod no puede ver: que las
 * referencias cruzadas entre manifest, schema y contenido por defecto apunten a
 * cosas que existen.
 */
export function validateManifest(input: unknown): ManifestValidation {
  const parsed = templateManifestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }

  const manifest = parsed.data;
  const errors: string[] = [];
  const schema = manifest.content_schema as ContentSchema;
  const sectionKeys = new Set(schema.sections.map((s) => s.key));

  // Una sección declarada como generable por IA que no existe en el schema
  // dejaría al editor ofreciendo un botón "regenerar" sobre la nada.
  for (const sectionKey of manifest.ai_sections) {
    if (!sectionKeys.has(sectionKey)) {
      errors.push(`ai_sections referencia una sección inexistente: '${sectionKey}'`);
    }
  }

  // Un campo `image` apuntando a un slot no declarado deja al cliente sin saber
  // qué dimensiones subir, y a la validación de carga sin criterio.
  const slotKeys = new Set(Object.keys(manifest.asset_slots));
  for (const section of schema.sections) {
    for (const [fieldKey, field] of Object.entries(section.fields)) {
      if (field.type !== 'image') continue;
      if (!field.assetSlot) {
        errors.push(`${section.key}.${fieldKey}: un campo 'image' requiere 'assetSlot'`);
      } else if (!slotKeys.has(field.assetSlot)) {
        errors.push(
          `${section.key}.${fieldKey}: assetSlot '${field.assetSlot}' no está en asset_slots`,
        );
      }
    }
  }

  // El contenido por defecto es lo primero que ve un cliente nuevo. Si trae una
  // sección que el schema no conoce, el editor no sabría mostrarla.
  for (const key of Object.keys(manifest.default_content)) {
    if (!sectionKeys.has(key)) {
      errors.push(`default_content trae una sección desconocida: '${key}'`);
    }
  }

  // Una plantilla privada sin dueño es invisible para todos y editable por nadie.
  if (manifest.visibility === 'private' && !manifest.owner_tenant_id) {
    errors.push('Una plantilla `private` requiere `owner_tenant_id`');
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, manifest };
}

/**
 * Compara dos versiones semver.
 *
 * @returns negativo si `a < b`, 0 si son iguales, positivo si `a > b`.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * ¿El renderer puede servir esta plantilla?
 *
 * Se comprueba antes de publicar, no al renderizar: descubrir en producción que
 * el renderer desplegado es más viejo que la plantilla significa una landing
 * rota con tráfico pagado encima.
 */
export function isRendererCompatible(
  manifest: TemplateManifest,
  rendererVersion: string,
): boolean {
  return compareVersions(rendererVersion, manifest.compatibility.min_renderer_version) >= 0;
}
