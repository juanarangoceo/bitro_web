import type { ContentSchema, SectionDef } from '@nitro-web/contracts';
import { coffeeMakerContentSchemaV11 } from './schema-v1-1';

/**
 * Coffee Maker 1.2 — lo que faltaba para reproducir el sitio de referencia.
 *
 * Dos clases de cambio:
 *
 * 1. **Campos que la 1.1 dibujaba a medias.** El más visible era el bloque de
 *    ahorro: pintaba un recuadro destacado con su titular y *sin cifra*, porque
 *    la cifra no existía en el contrato.
 * 2. **Marca y pie dejan de estar en el código.** La 1.2 estrenó navegación y
 *    pie con "Coffee Maker Pro" escrito dentro del componente. Funciona para un
 *    cliente y solo uno: el segundo tenant que instale la plantilla vería la
 *    marca del primero en su cabecera. Aquí pasan a ser contenido, como el resto.
 *
 * El precio sigue fuera del schema (vive en `offers`). Lo que se añade son
 * valores *de referencia* —lo que cuesta el hábito actual, lo que valen los
 * bonos—, que no son lo que el servidor cobra y por eso sí son contenido.
 */
const marca: SectionDef = {
  key: 'brand',
  label: 'Marca y navegación',
  description: 'Cabecera fija: cómo se llama la tienda y a dónde lleva cada enlace.',
  // Fuera del alcance de la IA: el nombre comercial y los anclajes de navegación
  // no son texto persuasivo, y un modelo que los "mejore" rompe los enlaces.
  aiGeneratable: false,
  fields: {
    name: { type: 'text', label: 'Nombre', required: true, maxLength: 30, aiEditable: false },
    name_accent: {
      type: 'text',
      label: 'Parte destacada del nombre',
      help: 'Se dibuja en dorado, después del nombre. Ejemplo: Pro.',
      maxLength: 12,
      aiEditable: false,
    },
    tagline: { type: 'text', label: 'Bajo el nombre', maxLength: 24, aiEditable: false },
    nav_links: {
      type: 'list',
      label: 'Enlaces',
      maxItems: 5,
      itemSchema: {
        label: { type: 'text', label: 'Texto', required: true, maxLength: 20 },
        anchor: {
          type: 'text',
          label: 'Sección',
          help: 'experiencia, recetas, kit, ahorro u oferta.',
          required: true,
          maxLength: 20,
          aiEditable: false,
        },
      },
    },
    cta_label: { type: 'text', label: 'Botón de la cabecera', maxLength: 20, aiEditable: false },
  },
};

const pie: SectionDef = {
  key: 'footer',
  label: 'Pie de página',
  description:
    'Cierre legal y de contacto. Las plataformas de anuncios exigen que la política de datos sea alcanzable desde la landing.',
  aiGeneratable: false,
  fields: {
    about: { type: 'textarea', label: 'Descripción de la tienda', maxLength: 200 },
    explore_label: { type: 'text', label: 'Título de la columna de secciones', maxLength: 24 },
    explore_links: {
      type: 'list',
      label: 'Enlaces a secciones',
      maxItems: 5,
      itemSchema: {
        label: { type: 'text', label: 'Texto', required: true, maxLength: 24 },
        anchor: { type: 'text', label: 'Sección', required: true, maxLength: 20, aiEditable: false },
      },
    },
    legal_label: { type: 'text', label: 'Título de la columna legal', maxLength: 24 },
    legal_links: {
      type: 'list',
      label: 'Enlaces legales',
      maxItems: 5,
      itemSchema: {
        label: { type: 'text', label: 'Texto', required: true, maxLength: 40 },
        url: { type: 'url', label: 'Dirección', required: true },
      },
    },
    contact_label: { type: 'text', label: 'Título de la columna de contacto', maxLength: 24 },
    contact_lines: {
      type: 'list',
      label: 'Líneas de contacto',
      maxItems: 4,
      itemSchema: {
        text: { type: 'text', label: 'Línea', required: true, maxLength: 60 },
      },
    },
    copyright: { type: 'text', label: 'Aviso de copyright', maxLength: 80 },
  },
};

export const coffeeMakerContentSchemaV12: ContentSchema = {
  ...coffeeMakerContentSchemaV11,
  sections: [marca, ...coffeeMakerContentSchemaV11.sections.map(ampliarSeccion), pie],
};

function ampliarSeccion(section: SectionDef): SectionDef {
  if (section.key === 'savings') {
    return {
      ...section,
      fields: {
        ...section.fields,
        current_total_label: { type: 'text', label: 'Etiqueta del total diario', maxLength: 30 },
        current_total_amount: { type: 'money', label: 'Total diario actual' },
        current_note: { type: 'text', label: 'Nota al pie del recibo', maxLength: 60 },
        // `text` y no `money` a propósito: la referencia muestra "$7.5M+", una
        // aproximación redonda que comunica mejor que la cifra exacta. Forzar un
        // entero obligaría a escribir 7.540.000 y a perder el "+".
        savings_value: {
          type: 'text',
          label: 'Cifra del ahorro',
          help: 'Se muestra en grande. Ejemplo: $7.5M+',
          maxLength: 20,
        },
      },
    };
  }

  if (section.key === 'bundle') {
    return {
      ...section,
      fields: {
        ...section.fields,
        badge_label: { type: 'text', label: 'Etiqueta sobre cada regalo', maxLength: 12 },
      },
    };
  }

  if (section.key === 'offer') {
    return {
      ...section,
      fields: {
        ...section.fields,
        product_name: { type: 'text', label: 'Producto en la tarjeta', maxLength: 40 },
        product_subtitle: { type: 'text', label: 'Subtítulo del producto', maxLength: 40 },
        bonuses_label: { type: 'text', label: 'Título de los bonos', maxLength: 30 },
        bonuses: {
          type: 'list',
          label: 'Bonos incluidos',
          maxItems: 4,
          itemSchema: {
            label: { type: 'text', label: 'Bono', required: true, maxLength: 40 },
            value_amount: { type: 'money', label: 'Valor tachado' },
            badge: { type: 'text', label: 'Etiqueta', maxLength: 12 },
          },
        },
        payment_label: { type: 'text', label: 'Título de medios de pago', maxLength: 40 },
        payment_note: { type: 'text', label: 'Medio de pago', maxLength: 60 },
        closing_note: { type: 'text', label: 'Cierre bajo la tarjeta', maxLength: 80 },
      },
    };
  }

  return section;
}
