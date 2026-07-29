/**
 * El `content_schema` de una plantilla.
 *
 * Es la pieza central del producto. Una sola declaración de datos alimenta tres
 * consumidores que, de otro modo, se desincronizarían entre sí:
 *
 *   1. El **editor** del dashboard, que se construye a partir del schema en vez
 *      de tener un formulario a medida por plantilla (§4.4).
 *   2. La **validación** de lo que se guarda y de lo que se publica: un JSON
 *      inválido nunca llega a un snapshot.
 *   3. La **IA**, que recibe un JSON Schema derivado de aquí y por tanto no
 *      puede inventar secciones ni renombrar campos (§8.3).
 *
 * Añadir un tipo de campo aquí lo habilita en los tres a la vez.
 */

import { z } from 'zod';

// -----------------------------------------------------------------------------
// Tipos de campo
// -----------------------------------------------------------------------------

/**
 * Tipos admitidos.
 *
 * Deliberadamente NO existe un tipo `html` ni `richtext`: permitir HTML libre
 * abriría XSS en páginas públicas de terceros y dejaría al cliente romper el
 * diseño, que es justo lo que el principio de "autoservicio controlado" prohíbe.
 */
export const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'money',
  'boolean',
  'image',
  'url',
  'select',
  'list',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

/** Definición de un campo editable. */
export interface FieldDef {
  type: FieldType;
  /** Etiqueta que ve el cliente en el editor. */
  label: string;
  /** Ayuda contextual corta (§9.1). */
  help?: string;
  required?: boolean;

  /** `text` y `textarea`. El límite se aplica también a la salida de la IA. */
  maxLength?: number;
  minLength?: number;

  /** `number` y `money`. */
  min?: number;
  max?: number;

  /** `select`. */
  options?: ReadonlyArray<{ value: string; label: string }>;

  /** `list`: forma de cada elemento. */
  itemSchema?: Record<string, FieldDef>;
  maxItems?: number;
  minItems?: number;

  /** `image`: slot declarado en `asset_slots` del manifest. */
  assetSlot?: string;

  /**
   * ¿La IA puede escribir este campo?
   *
   * Por defecto `true` para texto. Se pone en `false` en campos que el modelo
   * no debe tocar —precios, URLs, referencias a imágenes— porque inventarlos
   * produciría afirmaciones falsas o enlaces rotos (§8.3).
   */
  aiEditable?: boolean;
}

/** Una sección de la landing. */
export interface SectionDef {
  key: string;
  label: string;
  description?: string;
  fields: Record<string, FieldDef>;
  /** ¿Se puede regenerar completa con IA? (`ai_sections` del manifest.) */
  aiGeneratable?: boolean;
}

/** El schema completo de contenido de una versión de plantilla. */
export interface ContentSchema {
  /** Versión del formato del schema, no de la plantilla. */
  version: 1;
  sections: SectionDef[];
}

// -----------------------------------------------------------------------------
// Validación del schema en sí
// -----------------------------------------------------------------------------

const fieldDefSchema: z.ZodType<FieldDef> = z.lazy(() =>
  z
    .object({
      type: z.enum(FIELD_TYPES),
      label: z.string().min(1),
      help: z.string().optional(),
      required: z.boolean().optional(),
      maxLength: z.number().int().positive().optional(),
      minLength: z.number().int().nonnegative().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
      itemSchema: z.record(z.string(), fieldDefSchema).optional(),
      maxItems: z.number().int().positive().optional(),
      minItems: z.number().int().nonnegative().optional(),
      assetSlot: z.string().optional(),
      aiEditable: z.boolean().optional(),
    })
    .superRefine((field, ctx) => {
      // Un `select` sin opciones es un desplegable vacío: el cliente no puede
      // elegir nada y la IA no tiene dominio válido del que escoger.
      if (field.type === 'select' && (!field.options || field.options.length === 0)) {
        ctx.addIssue({ code: 'custom', message: 'Un campo `select` requiere `options`' });
      }
      // Una `list` sin `itemSchema` no define qué contiene cada elemento.
      if (field.type === 'list' && !field.itemSchema) {
        ctx.addIssue({ code: 'custom', message: 'Un campo `list` requiere `itemSchema`' });
      }
    }),
);

export const contentSchemaSchema = z.object({
  version: z.literal(1),
  sections: z
    .array(
      z.object({
        key: z
          .string()
          .min(1)
          .regex(/^[a-z][a-z0-9_]*$/, 'La clave debe ser snake_case en minúsculas'),
        label: z.string().min(1),
        description: z.string().optional(),
        fields: z.record(z.string(), fieldDefSchema),
        aiGeneratable: z.boolean().optional(),
      }),
    )
    .min(1),
});

/** Valida que un `content_schema` esté bien formado. */
export function parseContentSchema(input: unknown): ContentSchema {
  return contentSchemaSchema.parse(input) as ContentSchema;
}

// -----------------------------------------------------------------------------
// Compilación a validador de contenido
// -----------------------------------------------------------------------------

