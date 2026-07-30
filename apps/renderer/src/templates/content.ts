/**
 * Lectura defensiva del contenido de una landing.
 *
 * El `content_json` llega validado contra el `content_schema`, pero llega
 * tipado como `unknown`: es un documento JSON, no una interfaz. Estos ayudantes
 * evitan que cada componente repita comprobaciones y, sobre todo, evitan que un
 * campo ausente tumbe la página.
 *
 * El criterio es siempre el mismo: **ante un dato que falta o no tiene la forma
 * esperada, no renderizar esa parte**. Una sección que desaparece es un problema
 * de contenido; una excepción en producción es una campaña caída.
 */

export type Section = Record<string, unknown>;

/** Devuelve una sección del contenido, o un objeto vacío si no existe. */
export function section(content: Record<string, unknown>, key: string): Section {
  const value = content[key];
  return isPlainObject(value) ? value : {};
}

/** Texto de un campo, o `undefined` si está vacío o no es texto. */
export function text(source: Section, key: string): string | undefined {
  const value = source[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Número de un campo (precios, valores), o `undefined`. */
export function num(source: Section, key: string): number | undefined {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function bool(source: Section, key: string): boolean {
  return source[key] === true;
}

/** Lista de elementos de un campo `list`. Siempre devuelve un arreglo. */
export function list(source: Section, key: string): Section[] {
  const value = source[key];
  if (!Array.isArray(value)) return [];
  return value.filter(isPlainObject);
}

/**
 * URL pública de un asset a partir de su id.
 *
 * El contenido guarda `assets.id`, no una URL (ADR 0003): así, rotar el bucket o
 * cambiar de CDN no obliga a reescribir el contenido de todas las landings. Ese
 * id **no** es la ruta en Storage —que tiene la forma
 * `<tenant_id>/<site_id>/<archivo>`—, así que hay que traducirlo con el índice
 * que trae `ResolvedSite.assets`.
 *
 * Un id que no está en el índice devuelve `undefined`, y quien llama oculta esa
 * parte de la página: mejor una sección sin imagen que un `<img>` roto.
 */
export function assetUrl(
  assetId: unknown,
  assets: Record<string, string>,
): string | undefined {
  if (typeof assetId !== 'string' || assetId === '') return undefined;

  const storagePath = assets[assetId];
  if (!storagePath) return undefined;

  // Las imágenes que forman parte del código de una plantilla no viven en el
  // bucket del tenant. El prefijo explícito evita confundirlas con storage_path
  // y solo acepta el directorio público reservado para plantillas.
  if (storagePath.startsWith('template:/templates/')) {
    return storagePath.slice('template:'.length);
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return undefined;

  return `${base}/storage/v1/object/public/site-assets/${storagePath}`;
}

function isPlainObject(value: unknown): value is Section {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
