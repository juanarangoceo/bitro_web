/**
 * Manifest de la plantilla Coffee Maker 1.0.0.
 *
 * Primera plantilla del catálogo y caso de prueba del contrato (§7.5). Si algo
 * del contrato es incómodo aquí, el contrato está mal — no la plantilla.
 */

import type { TemplateManifest } from '@nitro-web/contracts';
import { coffeeMakerContentSchema } from './schema';
import { coffeeMakerDefaultContent } from './default-content';

export const coffeeMakerManifest: TemplateManifest = {
  template_key: 'coffee-maker',
  version: '1.0.0',
  display_name: 'Conversión Premium',
  category: 'Producto físico',
  description:
    'Landing de producto único con demostración, kit de regalo, comparación de ahorro y cierre con pago contraentrega.',
  component_key: 'coffeeMakerV1',

  content_schema: coffeeMakerContentSchema,
  default_content: coffeeMakerDefaultContent as Record<string, unknown>,

  // Las proporciones no son sugerencias: la plantilla recorta a estas medidas.
  // Subir una foto con otra relación deja el producto cortado por donde no debe.
  asset_slots: {
    hero_mobile: {
      ratio: '4:5',
      required: true,
      minWidth: 800,
      minHeight: 1000,
      purpose: 'Imagen principal en móvil. Es el elemento LCP de la página.',
    },
    hero_desktop: {
      ratio: '1:1',
      required: true,
      minWidth: 1000,
      minHeight: 1000,
      purpose: 'Imagen principal en escritorio.',
    },
    gallery: {
      ratio: '1:1',
      required: false,
      max: 6,
      minWidth: 600,
      minHeight: 600,
      purpose: 'Detalles de materiales y acabados.',
    },
    bundle: {
      ratio: '1:1',
      required: false,
      max: 4,
      minWidth: 600,
      minHeight: 600,
      purpose: 'Cada bono incluido en la oferta.',
    },
    testimonial: {
      ratio: '1:1',
      required: false,
      max: 6,
      minWidth: 200,
      minHeight: 200,
      purpose: 'Foto de quien da el testimonio. Requiere su autorización.',
    },
    social: {
      ratio: '1200:630',
      required: false,
      minWidth: 1200,
      minHeight: 630,
      purpose: 'Vista previa al compartir el enlace por WhatsApp o redes.',
    },
  },

  // `social_proof` queda fuera a propósito: un testimonio generado por un modelo
  // es prueba social fabricada, no una redacción mejorada.
  ai_sections: ['hero', 'problem', 'gallery', 'bundle', 'savings', 'offer', 'faq', 'seo'],

  compatibility: {
    min_renderer_version: '1.0.0',
    capabilities: [],
  },

  visibility: 'public',
  owner_tenant_id: null,
  origin: 'catalog',
};
