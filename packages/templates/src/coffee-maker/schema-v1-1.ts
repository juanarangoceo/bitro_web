import type { ContentSchema, SectionDef } from '@nitro-web/contracts';
import { coffeeMakerContentSchema } from './schema';

const seccionesFinales: SectionDef[] = coffeeMakerContentSchema.sections.slice(3).map((section) =>
  section.key === 'offer'
    ? {
        ...section,
        fields: {
          ...section.fields,
          countdown_label: {
            type: 'text',
            label: 'Etiqueta del contador',
            maxLength: 60,
          },
          countdown_ends_at: {
            type: 'text',
            label: 'Fecha límite ISO',
            help: 'Ejemplo: 2026-08-15T23:59:00-05:00. Vacía o vencida no se muestra.',
            maxLength: 40,
            aiEditable: false,
          },
        },
      }
    : section,
);

/** Coffee Maker 1.1 añade los tres bloques visuales omitidos en el piloto inicial. */
export const coffeeMakerContentSchemaV11: ContentSchema = {
  version: 1,
  sections: [
    ...coffeeMakerContentSchema.sections.slice(0, 3),
    {
      key: 'hotspots',
      label: 'Detalles interactivos',
      description: 'Puntos sobre la fotografía que explican las partes importantes del producto.',
      aiGeneratable: true,
      fields: {
        eyebrow: { type: 'text', label: 'Antetítulo', maxLength: 40 },
        title: { type: 'text', label: 'Título', required: true, maxLength: 80 },
        description: { type: 'textarea', label: 'Introducción', maxLength: 180 },
        image: {
          type: 'image',
          label: 'Fotografía del producto',
          assetSlot: 'product_hotspot',
          required: true,
        },
        points: {
          type: 'list',
          label: 'Puntos',
          minItems: 1,
          maxItems: 6,
          itemSchema: {
            title: { type: 'text', label: 'Título', required: true, maxLength: 60 },
            description: {
              type: 'textarea',
              label: 'Descripción',
              required: true,
              maxLength: 180,
            },
            x: {
              type: 'number',
              label: 'Posición horizontal (%)',
              min: 5,
              max: 95,
              required: true,
              aiEditable: false,
            },
            y: {
              type: 'number',
              label: 'Posición vertical (%)',
              min: 5,
              max: 95,
              required: true,
              aiEditable: false,
            },
          },
        },
      },
    },
    {
      key: 'recipes',
      label: 'Recetas',
      description: 'Resultados que el comprador puede preparar con el producto.',
      aiGeneratable: true,
      fields: {
        eyebrow: { type: 'text', label: 'Antetítulo', maxLength: 40 },
        title: { type: 'text', label: 'Título', required: true, maxLength: 100 },
        title_highlight: { type: 'text', label: 'Título resaltado', maxLength: 80 },
        items: {
          type: 'list',
          label: 'Recetas',
          minItems: 1,
          maxItems: 6,
          itemSchema: {
            title: { type: 'text', label: 'Nombre', required: true, maxLength: 50 },
            subtitle: { type: 'text', label: 'Subtítulo', maxLength: 60 },
            time: { type: 'text', label: 'Tiempo', maxLength: 20 },
            ingredients: {
              type: 'textarea',
              label: 'Ingredientes (uno por línea)',
              required: true,
              maxLength: 500,
            },
            steps: {
              type: 'textarea',
              label: 'Pasos (uno por línea)',
              required: true,
              maxLength: 900,
            },
            pro_secret: { type: 'textarea', label: 'Secreto profesional', maxLength: 300 },
            image: { type: 'image', label: 'Imagen', assetSlot: 'recipe' },
          },
        },
      },
    },
    ...seccionesFinales,
  ],
};
