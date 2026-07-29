/**
 * Resolución `hostname → landing publicada`.
 *
 * Es la consulta más crítica del producto: un error aquí muestra la landing de
 * un cliente bajo el dominio de otro. Ver ADR 0005.
 *
 * Reglas que implementa:
 *   1. El hostname se normaliza con la única función autorizada.
 *   2. Solo se consideran dominios `active`.
 *   3. Se lee el **snapshot publicado**, nunca el borrador.
 *   4. Un dominio no canónico devuelve una redirección, no contenido.
 *   5. Hostname desconocido → `null`, que el renderer traduce a 404.
 */

import { normalizeHostname } from '@nitro-web/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Landing lista para renderizar. */
export interface ResolvedSite {
  siteId: string;
  tenantId: string;
  siteName: string;
  /** Clave del componente en el registro del renderer. */
  componentKey: string;
  templateKey: string;
  templateVersion: string;
  /** Snapshot publicado. Inmutable. */
  content: Record<string, unknown>;
  /** Oferta congelada al publicar: precio, moneda, envío. */
  offer: Record<string, unknown>;
  publicationId: string;
  publishedAt: string;
  hostname: string;
}

/** Resultado de resolver un hostname. */
export type SiteResolution =
  | { kind: 'render'; site: ResolvedSite }
  | { kind: 'redirect'; toHostname: string }
  | { kind: 'not_found' }
  /** El sitio existe pero está pausado: respuesta controlada, no la de otro. */
  | { kind: 'paused' };

/**
 * Resuelve el hostname de una petición entrante.
 *
 * Requiere el cliente secreto: el visitante es anónimo y no tiene acceso a
 * ninguna tabla. La consulta está acotada por hostname, así que la omisión de
 * RLS no amplía lo que se expone — solo devuelve la landing de ese dominio.
 */
export async function resolveSiteByHostname(
  supabase: SupabaseClient,
  rawHostname: string,
): Promise<SiteResolution> {
  const hostname = normalizeHostname(rawHostname);
  if (!hostname) return { kind: 'not_found' };

  const { data: domain, error: domainError } = await supabase
    .from('domains')
    .select('site_id, is_canonical, status')
    .eq('hostname', hostname)
    .eq('status', 'active')
    .maybeSingle();

  if (domainError || !domain) return { kind: 'not_found' };

  // Dominio alterno: redirigir al canónico en lugar de servir el mismo
  // contenido en dos URLs, que dividiría el SEO del cliente (§12.3).
  if (!domain.is_canonical) {
    const { data: canonical } = await supabase
      .from('domains')
      .select('hostname')
      .eq('site_id', domain.site_id)
      .eq('is_canonical', true)
      .eq('status', 'active')
      .maybeSingle();

    // Sin canónico configurado servimos igual: mejor una landing duplicada que
    // una campaña caída.
    if (canonical?.hostname && canonical.hostname !== hostname) {
      return { kind: 'redirect', toHostname: canonical.hostname };
    }
  }

  return loadPublishedSite(supabase, domain.site_id, hostname);
}

/**
 * Carga la publicación vigente de un sitio.
 *
 * Una sola consulta con joins: el renderer debe poder leer el snapshot completo
 * sin encadenar viajes a la base (§6.3).
 */
async function loadPublishedSite(
  supabase: SupabaseClient,
  siteId: string,
  hostname: string,
): Promise<SiteResolution> {
  const { data, error } = await supabase
    .from('sites')
    .select(
      `
      id,
      tenant_id,
      name,
      status,
      published_publication_id,
      site_publications!sites_published_publication_fk (
        id,
        content_json,
        offer_snapshot,
        published_at,
        template_versions ( version, component_key, templates ( template_key ) )
      )
    `,
    )
    .eq('id', siteId)
    .maybeSingle();

  if (error || !data) return { kind: 'not_found' };

  if (data.status === 'paused') return { kind: 'paused' };

  // Un sitio en borrador o archivado no es público. Devolver 404 —y no un
  // mensaje distinto— evita revelar que ese subdominio está tomado.
  if (data.status !== 'published' || !data.published_publication_id) {
    return { kind: 'not_found' };
  }

  // El embed llega como objeto o como arreglo según cómo resuelva PostgREST la
  // relación; se normaliza para no depender de ese detalle.
  const publication = firstOf(data.site_publications);
  if (!publication) return { kind: 'not_found' };

  const templateVersion = firstOf(publication.template_versions);
  const template = templateVersion ? firstOf(templateVersion.templates) : undefined;

  if (!templateVersion?.component_key) return { kind: 'not_found' };

  return {
    kind: 'render',
    site: {
      siteId: data.id,
      tenantId: data.tenant_id,
      siteName: data.name,
      componentKey: templateVersion.component_key,
      templateKey: template?.template_key ?? 'desconocida',
      templateVersion: templateVersion.version,
      content: (publication.content_json ?? {}) as Record<string, unknown>,
      offer: (publication.offer_snapshot ?? {}) as Record<string, unknown>,
      publicationId: publication.id,
      publishedAt: publication.published_at,
      hostname,
    },
  };
}

/**
 * Carga un sitio por su token de preview.
 *
 * El preview muestra el **borrador**, no el snapshot: su razón de ser es ver los
 * cambios antes de que sean públicos (§4.5). El token actúa como credencial, así
 * que la URL de preview no debe compartirse ni indexarse.
 */
export async function resolveSiteByPreviewToken(
  supabase: SupabaseClient,
  previewToken: string,
): Promise<SiteResolution> {
  const { data, error } = await supabase
    .from('sites')
    .select(
      `
      id, tenant_id, name,
      template_versions:template_version_id ( version, component_key, templates ( template_key ) ),
      site_content_drafts ( content_json ),
      offers ( title, price_amount, compare_at_amount, shipping_amount, currency, inventory )
    `,
    )
    .eq('preview_token', previewToken)
    .maybeSingle();

  if (error || !data) return { kind: 'not_found' };

  const templateVersion = firstOf(data.template_versions);
  const template = templateVersion ? firstOf(templateVersion.templates) : undefined;
  const draft = firstOf(data.site_content_drafts);
  const offer = firstOf(data.offers);

  if (!templateVersion?.component_key) return { kind: 'not_found' };

  return {
    kind: 'render',
    site: {
      siteId: data.id,
      tenantId: data.tenant_id,
      siteName: data.name,
      componentKey: templateVersion.component_key,
      templateKey: template?.template_key ?? 'desconocida',
      templateVersion: templateVersion.version,
      content: (draft?.content_json ?? {}) as Record<string, unknown>,
      offer: (offer ?? {}) as Record<string, unknown>,
      publicationId: 'preview',
      publishedAt: new Date().toISOString(),
      hostname: 'preview',
    },
  };
}

/** Normaliza un embed de PostgREST que puede venir como objeto o arreglo. */
function firstOf<T>(value: T | T[] | null | undefined): T | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Registra una vista de página.
 *
 * Nunca debe bloquear el render (§6.1, §17): si la métrica falla, la landing
 * igual se sirve. Perder una vista es aceptable; perder una venta no.
 */
export async function recordPageView(
  supabase: SupabaseClient,
  siteId: string,
): Promise<void> {
  try {
    await supabase.rpc('record_page_view', { p_site_id: siteId });
  } catch {
    // Silencio deliberado: esta llamada no puede propagar un error al visitante.
  }
}
