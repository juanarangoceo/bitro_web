/**
 * Normalización de datos de contacto.
 *
 * Los contactos se deduplican por tenant usando teléfono/correo normalizados
 * (§10.4). La normalización debe ser estable: cambiarla invalida la deduplicación
 * histórica, así que cualquier cambio requiere una migración de datos explícita.
 */

/**
 * Normaliza un correo para deduplicación y almacenamiento.
 *
 * Solo aplica trim y minúsculas. Deliberadamente NO removemos puntos ni sufijos
 * `+tag` de Gmail: dos direcciones distintas pueden ser dos compradores distintos
 * para efectos de despacho, y colapsarlas perdería pedidos legítimos.
 */
export function normalizeEmail(input: string | null | undefined): string | null {
  if (!input) return null;
  const email = String(input).trim().toLowerCase();
  if (email === '') return null;
  // Validación estructural mínima: exactamente un `@`, con contenido a ambos lados
  // y un punto en el dominio.
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) return null;
  return email;
}

/** Indicativo por defecto cuando el número no trae prefijo internacional. */
const DEFAULT_COUNTRY_CODE = '57'; // Colombia

/** Longitud del número nacional colombiano (celular y fijo con indicativo). */
const CO_NATIONAL_LENGTH = 10;

/**
 * Normaliza un teléfono a formato E.164 sin el `+`.
 *
 * Colombia es el mercado inicial (§16.1), así que un número de 10 dígitos sin
 * prefijo se asume colombiano. Un número que ya trae `+` o `00` conserva su país.
 *
 * @example normalizePhone('314 668 1896')    // '573146681896'
 * @example normalizePhone('+57 314 6681896') // '573146681896'
 * @example normalizePhone('0057 3146681896') // '573146681896'
 */
export function normalizePhone(
  input: string | null | undefined,
  defaultCountryCode: string = DEFAULT_COUNTRY_CODE,
): string | null {
  if (!input) return null;

  let raw = String(input).trim();
  if (raw === '') return null;

  const hasPlus = raw.startsWith('+');
  // Prefijo internacional marcado con `00` (convención de discado europeo/latino).
  const hasZeroZero = !hasPlus && raw.startsWith('00');

  let digits = raw.replace(/\D/g, '');
  if (digits === '') return null;

  if (hasZeroZero) digits = digits.slice(2);

  // Sin prefijo internacional explícito: interpretamos como número nacional.
  if (!hasPlus && !hasZeroZero) {
    // Un `0` inicial es prefijo de larga distancia nacional, no parte del número.
    digits = digits.replace(/^0+/, '');
    if (digits.length === CO_NATIONAL_LENGTH) {
      digits = defaultCountryCode + digits;
    }
  }

  // Rango válido de E.164: entre 8 y 15 dígitos incluyendo indicativo.
  if (digits.length < 8 || digits.length > 15) return null;

  return digits;
}

/**
 * Convierte un texto libre en un slug URL-safe.
 *
 * Se usa para slugs de sitio sugeridos a partir del nombre de la oferta.
 */
export function slugify(input: string, maxLength = 63): string {
  return String(input ?? '')
    .normalize('NFD')
    // Remover marcas diacríticas dejando la letra base (á -> a).
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}