/**
 * Modo de validación del contenido.
 *
 * La diferencia importa porque un borrador y una publicación tienen exigencias
 * distintas (§4.5): el cliente guarda a medio llenar y vuelve mañana, pero lo
 * que sale a producción con tráfico pagado encima debe estar completo.
 *
 * - `draft`   — todo opcional. Los tipos y los límites sí se validan: un precio
 *               con letras o un titular de 500 caracteres son errores incluso a
 *               medias.
 * - `publish` — se exige además lo obligatorio. Es la puerta que el checklist de
 *               primera publicación usa para bloquear (§9.1).
 *
 * En ambos modos una sección o campo desconocido es un error: eso no es
 * "incompleto", es contenido que la plantilla no sabe dibujar.
 */
export type ValidationMode = 'draft' | 'publish';

/**
 * Construye un validador Zod para el contenido de una plantilla.
 *
 * El resultado valida el `content_json` completo: `{ [sectionKey]: { [fieldKey]: valor } }`.
 *
 * Se usa al guardar el borrador (`draft`), al publicar (`publish`, una segunda
 * vez porque el schema pudo endurecerse entre ambos momentos) y al recibir la
 * salida de la IA (`draft`, ya que el modelo devuelve solo algunas secciones).
 */
export function compileContentValidator(
  schema: ContentSchema,
  mode: ValidationMode = 'publish',
): z.ZodType<ContentJson> {
  const sectionShape: Record<string, z.ZodTypeAny> = {};

  for (const section of schema.sections) {
    const fieldShape: Record<string, z.ZodTypeAny> = {};
    for (const [fieldKey, field] of Object.entries(section.fields)) {
      fieldShape[fieldKey] = compileField(field, mode);
    }
    // La sección entera puede faltar: un borrador recién creado no tiene todas.
    sectionShape[section.key] = z.object(fieldShape).optional();
  }

  // `strict()`: una clave desconocida es un error, no algo que ignorar. Es lo
  // que impide que la IA agregue secciones inventadas (§8.3).
  return z.object(sectionShape).strict() as unknown as z.ZodType<ContentJson>;
}

/** Contenido de una landing: secciones → campos → valores. */
export type ContentJson = Record<string, Record<string, unknown> | undefined>;

function compileField(field: FieldDef, mode: ValidationMode): z.ZodTypeAny {
  const validator = compileFieldBase(field, mode);

  // En borrador todo puede faltar. Al publicar, lo obligatorio se exige: un
  // titular en blanco pasa cualquier validación de tipo pero rompe la landing.
  if (mode === 'draft' || !field.required) {
    return validator.optional().nullable();
  }

  return validator;
}

