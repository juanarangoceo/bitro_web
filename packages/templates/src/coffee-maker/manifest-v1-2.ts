import type { TemplateManifest } from '@nitro-web/contracts';
import { coffeeMakerManifestV11 } from './manifest-v1-1';
import { coffeeMakerContentSchemaV12 } from './schema-v1-2';
import { coffeeMakerDefaultContentV12 } from './default-content-v1-2';

export const coffeeMakerManifestV12: TemplateManifest = {
  ...coffeeMakerManifestV11,
  version: '1.2.0',
  display_name: 'Coffee Maker Pro — réplica completa',
  description: 'Versión fiel al sitio de referencia: navegación, recursos visuales, recetas, kit, ahorro y cierre.',
  component_key: 'coffeeMakerV12',
  content_schema: coffeeMakerContentSchemaV12,
  default_content: coffeeMakerDefaultContentV12 as Record<string, unknown>,
  // `brand` y `footer` quedan fuera: son marca, enlaces y datos legales del
  // cliente. Un modelo que los redacte inventa una dirección o una política que
  // no existe.
  ai_sections: coffeeMakerManifestV11.ai_sections,
};
