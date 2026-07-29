/**
 * `content_schema` de la plantilla Coffee Maker.
 *
 * Deriva del inventario de la landing en producción
 * (`github.com/juanarangoceo/cafetera_espresso`): cada texto e imagen de esa
 * página se mapeó a un campo semántico (§7.4, paso 2).
 *
 * Dos cosas que NO están aquí, a propósito:
 *
 *   - **Precio e inventario.** Viven en `offers`, en columnas relacionales
 *     (ADR 0003). Si estuvieran en el contenido editable, el cliente podría
 *     cambiar por la ruta de textos el número que después cobra el servidor.
 *   - **Layout.** El cliente edita contenido, no posiciones. Es el principio de
 *     "autoservicio controlado" (§1.2).
 */

import type { ContentSchema } from '@nitro-web/contracts';

export const coffeeMakerContentSchema: ContentSchema = {
  version: 1,
  sections: [
    {
      key: 'hero',
      label: 'Encabezado',
      description: 'Lo primero que ve quien llega desde un anuncio. Debe prometer el resultado, no describir el producto.',
      aiGeneratable: true,
      fields: {
        headline: {
          type: 'text',
          label: 'Titular',
          help: 'El beneficio principal en una frase. Máximo 60 caracteres para que no se parta en móvil.',
          required: true,
          maxLength: 60,
        },
        headline_highlight: {
          type: 'text',
          label: 'Titular resaltado',
          help: 'Segunda línea del titular, se muestra en color de acento.',
          maxLength: 40,
        },
        subheadline: {
          type: 'textarea',
          label: 'Subtítulo',
          help: 'Amplía la promesa y quita la primera objeción.',
          required: true,
          maxLength: 180,
        },
        cta_label: {
          type: 'text',
          label: 'Texto del botón',
          required: true,
          maxLength: 30,
        },
        badges: {
          type: 'list',
          label: 'Señales de confianza',
          help: 'Envío gratis, garantía, pago contraentrega.',
          maxItems: 4,
          itemSchema: {
            text: { type: 'text', label: 'Texto', required: true, maxLength: 40 },
          },
        },
        scarcity_note: {
          type: 'text',
          label: 'Aviso de urgencia',
          help: 'Debe ser cierto. Una escasez inventada es publicidad engañosa.',
          maxLength: 60,
        },
        image_mobile: {
          type: 'image',
          label: 'Imagen (móvil)',
          help: 'Vertical 4:5. Es la imagen LCP: define la velocidad percibida.',
          assetSlot: 'hero_mobile',
          required: true,
        },
        image_desktop: {
          type: 'image',
          label: 'Imagen (escritorio)',
          help: 'Cuadrada 1:1.',
          assetSlot: 'hero_desktop',
          required: true,
        },
      },
    },

    {
      key: 'problem',
      label: 'Problema',
      description: 'Por qué lo que el cliente hace hoy no funciona. Cada punto contrasta el error con la solución.',
      aiGeneratable: true,
      fields: {
        eyebrow: { type: 'text', label: 'Antetítulo', maxLength: 30 },
        title: { type: 'text', label: 'Título', required: true, maxLength: 90 },
        title_highlight: { type: 'text', label: 'Título resaltado', maxLength: 90 },
        video_url: {
          type: 'url',
          label: 'Vídeo demostrativo',
          help: 'MP4 alojado en un CDN. Opcional.',
        },
        video_caption: { type: 'text', label: 'Pie del vídeo', maxLength: 120 },
        points: {
          type: 'list',
          label: 'Puntos de dolor',
          minItems: 1,
          maxItems: 4,
          itemSchema: {
            title: { type: 'text', label: 'Título', required: true, maxLength: 60 },
            mistake: {
              type: 'textarea',
              label: 'Lo que hace mal',
              required: true,
              maxLength: 160,
            },
            solution: {
              type: 'textarea',
              label: 'La solución',
              required: true,
              maxLength: 160,
            },
          },
        },
      },
    },

    {
      key: 'gallery',
      label: 'Detalles del producto',
      description: 'Tarjetas con imagen que muestran materiales y acabados.',
      aiGeneratable: true,
      fields: {
        eyebrow: { type: 'text', label: 'Antetítulo', maxLength: 30 },
        title: { type: 'text', label: 'Título', required: true, maxLength: 80 },
        items: {
          type: 'list',
          label: 'Detalles',
          minItems: 2,
          maxItems: 6,
          itemSchema: {
            title: { type: 'text', label: 'Título', required: true, maxLength: 50 },
            description: {
              type: 'textarea',
              label: 'Descripción',
              required: true,
              maxLength: 140,
            },
            image: { type: 'image', label: 'Imagen', assetSlot: 'gallery' },
          },
        },
      },
    },

    {
      key: 'bundle',
      label: 'Kit incluido',
      description: 'Los bonos que se llevan gratis. Es la sección que más levanta la conversión en oferta única.',
      aiGeneratable: true,
      fields: {
        eyebrow: { type: 'text', label: 'Antetítulo', maxLength: 30 },
        title: { type: 'text', label: 'Título', required: true, maxLength: 70 },
        title_highlight: { type: 'text', label: 'Título resaltado', maxLength: 50 },
        intro: { type: 'textarea', label: 'Introducción', maxLength: 200 },
        items: {
          type: 'list',
          label: 'Bonos',
          minItems: 1,
          maxItems: 4,
          itemSchema: {
            name: { type: 'text', label: 'Nombre', required: true, maxLength: 50 },
            subtitle: { type: 'text', label: 'Subtítulo', maxLength: 40 },
            description: {
              type: 'textarea',
              label: 'Descripción',
              required: true,
              maxLength: 200,
            },
            // `money` para que el editor lo muestre formateado y la IA no lo
            // toque: un valor de regalo inventado es una afirmación falsa.
            value_amount: { type: 'money', label: 'Valor declarado' },
            image: { type: 'image', label: 'Imagen', assetSlot: 'bundle' },
            bullets: {
              type: 'list',
              label: 'Viñetas',
              maxItems: 4,
              itemSchema: {
                text: { type: 'text', label: 'Texto', required: true, maxLength: 60 },
              },
            },
          },
        },
      },
    },

    {
      key: 'savings',
      label: 'Ahorro',
      description: 'La comparación económica: cuánto cuesta seguir como está frente a comprar una vez.',
      aiGeneratable: true,
      fields: {
        title: { type: 'text', label: 'Título', required: true, maxLength: 60 },
        intro: { type: 'textarea', label: 'Introducción', maxLength: 200 },
        current_label: { type: 'text', label: 'Etiqueta del gasto actual', maxLength: 40 },
        current_lines: {
          type: 'list',
          label: 'Líneas del gasto actual',
          maxItems: 5,
          itemSchema: {
            label: { type: 'text', label: 'Concepto', required: true, maxLength: 40 },
            amount: { type: 'money', label: 'Valor', required: true },
          },
        },
        // Los totales son `money`: los calcula o los pone el vendedor, no la IA.
        current_annual_amount: { type: 'money', label: 'Gasto anual actual' },
        alternative_label: { type: 'text', label: 'Etiqueta de la alternativa', maxLength: 40 },
        alternative_lines: {
          type: 'list',
          label: 'Líneas de la alternativa',
          maxItems: 5,
          itemSchema: {
            label: { type: 'text', label: 'Concepto', required: true, maxLength: 40 },
            value: { type: 'text', label: 'Valor', required: true, maxLength: 20 },
          },
        },
        savings_headline: { type: 'text', label: 'Titular del ahorro', maxLength: 30 },
        savings_note: { type: 'text', label: 'Nota bajo el ahorro', maxLength: 80 },
      },
    },

    {
      key: 'social_proof',
      label: 'Prueba social',
      description: 'Testimonios de compradores reales. Solo con autorización de la persona (§14.4).',
      aiGeneratable: false,
      fields: {
        title: { type: 'text', label: 'Título', required: true, maxLength: 60 },
        testimonials: {
          type: 'list',
          label: 'Testimonios',
          maxItems: 6,
          itemSchema: {
            // `aiEditable: false` en el texto: inventar un testimonio es
            // fabricar prueba social falsa, no redactar mejor (§8.3).
            name: { type: 'text', label: 'Nombre', required: true, maxLength: 40, aiEditable: false },
            location: { type: 'text', label: 'Ciudad', maxLength: 40, aiEditable: false },
            text: { type: 'textarea', label: 'Testimonio', required: true, maxLength: 300, aiEditable: false },
            highlight: { type: 'text', label: 'Etiqueta', maxLength: 20, aiEditable: false },
            image: { type: 'image', label: 'Foto', assetSlot: 'testimonial' },
          },
        },
      },
    },

    {
      key: 'offer',
      label: 'Oferta y compra',
      description: 'El cierre. El precio NO se edita aquí: se configura en la oferta del sitio.',
      aiGeneratable: true,
      fields: {
        eyebrow: { type: 'text', label: 'Antetítulo', maxLength: 40 },
        title: { type: 'text', label: 'Título', required: true, maxLength: 80 },
        description: { type: 'textarea', label: 'Descripción', maxLength: 250 },
        cta_label: { type: 'text', label: 'Texto del botón', required: true, maxLength: 30 },
        cta_subtext: { type: 'text', label: 'Texto bajo el botón', maxLength: 60 },
        included: {
          type: 'list',
          label: 'Qué incluye',
          maxItems: 6,
          itemSchema: {
            title: { type: 'text', label: 'Título', required: true, maxLength: 50 },
            description: { type: 'text', label: 'Detalle', maxLength: 80 },
          },
        },
        guarantees: {
          type: 'list',
          label: 'Garantías',
          maxItems: 4,
          itemSchema: {
            title: { type: 'text', label: 'Título', required: true, maxLength: 30 },
            description: { type: 'text', label: 'Detalle', maxLength: 40 },
          },
        },
        show_countdown: {
          type: 'boolean',
          label: 'Mostrar contador',
          help: 'Úsalo solo si la oferta vence de verdad.',
        },
        stock_note: { type: 'text', label: 'Aviso de stock', maxLength: 40 },
      },
    },

    {
      key: 'faq',
      label: 'Preguntas frecuentes',
      description: 'Responde las objeciones que frenan la compra: envío, garantía, forma de pago.',
      aiGeneratable: true,
      fields: {
        title: { type: 'text', label: 'Título', required: true, maxLength: 50 },
        items: {
          type: 'list',
          label: 'Preguntas',
          minItems: 1,
          maxItems: 10,
          itemSchema: {
            question: { type: 'text', label: 'Pregunta', required: true, maxLength: 120 },
            answer: { type: 'textarea', label: 'Respuesta', required: true, maxLength: 600 },
          },
        },
      },
    },

    {
      key: 'seo',
      label: 'SEO y compartir',
      description: 'Cómo se ve la página en buscadores y al compartirla por WhatsApp.',
      aiGeneratable: true,
      fields: {
        title: { type: 'text', label: 'Título', required: true, maxLength: 60 },
        description: { type: 'textarea', label: 'Descripción', required: true, maxLength: 160 },
        social_image: { type: 'image', label: 'Imagen para compartir', assetSlot: 'social' },
      },
    },
  ],
};
