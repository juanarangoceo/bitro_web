import { describe, expect, it } from 'vitest';
import {
  buildAiJsonSchema,
  compileContentValidator,
  parseContentSchema,
  validateManifest,
} from '@nitro-web/contracts';
import { coffeeMakerManifest } from '../coffee-maker/manifest';
import { coffeeMakerContentSchema } from '../coffee-maker/schema';
import { coffeeMakerDefaultContent } from '../coffee-maker/default-content';
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
