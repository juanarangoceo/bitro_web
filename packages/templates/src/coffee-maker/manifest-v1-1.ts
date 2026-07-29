import type { TemplateManifest } from '@nitro-web/contracts';
import { coffeeMakerManifest } from './manifest';
import { coffeeMakerContentSchemaV11 } from './schema-v1-1';
import { coffeeMakerDefaultContentV11 } from './default-content-v1-1';

export const coffeeMakerManifestV11: TemplateManifest = {
  ...coffeeMakerManifest,
  version: '1.1.0',
  display_name: 'Conversión Premium 1.1',
  description: 'Landing con detalles interactivos, recetas, kit, ahorro y cierre verificable.',
  component_key: 'coffeeMakerV11',
  content_schema: coffeeMakerContentSchemaV11,
  default_content: coffeeMakerDefaultContentV11 as Record<string, unknown>,
  asset_slots: {
    ...coffeeMakerManifest.asset_slots,
    product_hotspot: {
      ratio: '1:1',
      required: true,
      minWidth: 1000,
      minHeight: 1000,
      purpose: 'Fotografía completa del producto para los puntos interactivos.',
    },
    recipe: {
      ratio: '4:3',
      required: false,
      max: 6,
      minWidth: 800,
      minHeight: 600,
      purpose: 'Resultado final de cada receta.',
    },
  },
  ai_sections: ['hero', 'problem', 'gallery', 'hotspots', 'recipes', 'bundle', 'savings', 'offer', 'faq', 'seo'],
};