function compileFieldBase(field: FieldDef, mode: ValidationMode): z.ZodTypeAny {
  switch (field.type) {
    case 'text':
    case 'textarea': {
      let s = z.string();
      // El mínimo solo aplica al publicar: en borrador se admite vacío, pero el
      // máximo se respeta siempre para que el editor avise mientras se escribe.
      if (mode === 'publish') {
        if (field.required) s = s.min(Math.max(field.minLength ?? 1, 1));
        else if (field.minLength !== undefined) s = s.min(field.minLength);
      }
      if (field.maxLength !== undefined) s = s.max(field.maxLength);
      return s;
    }

    case 'url':
      // `url()` de Zod acepta cualquier esquema; restringimos a http(s) para que
      // un `javascript:` no llegue nunca a un `href` renderizado.
      return z
        .string()
        .url()
        .refine((v) => /^https?:\/\//i.test(v), 'Solo se admiten URLs http o https');

    case 'number': {
      let n = z.number();
      if (field.min !== undefined) n = n.min(field.min);
      if (field.max !== undefined) n = n.max(field.max);
      return n;
    }

    case 'money': {
      // Entero en la unidad mínima de la moneda: el dinero nunca es float.
      let n = z.number().int().nonnegative();
      if (field.min !== undefined) n = n.min(field.min);
      if (field.max !== undefined) n = n.max(field.max);
      return n;
    }

    case 'boolean':
      return z.boolean();

    case 'image':
      // Referencia a `assets.id`. El renderer la resuelve a una URL firmada o
      // pública; guardar la URL directamente rompería al rotar el bucket.
      //
      // `guid()` y no `uuid()`: el segundo exige los bits de versión/variante de
      // la RFC, lo que ataría el contenido a la versión de UUID que use Postgres
      // hoy. Lo que necesitamos verificar es que sea un identificador nuestro y
      // no una URL externa, y para eso basta la forma.
      return z.guid();

    case 'select': {
      const values = (field.options ?? []).map((o) => o.value);
      if (values.length === 0) return z.never();
      return z.string().refine((v) => values.includes(v), {
        message: `Valor fuera del dominio permitido: ${values.join(', ')}`,
      });
    }

    case 'list': {
      const itemShape: Record<string, z.ZodTypeAny> = {};
      for (const [key, itemField] of Object.entries(field.itemSchema ?? {})) {
        itemShape[key] = compileField(itemField, mode);
      }
      let arr = z.array(z.object(itemShape).strict());
      if (field.minItems !== undefined) arr = arr.min(field.minItems);
      // Un tope por defecto evita que una lista sin límite explote el peso de la
      // página y el costo de transferencia (§9, riesgo de costos).
      arr = arr.max(field.maxItems ?? 50);
      return arr;
    }
  }
}

// -----------------------------------------------------------------------------
// Derivación de JSON Schema para la IA
// -----------------------------------------------------------------------------

/** Nodo de JSON Schema, en el subconjunto que admiten las APIs de modelos. */
export interface JsonSchemaNode {
  type: string;
  description?: string;
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  items?: JsonSchemaNode;
  enum?: string[];
  maxLength?: number;
  minLength?: number;
  maxItems?: number;
}

/**
 * Deriva el JSON Schema que se le entrega al modelo como formato de respuesta.
 *
 * Solo incluye campos con `aiEditable` activo. Los precios, URLs y referencias a
 * imágenes quedan fuera a propósito: si el modelo pudiera escribirlos,
 * inventaría cifras y enlaces que después se muestran a compradores reales.
 *
 * @param sectionKeys Limita la salida a estas secciones (generación por sección).
 */
export function buildAiJsonSchema(
  schema: ContentSchema,
  sectionKeys?: readonly string[],
): JsonSchemaNode {
  const sections = sectionKeys
    ? schema.sections.filter((s) => sectionKeys.includes(s.key))
    : schema.sections.filter((s) => s.aiGeneratable !== false);

  const properties: Record<string, JsonSchemaNode> = {};
  const required: string[] = [];

  for (const section of sections) {
    const fieldProps: Record<string, JsonSchemaNode> = {};
    const fieldRequired: string[] = [];

    for (const [fieldKey, field] of Object.entries(section.fields)) {
      if (!isAiEditable(field)) continue;
      fieldProps[fieldKey] = fieldToJsonSchema(field);
      if (field.required) fieldRequired.push(fieldKey);
    }

    if (Object.keys(fieldProps).length === 0) continue;

    properties[section.key] = {
      type: 'object',
      description: section.description ?? section.label,
      properties: fieldProps,
      required: fieldRequired,
    };
    required.push(section.key);
  }

  return { type: 'object', properties, required };
}

/**
 * ¿Puede la IA escribir este campo?
 *
 * Por defecto sí para texto libre, y no para todo lo demás. Un campo puede
 * activarlo explícitamente, pero `money` e `image` nunca: un precio inventado
 * es un problema legal y una imagen inventada es un enlace roto.
 */
function isAiEditable(field: FieldDef): boolean {
  if (field.type === 'money' || field.type === 'image') return false;
  if (field.aiEditable !== undefined) return field.aiEditable;
  return field.type === 'text' || field.type === 'textarea' || field.type === 'list';
}

function fieldToJsonSchema(field: FieldDef): JsonSchemaNode {
  const base: JsonSchemaNode = { type: 'string', description: field.label };

  switch (field.type) {
    case 'text':
    case 'textarea':
      if (field.maxLength !== undefined) base.maxLength = field.maxLength;
      if (field.minLength !== undefined) base.minLength = field.minLength;
      return base;

    case 'number':
    case 'money':
      return { type: 'number', description: field.label };

    case 'boolean':
      return { type: 'boolean', description: field.label };

    case 'select':
      return {
        type: 'string',
        description: field.label,
        enum: (field.options ?? []).map((o) => o.value),
      };

    case 'list': {
      const itemProps: Record<string, JsonSchemaNode> = {};
      const itemRequired: string[] = [];
      for (const [key, itemField] of Object.entries(field.itemSchema ?? {})) {
        if (!isAiEditable(itemField)) continue;
        itemProps[key] = fieldToJsonSchema(itemField);
        if (itemField.required) itemRequired.push(key);
      }
      return {
        type: 'array',
        description: field.label,
        maxItems: field.maxItems ?? 10,
        items: { type: 'object', properties: itemProps, required: itemRequired },
      };
    }

    default:
      return base;
  }
}

/**
 * Fusiona la salida de la IA sobre el contenido existente.
 *
 * Solo se aceptan secciones y campos que el schema declara como editables por
 * IA. Todo lo demás del contenido previo se conserva intacto: así, aunque el
 * modelo devuelva claves de más, no pueden sobrescribir un precio ni una imagen.
 */
export function mergeAiContent(
  schema: ContentSchema,
  current: ContentJson,
  aiOutput: Record<string, unknown>,
): ContentJson {
  const merged: ContentJson = { ...current };

  for (const section of schema.sections) {
    const incoming = aiOutput[section.key];
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) continue;

    const currentSection = current[section.key] ?? {};
    const nextSection: Record<string, unknown> = { ...currentSection };

    for (const [fieldKey, field] of Object.entries(section.fields)) {
      if (!isAiEditable(field)) continue;
      const value = (incoming as Record<string, unknown>)[fieldKey];
      if (value === undefined) continue;
      nextSection[fieldKey] = value;
    }

    merged[section.key] = nextSection;
  }

  return merged;
}
