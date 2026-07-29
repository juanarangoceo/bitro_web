export {
  FIELD_TYPES,
  contentSchemaSchema,
  parseContentSchema,
  compileContentValidator,
  buildAiJsonSchema,
  mergeAiContent,
  type FieldType,
  type FieldDef,
  type SectionDef,
  type ContentSchema,
  type ContentJson,
  type JsonSchemaNode,
  type ValidationMode,
} from './content-schema';

export {
  templateManifestSchema,
  assetSlotSchema,
  validateManifest,
  compareVersions,
  isRendererCompatible,
  type TemplateManifest,
  type AssetSlot,
  type ManifestValidation,
} from './manifest';

/**
 * Versión del renderer.
 *
 * Se compara contra `compatibility.min_renderer_version` de cada plantilla antes
 * de publicar. Subirla es un acto deliberado: significa que el renderer ganó
 * capacidades que las plantillas pueden exigir.
 */
export const RENDERER_VERSION = '1.0.0';
