/**
 * Captura de atribución.
 *
 * El piloto no tiene pipeline de eventos: la atribución se guarda directamente en
 * cada pedido (§11.1). Este módulo extrae los parámetros de una URL entrante y los
 * acota para que un visitante no pueda inyectar payloads arbitrarios en la base.
 */

/** Parámetros UTM estándar que capturamos. */
export const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

export type UtmKey = (typeof UTM_KEYS)[number];

/**
 * Identificadores de clic por plataforma publicitaria.
 *
 * `fbclid` (Meta) y `gclid` (Google) son los relevantes hoy; el resto se captura
 * porque es gratis hacerlo y caro retrofitear cuando el cliente cambia de canal.
 */
export const CLICK_ID_KEYS = ['fbclid', 'gclid', 'ttclid', 'msclkid', 'twclid'] as const;

export type ClickIdKey = (typeof CLICK_ID_KEYS)[number];

/** Longitud máxima aceptada por valor. Corta payloads abusivos sin perder datos reales. */
const MAX_VALUE_LENGTH = 255;

/**
 * Atribución normalizada lista para persistir junto al pedido.
 *
 * Es un alias de tipo y no una `interface` a propósito: TypeScript solo infiere
 * índice implícito para alias, y sin él este objeto no es asignable al tipo
 * `Json` de Supabase, aunque su contenido sea JSON válido. Declararlo como
 * `interface` obligaría a un cast en cada punto donde se persiste.
 */
export type Attribution = {
  utm: Partial<Record<UtmKey, string>>;
  clickIds: Partial<Record<ClickIdKey, string>>;
  referrer: string | null;
  landingUrl: string | null;
};

/**
 * Extrae la atribución desde los parámetros de consulta de la landing.
 *
 * Ignora silenciosamente claves desconocidas: la lista blanca evita que un enlace
 * malicioso infle la fila del pedido con datos arbitrarios.
 */
export function extractAttribution(params: {
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>;
  referrer?: string | null;
  landingUrl?: string | null;
}): Attribution {
  const get = buildGetter(params.searchParams);

  const utm: Partial<Record<UtmKey, string>> = {};
  for (const key of UTM_KEYS) {
    const value = sanitizeValue(get(key));
    if (value) utm[key] = value;
  }

  const clickIds: Partial<Record<ClickIdKey, string>> = {};
  for (const key of CLICK_ID_KEYS) {
    const value = sanitizeValue(get(key));
    if (value) clickIds[key] = value;
  }

  return {
    utm,
    clickIds,
    referrer: sanitizeValue(params.referrer) ?? null,
    landingUrl: sanitizeValue(params.landingUrl) ?? null,
  };
}

function buildGetter(
  source: URLSearchParams | Record<string, string | string[] | undefined>,
): (key: string) => string | undefined {
  if (source instanceof URLSearchParams) {
    return (key) => source.get(key) ?? undefined;
  }
  return (key) => {
    const value = source[key];
    // Un parámetro repetido llega como arreglo; nos quedamos con la primera
    // aparición, que es la que el navegador considera primaria.
    return Array.isArray(value) ? value[0] : value;
  };
}

function sanitizeValue(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  // Remover controles: `\n` en un valor rompe exportaciones CSV aguas abajo.
  const cleaned = String(value)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, MAX_VALUE_LENGTH);
  return cleaned === '' ? undefined : cleaned;
}

/** ¿La atribución trae al menos un dato útil? Evita persistir objetos vacíos. */
export function hasAttribution(attribution: Attribution): boolean {
  return (
    Object.keys(attribution.utm).length > 0 ||
    Object.keys(attribution.clickIds).length > 0 ||
    attribution.referrer !== null
  );
}
