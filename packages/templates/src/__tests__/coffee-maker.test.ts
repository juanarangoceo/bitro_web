import { describe, expect, it } from 'vitest';
import {
  buildAiJsonSchema,
  compileContentValidator,
  parseContentSchema,
  validateManifest,
  type ContentSchema,
} from '@nitro-web/contracts';
import { coffeeMakerManifest } from '../coffee-maker/manifest';
import { coffeeMakerContentSchema } from '../coffee-maker/schema';
import { coffeeMakerDefaultContent } from '../coffee-maker/default-content';
import { coffeeMakerManifestV11 } from '../coffee-maker/manifest-v1-1';
import { coffeeMakerContentSchemaV11 } from '../coffee-maker/schema-v1-1';
import { coffeeMakerDefaultContentV11 } from '../coffee-maker/default-content-v1-1';
import { coffeeMakerManifestV12 } from '../coffee-maker/manifest-v1-2';
import { coffeeMakerContentSchemaV12 } from '../coffee-maker/schema-v1-2';
import { coffeeMakerDefaultContentV12 } from '../coffee-maker/default-content-v1-2';
import { isComponentRegistered } from '../registry';

describe('manifest de coffee-maker', () => {
  it('cumple el contrato de plantilla', () => {
    const result = validateManifest(coffeeMakerManifest);
    if (!result.ok) {
      throw new Error(`Manifest inválido:\n  ${result.errors.join('\n  ')}`);
    }
    expect(result.ok).toBe(true);
  });

  it('declara un component_key que el renderer sabe dibujar', () => {
    // Publicar una plantilla cuyo componente no existe produce una landing en
    // blanco en producción. Se verifica antes de publicar (runbook R4).
    expect(isComponentRegistered(coffeeMakerManifest.component_key)).toBe(true);
  });

  it('tiene un content_schema bien formado', () => {
    expect(() => parseContentSchema(coffeeMakerContentSchema)).not.toThrow();
  });
});

describe('contenido por defecto', () => {
  it('es válido como borrador', () => {
    const validate = compileContentValidator(coffeeMakerContentSchema, 'draft');
    const result = validate.safeParse(coffeeMakerDefaultContent);
    if (!result.success) {
      throw new Error(
        `default_content inválido:\n  ${result.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('\n  ')}`,
      );
    }
    expect(result.success).toBe(true);
  });

  it('NO es publicable tal cual: faltan las imágenes del cliente', () => {
    // Esta es la fricción correcta, no un defecto. Nadie debería publicar una
    // landing con las fotos de otro producto: el checklist de primera
    // publicación se apoya justo en este fallo (§9.1).
    const validate = compileContentValidator(coffeeMakerContentSchema, 'publish');
    const result = validate.safeParse(coffeeMakerDefaultContent);
    expect(result.success).toBe(false);

    const rutas = result.success
      ? []
      : result.error.issues.map((i) => i.path.join('.'));
    expect(rutas).toContain('hero.image_mobile');
    expect(rutas).toContain('hero.image_desktop');
  });

  it('no referencia imágenes: un sitio nuevo no tiene assets', () => {
    const hero = coffeeMakerDefaultContent.hero ?? {};
    expect(hero.image_mobile).toBeUndefined();
    expect(hero.image_desktop).toBeUndefined();
  });

  it('cubre todas las secciones del schema salvo la de testimonios', () => {
    // Los testimonios se dejan vacíos a propósito: un testimonio de ejemplo
    // publicado por descuido es prueba social falsa.
    const claves = new Set(Object.keys(coffeeMakerDefaultContent));
    for (const section of coffeeMakerContentSchema.sections) {
      expect(claves.has(section.key)).toBe(true);
    }
    expect(coffeeMakerDefaultContent.social_proof?.testimonials).toEqual([]);
  });
});

describe('alcance de la IA', () => {
  const aiSchema = buildAiJsonSchema(coffeeMakerContentSchema);

  it('no expone precios ni imágenes al modelo', () => {
    const json = JSON.stringify(aiSchema);
    expect(json).not.toContain('price_amount');
    expect(json).not.toContain('value_amount');
    expect(json).not.toContain('image_mobile');
    expect(json).not.toContain('social_image');
  });

  it('no permite al modelo escribir testimonios', () => {
    expect(aiSchema.properties?.social_proof).toBeUndefined();
  });

  it('sí permite generar el encabezado y las preguntas frecuentes', () => {
    expect(aiSchema.properties?.hero?.properties?.headline).toBeDefined();
    expect(aiSchema.properties?.faq?.properties?.items).toBeDefined();
  });

  it('las secciones declaradas en ai_sections coinciden con las generables', () => {
    const generables = new Set(Object.keys(aiSchema.properties ?? {}));
    for (const key of coffeeMakerManifest.ai_sections) {
      expect(generables.has(key)).toBe(true);
    }
  });
});

