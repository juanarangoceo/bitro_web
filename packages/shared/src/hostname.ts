/**
 * Normalización de hostnames.
 *
 * El renderer resuelve `hostname -> site_id` contra la tabla `domains`. Para que ese
 * lookup sea determinista, todo hostname debe normalizarse exactamente igual al
 * escribirlo (dashboard) y al leerlo (renderer). Esta es la única implementación
 * autorizada; ver docs/adr/0004-resolucion-de-dominios.md.
 */

/** Longitud máxima de un hostname según RFC 1035. */
const MAX_HOSTNAME_LENGTH = 253;

/** Longitud máxima de una etiqueta (segmento entre puntos). */
const MAX_LABEL_LENGTH = 63;

/**
 * Etiquetas que no pueden usarse como slug de subdominio de cliente.
 *
 * Mezcla infraestructura (`www`, `api`, `mail`), superficies propias (`app`, `admin`,
 * `docs`) y marcas del negocio. Se valida contra esta lista antes de crear un
 * subdominio en el dominio operativo compartido (§12.1 de la especificación).
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // Infraestructura y convenciones de correo/DNS
  'www',
  'api',
  'mail',
  'smtp',
  'imap',
  'pop',
  'ns',
  'ns1',
  'ns2',
  'mx',
  'ftp',
  'cdn',
  'static',
  'assets',
  'img',
  'images',
  'media',
  'files',
  'webmail',
  'autodiscover',
  'autoconfig',
  '_domainkey',
  'dmarc',
  // Superficies propias de la plataforma
  'app',
  'admin',
  'dashboard',
  'panel',
  'console',
  'auth',
  'login',
  'signup',
  'account',
  'billing',
  'status',
  'health',
  'preview',
  'staging',
  'dev',
  'test',
  'demo',
  'docs',
  'help',
  'soporte',
  'support',
  'ayuda',
  'blog',
  'news',
  'legal',
  'privacy',
  'privacidad',
  'terminos',
  'terms',
  // Marcas propias
  'nitro',
  'nitroweb',
  'nitro-web',
  'nitrobot',
  'nitro-bot',
  'nitroecom',
  'nitro-ecom',
]);

/**
 * Normaliza un hostname a su forma canónica para almacenamiento y lookup.
 *
 * Aplica: trim, minúsculas, remoción de esquema, credenciales, puerto, path y punto
 * final. NO remueve `www.` — un hostname con `www` es una fila distinta en `domains`
 * que normalmente redirige al canonical (§12.3).
 *
 * @returns El hostname normalizado, o `null` si la entrada no es un hostname válido.
 */
export function normalizeHostname(input: string | null | undefined): string | null {
  if (!input) return null;

  let host = String(input).trim().toLowerCase();
  if (host === '') return null;

  // Remover esquema si viene una URL completa.
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');

  // Remover credenciales `user:pass@`.
  const atIndex = host.lastIndexOf('@');
  if (atIndex !== -1) host = host.slice(atIndex + 1);

  // Cortar en el primer separador de path, query o fragmento.
  host = host.split('/')[0] ?? '';
  host = host.split('?')[0] ?? '';
  host = host.split('#')[0] ?? '';

  // Remover puerto. Se ignora IPv6 en corchetes: no soportamos landings por IP.
  if (host.startsWith('[')) return null;
  const colonIndex = host.indexOf(':');
  if (colonIndex !== -1) host = host.slice(0, colonIndex);

  // Remover el punto final del FQDN absoluto.
  if (host.endsWith('.')) host = host.slice(0, -1);

  if (host === '' || host.length > MAX_HOSTNAME_LENGTH) return null;

  // Debe tener al menos dos etiquetas: rechazamos `localhost` y TLDs sueltos en
  // producción. El renderer maneja localhost por una vía explícita de desarrollo.
  const labels = host.split('.');
  if (labels.length < 2) return null;

  for (const label of labels) {
    if (!isValidLabel(label)) return null;
  }

  return host;
}

/** Valida una etiqueta DNS individual (LDH: letters, digits, hyphen). */
function isValidLabel(label: string): boolean {
  if (label.length === 0 || label.length > MAX_LABEL_LENGTH) return false;
  if (label.startsWith('-') || label.endsWith('-')) return false;
  return /^[a-z0-9-]+$/.test(label);
}

/**
 * Extrae el slug de subdominio cuando el hostname pertenece al dominio operativo.
 *
 * @example subdomainSlug('cafetera.nitrolanding.co', 'nitrolanding.co') // 'cafetera'
 * @example subdomainSlug('cafeteraexpress.com', 'nitrolanding.co')      // null
 */
export function subdomainSlug(hostname: string, rootDomain: string): string | null {
  const host = normalizeHostname(hostname);
  const root = normalizeHostname(rootDomain);
  if (!host || !root) return null;
  if (host === root) return null;
  if (!host.endsWith(`.${root}`)) return null;

  const slug = host.slice(0, -(root.length + 1));
  // Solo aceptamos un nivel de subdominio: `a.b.root` no es un slug de cliente.
  if (slug === '' || slug.includes('.')) return null;
  return slug;
}

/** Resultado de validar un slug de subdominio propuesto por el cliente. */
export type SlugValidation =
  | { ok: true; slug: string }
  | { ok: false; reason: 'empty' | 'too_long' | 'invalid_chars' | 'reserved' };

/**
 * Valida un slug propuesto para el dominio operativo compartido.
 *
 * La unicidad global NO se valida aquí: eso requiere consultar `domains` y es
 * responsabilidad de la capa de datos.
 */
export function validateSubdomainSlug(input: string): SlugValidation {
  const slug = String(input ?? '')
    .trim()
    .toLowerCase();

  if (slug === '') return { ok: false, reason: 'empty' };
  if (slug.length > MAX_LABEL_LENGTH) return { ok: false, reason: 'too_long' };
  if (!isValidLabel(slug)) return { ok: false, reason: 'invalid_chars' };
  if (RESERVED_SLUGS.has(slug)) return { ok: false, reason: 'reserved' };

  return { ok: true, slug };
}
