/**
 * Traducción entre el `content_schema` y un formulario HTML.
 *
 * El editor no está escrito a mano para cada plantilla: se genera desde la
 * declaración. Ese es el punto del contrato (§7.4) — una plantilla nueva trae
 * su editor sin tocar el dashboard.
 *
 * Un `<form>` solo sabe de pares nombre/valor planos, así que hace falta una
 * convención para representar estructura. La de aquí:
 *
 *     hero.headline                  campo simple
 *     faq.items.0.question           elemento 0 de una lista
 *
 * `codificarNombre` la escribe y `interpretarFormulario` la deshace.
 */

import type { ContentSchema, FieldDef, SectionDef } from '@nitro-web/contracts';

export const SEPARADOR = '.';

export function codificarNombre(...partes: (string | number)[]): string {
  return partes.join(SEPARADOR);
}

/**
 * Reconstruye el JSON de contenido a partir de los campos del formulario.
 *
 * Solo considera las claves que el schema declara: una entrada inventada por
 * quien manipule el formulario no llega al contenido. El validador estricto la
 * rechazaría después, pero descartarla aquí evita depender de eso.
 */
export function interpretarFormulario(
  schema: ContentSchema,
  datos: FormData,
): Record<string, unknown> {
  const contenido: Record<string, unknown> = {};

  for (const seccion of schema.sections) {
    const valores: Record<string, unknown> = {};

    for (const [claveCampo, campo] of Object.entries(seccion.fields)) {
      const base = codificarNombre(seccion.key, claveCampo);

      if (campo.type === 'list') {
        const elementos = leerLista(campo, base, datos);
        if (elementos.length > 0) valores[claveCampo] = elementos;
        continue;
      }

      const valor = leerCampo(campo, base, datos);
      if (valor !== undefined) valores[claveCampo] = valor;
    }

    if (Object.keys(valores).length > 0) contenido[seccion.key] = valores;
  }

  return contenido;
}

function leerLista(campo: FieldDef, base: string, datos: FormData): Record<string, unknown>[] {
  const itemSchema = campo.itemSchema ?? {};
  const elementos: Record<string, unknown>[] = [];

  // Los índices no son necesariamente contiguos: borrar un elemento en la
  // interfaz deja un hueco. Se recorre por lo que realmente llegó.
  const indices = new Set<number>();
  for (const clave of datos.keys()) {
    if (!clave.startsWith(`${base}${SEPARADOR}`)) continue;
    const resto = clave.slice(base.length + 1);
    const indice = Number.parseInt(resto.split(SEPARADOR)[0] ?? '', 10);
    if (Number.isInteger(indice)) indices.add(indice);
  }

  for (const indice of [...indices].sort((a, b) => a - b)) {
    const elemento: Record<string, unknown> = {};

    for (const [claveCampo, subcampo] of Object.entries(itemSchema)) {
      const valor = leerCampo(subcampo, codificarNombre(base, indice, claveCampo), datos);
      if (valor !== undefined) elemento[claveCampo] = valor;
    }

    // Un elemento del que no quedó ningún campo es una fila que el usuario
    // vació: se descarta en vez de guardar un objeto vacío que el validador
    // rechazaría con un mensaje incomprensible.
    if (Object.keys(elemento).length > 0) elementos.push(elemento);
  }

  return elementos;
}

function leerCampo(campo: FieldDef, nombre: string, datos: FormData): unknown {
  // Un checkbox ausente significa `false`, no "sin valor". Es el único tipo
  // donde la ausencia es información.
  if (campo.type === 'boolean') return datos.get(nombre) !== null;

  const crudo = datos.get(nombre);
  if (crudo === null) return undefined;

  const texto = String(crudo).trim();
  if (texto === '') return undefined;

  if (campo.type === 'number' || campo.type === 'money') {
    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : undefined;
  }

  return texto;
}

/** Valor actual de un campo dentro del contenido guardado. */
export function valorDe(contenido: Record<string, unknown>, ruta: (string | number)[]): unknown {
  let actual: unknown = contenido;
  for (const parte of ruta) {
    if (actual === null || typeof actual !== 'object') return undefined;
    actual = (actual as Record<string | number, unknown>)[parte];
  }
  return actual;
}

/** Elementos actuales de una lista, siempre como arreglo. */
export function elementosDe(
  contenido: Record<string, unknown>,
  seccion: string,
  campo: string,
): Record<string, unknown>[] {
  const valor = valorDe(contenido, [seccion, campo]);
  if (!Array.isArray(valor)) return [];
  return valor.filter(
    (v): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v),
  );
}

/**
 * Cuántas filas dibujar para una lista: las que hay más una vacía.
 *
 * La fila extra es lo que permite añadir sin JavaScript. Se acota por
 * `maxItems` para no ofrecer una casilla que el validador va a rechazar.
 */
export function filasDeLista(actuales: number, campo: FieldDef): number {
  const maximo = campo.maxItems ?? actuales + 1;
  return Math.min(actuales + 1, maximo);
}

/** Secciones ordenadas tal como las declara la plantilla. */
export function seccionesDe(schema: ContentSchema): SectionDef[] {
  return schema.sections;
}
