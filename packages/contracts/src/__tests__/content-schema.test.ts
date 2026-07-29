import { describe, expect, it } from 'vitest';
import {
  buildAiJsonSchema,
  compileContentValidator,
  mergeAiContent,
  parseContentSchema,
  type ContentSchema,
} from '../content-schema';

const schema: ContentSchema = {
  version: 1,
  sections: [
    {
      key: 'hero',
      label: 'Encabezado',
      aiGeneratable: true,
      fields: {
        title: { type: 'text', label: 'Título', required: true, maxLength: 80 },
        subtitle: { type: 'textarea', label: 'Subtítulo', maxLength: 200 },
        price_amount: { type: 'money', label: 'Precio', required: true },
        image: { type: 'image', label: 'Imagen', assetSlot: 'hero' },
        cta_url: { type: 'url', label: 'Enlace del CTA' },
      },
    },
    {
      key: 'faq',
      label: 'Preguntas frecuentes',
      aiGeneratable: true,
      fields: {
        items: {
          type: 'list',
          label: 'Preguntas',
          maxItems: 3,
          itemSchema: {
            question: { type: 'text', label: 'Pregunta', required: true },
            answer: { type: 'textarea', label: 'Respuesta', required: true },
          },
        },
      },
    },
  ],
};

describe('parseContentSchema', () => {
  it('acepta un schema bien formado', () => {
    expect(() => parseContentSchema(schema)).not.toThrow();
  });

  it('rechaza claves de sección que no son snake_case', () => {
    expect(() =>
      parseContentSchema({
        version: 1,
        sections: [{ key: 'Hero-Section', label: 'x', fields: {} }],
      }),
    ).toThrow();
  });

  it('rechaza un select sin opciones', () => {
    expect(() =>
      parseContentSchema({
        version: 1,
        sections: [
          { key: 'x', label: 'x', fields: { f: { type: 'select', label: 'f' } } },
        ],
      }),
    ).toThrow();
  });

  it('rechaza una lista sin itemSchema', () => {
    expect(() =>
      parseContentSchema({
        version: 1,
        sections: [{ key: 'x', label: 'x', fields: { f: { type: 'list', label: 'f' } } }],
      }),
    ).toThrow();
  });
});

describe('compileContentValidator', () => {
  const validate = compileContentValidator(schema);

  it('acepta contenido válido', () => {
    const result = validate.safeParse({
      hero: {
        title: 'Cafetera Espresso Pro',
        subtitle: 'Calidad de cafetería en casa',
        price_amount: 490000,
        image: '11111111-1111-1111-1111-111111111111',
        cta_url: 'https://ejemplo.com',
      },
      faq: { items: [{ question: '¿Envío?', answer: 'Gratis a todo el país' }] },
    });
    expect(result.success).toBe(true);
  });

  it('rechaza secciones que el schema no declara', () => {
    // Es la defensa contra una IA que inventa secciones (§8.3).
    const result = validate.safeParse({
      hero: { title: 'x', price_amount: 1 },
      seccion_inventada: { foo: 'bar' },
    });
    expect(result.success).toBe(false);
  });

  it('rechaza un campo obligatorio vacío', () => {
    const result = validate.safeParse({ hero: { title: '', price_amount: 1 } });
    expect(result.success).toBe(false);
  });

  it('aplica el límite de longitud', () => {
    const result = validate.safeParse({
      hero: { title: 'a'.repeat(81), price_amount: 1 },
    });
    expect(result.success).toBe(false);
  });

  it('rechaza un precio no entero', () => {
    // El dinero se guarda en unidad mínima: 490000.5 no existe en COP.
    const result = validate.safeParse({ hero: { title: 'x', price_amount: 490000.5 } });
    expect(result.success).toBe(false);
  });

  it('rechaza una URL con esquema peligroso', () => {
    const result = validate.safeParse({
      hero: { title: 'x', price_amount: 1, cta_url: 'javascript:alert(1)' },
    });
    expect(result.success).toBe(false);
  });

  it('rechaza una imagen que no es referencia a un asset', () => {
    const result = validate.safeParse({
      hero: { title: 'x', price_amount: 1, image: 'https://cdn.externo.com/foto.jpg' },
    });
    expect(result.success).toBe(false);
  });

  it('aplica el máximo de elementos de una lista', () => {
    const items = Array.from({ length: 4 }, (_, i) => ({
      question: `p${i}`,
      answer: `r${i}`,
    }));
    const result = validate.safeParse({ hero: { title: 'x', price_amount: 1 }, faq: { items } });
    expect(result.success).toBe(false);
  });
});

describe('buildAiJsonSchema', () => {
  it('excluye precios e imágenes del alcance de la IA', () => {
    const json = buildAiJsonSchema(schema);
    const heroProps = json.properties?.hero?.properties ?? {};
    expect(Object.keys(heroProps)).toContain('title');
    expect(Object.keys(heroProps)).toContain('subtitle');
    // Un precio inventado por el modelo es un problema legal, no un error de UX.
    expect(Object.keys(heroProps)).not.toContain('price_amount');
    expect(Object.keys(heroProps)).not.toContain('image');
    // Una URL inventada es un enlace roto en una campaña pagada.
    expect(Object.keys(heroProps)).not.toContain('cta_url');
  });

  it('limita la salida a las secciones pedidas', () => {
    const json = buildAiJsonSchema(schema, ['faq']);
    expect(Object.keys(json.properties ?? {})).toEqual(['faq']);
  });
});

describe('mergeAiContent', () => {
  it('conserva los campos que la IA no puede escribir', () => {
    const current = {
      hero: {
        title: 'Título original',
        price_amount: 490000,
        image: '11111111-1111-1111-1111-111111111111',
      },
    };

    // El modelo devuelve de más: intenta cambiar el precio y la imagen.
    const merged = mergeAiContent(schema, current, {
      hero: {
        title: 'Título generado',
        price_amount: 1,
        image: 'algo-inventado',
      },
    });

    expect(merged.hero?.title).toBe('Título generado');
    expect(merged.hero?.price_amount).toBe(490000);
    expect(merged.hero?.image).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('ignora secciones que el schema no declara', () => {
    const merged = mergeAiContent(schema, {}, { seccion_inventada: { x: 1 } });
    expect(merged.seccion_inventada).toBeUndefined();
  });
});