describe('coffee-maker 1.1', () => {
  it('cumple el contrato y tiene un componente registrado', () => {
    const result = validateManifest(coffeeMakerManifestV11);
    if (!result.ok) {
      throw new Error(`Manifest 1.1 inválido:\n  ${result.errors.join('\n  ')}`);
    }

    expect(coffeeMakerManifestV11.version).toBe('1.1.0');
    expect(isComponentRegistered(coffeeMakerManifestV11.component_key)).toBe(true);
    expect(() => parseContentSchema(coffeeMakerContentSchemaV11)).not.toThrow();
  });

  it('es un borrador válido pero exige las imágenes del cliente para publicar', () => {
    const draft = compileContentValidator(coffeeMakerContentSchemaV11, 'draft')
      .safeParse(coffeeMakerDefaultContentV11);
    expect(draft.success).toBe(true);

    const publication = compileContentValidator(coffeeMakerContentSchemaV11, 'publish')
      .safeParse(coffeeMakerDefaultContentV11);
    expect(publication.success).toBe(false);
    const routes = publication.success
      ? []
      : publication.error.issues.map((issue) => issue.path.join('.'));
    expect(routes).toContain('hero.image_mobile');
    expect(routes).toContain('hero.image_desktop');
    expect(routes).toContain('hotspots.image');
  });

  it('la IA no controla imágenes, coordenadas ni la fecha límite', () => {
    const schema = JSON.stringify(buildAiJsonSchema(coffeeMakerContentSchemaV11));
    expect(schema).not.toContain('image_mobile');
    expect(schema).not.toContain('countdown_ends_at');
    expect(schema).not.toContain('"x"');
    expect(schema).not.toContain('"y"');
  });
});

describe('coffee-maker 1.2', () => {
  it('cumple el contrato y registra un componente propio', () => {
    const result = validateManifest(coffeeMakerManifestV12);
    if (!result.ok) {
      throw new Error(`Manifest 1.2 inválido:\n  ${result.errors.join('\n  ')}`);
    }
    expect(coffeeMakerManifestV12.version).toBe('1.2.0');
    expect(coffeeMakerManifestV12.component_key).toBe('coffeeMakerV12');
    expect(isComponentRegistered(coffeeMakerManifestV12.component_key)).toBe(true);
  });

  it('restaura el vídeo, cuatro recetas y valores del kit', () => {
    expect(coffeeMakerDefaultContentV12.problem?.video_url).toContain('cloudinary.com');
    expect(coffeeMakerDefaultContentV12.recipes?.items).toHaveLength(4);
    expect(coffeeMakerDefaultContentV12.bundle?.items).toHaveLength(2);
    // 22.000 al día por 365 días. El gasto anual y el total diario tienen que
    // cuadrar entre sí: son la misma factura leída de dos formas, y una
    // incoherencia ahí es exactamente el detalle que destruye el argumento.
    expect(coffeeMakerDefaultContentV12.savings?.current_total_amount).toBe(22000);
    expect(coffeeMakerDefaultContentV12.savings?.current_annual_amount).toBe(8030000);
  });

  it('no deja el recuadro del ahorro sin cifra', () => {
    // El defecto que motivó la 1.2: `savings_headline` se dibujaba dentro de un
    // recuadro destacado y la cifra no existía en el contrato, así que el bloque
    // salía vacío en producción.
    const savings = seccion(coffeeMakerContentSchemaV12, 'savings');
    expect(savings.fields.savings_value).toBeDefined();
    expect(coffeeMakerDefaultContentV12.savings?.savings_value).toBeTruthy();
  });

  it('saca marca, navegación y pie del código de la plantilla', () => {
    // Con la marca escrita dentro del componente, el segundo tenant que
    // instalara la plantilla vería en su cabecera la marca del primero.
    expect(seccion(coffeeMakerContentSchemaV12, 'brand').fields.name?.required).toBe(true);
    expect(coffeeMakerDefaultContentV12.brand?.name).toBeTruthy();
    expect(coffeeMakerDefaultContentV12.footer?.explore_links).toBeInstanceOf(Array);
  });

  it('deja marca y pie fuera del alcance de la IA', () => {
    // Un modelo que redacte la columna legal inventa una política que no existe.
    expect(coffeeMakerManifestV12.ai_sections).not.toContain('brand');
    expect(coffeeMakerManifestV12.ai_sections).not.toContain('footer');
  });
});

function seccion(schema: ContentSchema, key: string) {
  const encontrada = schema.sections.find((s) => s.key === key);
  if (!encontrada) throw new Error(`La 1.2 debería declarar la sección '${key}'`);
  return encontrada;
}
