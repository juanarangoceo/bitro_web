import type { TemplateManifest } from '@nitro-web/contracts';
import { coffeeMakerManifestV11 } from './manifest-v1-1';
import { coffeeMakerDefaultContentV12 } from './default-content-v1-2';

export const coffeeMakerManifestV12: TemplateManifest = {
  ...coffeeMakerManifestV11,
  version: '1.2.0',
  display_name: 'Coffee Maker Pro — réplica completa',
  description: 'Versión fiel al sitio de referencia: navegación, recursos visuales, recetas, kit, ahorro y cierre.',
  component_key: 'coffeeMakerV12',
  default_content: coffeeMakerDefaultContentV12 as Record<string, unknown>,
};
