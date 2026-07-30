/**
 * Flujo de publicación: borrador → snapshot → sitio público.
 *
 * Ver ADR 0004. Las invariantes que este módulo protege:
 *
 *   - Publicar **copia**; nunca mueve ni referencia el borrador.
 *   - Lo que se publica está validado en modo `publish`: un JSON incompleto no
 *     llega a producción.
 *   - Las publicaciones son append-only. El rollback mueve un puntero.
 *   - Editar el borrador no toca la página pública.
 */

import {
  compileContentValidator,
  parseContentSchema,
  type ContentSchema,
} from '@nitro-web/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';

export type PublishResult =
  | { ok: true; publicationId: string; publicationNumber: number }
  | { ok: false; code: 'not_found' | 'invalid_content' | 'no_offer' | 'error'; errors: string[] };

/**
 * Publica el borrador vigente de un sitio.
 *
 * @param supabase Cliente con la sesión del usuario: RLS verifica que pertenezca
 *   al tenant y tenga rol de escritura. **No** usar el cliente secreto aquí — la
 *   autorización de esta operación es justamente lo que no queremos saltarnos.
 */
export async function publishSite(
  supabase: SupabaseClient,
  siteId: string,
  options?: { publishedBy?: string },
): Promise<PublishResult> {
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select(
      `
      id, tenant_id, template_version_id,
      template_versions:template_version_id ( content_schema, component_key ),
      site_content_drafts ( content_json ),
      offers ( id, title, price_amount, compare_at_amount, shipping_amount, currency, inventory, is_active )
    `,
    )
    .eq('id', siteId)
    .maybeSingle();

  if (siteError || !site) {
    return { ok: false, code: 'not_found', errors: ['El sitio no existe o no tienes acceso'] };
  }

  const templateVersion = firstOf(site.template_versions);
  const draft = firstOf(site.site_content_drafts);
  const offer = firstOf(site.offers);

  if (!templateVersion?.content_schema) {
    return { ok: false, code: 'error', errors: ['La versión de plantilla no tiene content_schema'] };
  }

  // Una landing sin oferta no puede recibir pedidos: el total se calcula desde
  // `offers`, y publicarla dejaría un formulario que falla al enviarse.
  if (!offer || !offer.is_active) {
    return {
      ok: false,
      code: 'no_offer',
      errors: ['Configura la oferta (precio y moneda) antes de publicar'],
    };
  }

  // Segunda validación, en modo estricto. La primera ocurrió al guardar el
  // borrador, en modo `draft`, donde lo obligatorio no se exige.
  let schema: ContentSchema;
  try {
    schema = parseContentSchema(templateVersion.content_schema);
  } catch {
    return { ok: false, code: 'error', errors: ['El content_schema de la plantilla es inválido'] };
  }

  const validate = compileContentValidator(schema, 'publish');
  const result = validate.safeParse(draft?.content_json ?? {});

  if (!result.success) {
    return {
      ok: false,
      code: 'invalid_content',
      errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }

  // Consecutivo de publicación por sitio, legible para el usuario.
  const { data: last } = await supabase
    .from('site_publications')
    .select('publication_number')
    .eq('site_id', siteId)
    .order('publication_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const publicationNumber = (last?.publication_number ?? 0) + 1;

  const { data: publication, error: insertError } = await supabase
    .from('site_publications')
    .insert({
      site_id: siteId,
      tenant_id: site.tenant_id,
      publication_number: publicationNumber,
      template_version_id: site.template_version_id,
      content_json: result.data,
      // La oferta se congela junto al contenido: si el precio cambia mañana, el
      // snapshot sigue mostrando lo que se publicó hoy.
      offer_snapshot: {
        offer_id: offer.id,
        title: offer.title,
        price_amount: offer.price_amount,
        compare_at_amount: offer.compare_at_amount,
        shipping_amount: offer.shipping_amount,
        currency: offer.currency,
      },
      published_by: options?.publishedBy,
    })
    .select('id, publication_number')
    .single();

  if (insertError || !publication) {
    return { ok: false, code: 'error', errors: [insertError?.message ?? 'Error al publicar'] };
  }

  // Recién aquí la publicación se vuelve visible. El orden importa: si el
  // proceso muere entre el insert y este update, queda un snapshot huérfano
  // (inofensivo) en lugar de un puntero a contenido inexistente.
  const { error: pointerError } = await supabase
    .from('sites')
    .update({ published_publication_id: publication.id, status: 'published' })
    .eq('id', siteId);

  if (pointerError) {
    return { ok: false, code: 'error', errors: [pointerError.message] };
  }

  return { ok: true, publicationId: publication.id, publicationNumber: publication.publication_number };
}

/**
 * Revierte el sitio a una publicación anterior.
 *
 * No borra ni edita nada: solo mueve `published_publication_id`. Por eso el
 * rollback es instantáneo y a su vez reversible (runbook R5).
 */
export async function rollbackSite(
  supabase: SupabaseClient,
  siteId: string,
  publicationId: string,
): Promise<{ ok: boolean; error?: string }> {
  // Verificar que la publicación pertenece a este sitio. Sin esta comprobación,
  // un id de otro sitio dejaría la landing mostrando contenido ajeno.
  const { data: publication } = await supabase
    .from('site_publications')
    .select('id')
    .eq('id', publicationId)
    .eq('site_id', siteId)
    .maybeSingle();

  if (!publication) {
    return { ok: false, error: 'Esa publicación no pertenece a este sitio' };
  }

  const { error } = await supabase
    .from('sites')
    .update({ published_publication_id: publicationId, status: 'published' })
    .eq('id', siteId);

  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Publicación transversal del equipo de Nitro Web.
 *
 * A diferencia de `publishSite`, aquí RLS no puede autorizar porque el operador
 * no pertenece al tenant del cliente. La función exige y comprueba un operador
 * activo de plataforma antes de delegar al mismo validador y flujo de snapshot.
 */
export async function publishSiteAsSupport(
  supabase: SupabaseClient,
  siteId: string,
  input: { actorUserId: string; reviewedBy: string; reason: string },
): Promise<PublishResult> {
  const autorizado = await isActivePlatformAdmin(supabase, input.actorUserId);
  if (!autorizado) {
    return { ok: false, code: 'not_found', errors: ['Operador de plataforma no autorizado'] };
  }
  if (!input.reviewedBy.trim() || !input.reason.trim()) {
    return { ok: false, code: 'error', errors: ['La revisión y el motivo son obligatorios'] };
  }

  const { data: previousSite } = await supabase
    .from('sites')
    .select('first_publish_reviewed_at')
    .eq('id', siteId)
    .maybeSingle();
  const reviewedAt = new Date().toISOString();
  const { data: reviewedSite, error: reviewError } = await supabase
    .from('sites')
    .update({ first_publish_reviewed_at: reviewedAt })
    .eq('id', siteId)
    .select('tenant_id')
    .single();
  if (reviewError || !reviewedSite) {
    return { ok: false, code: 'error', errors: [reviewError?.message ?? 'No se guardó la revisión'] };
  }

  const result = await publishSite(supabase, siteId, { publishedBy: input.actorUserId });
  if (!result.ok) {
    await supabase
      .from('sites')
      .update({ first_publish_reviewed_at: previousSite?.first_publish_reviewed_at ?? null })
      .eq('id', siteId);
    return result;
  }

  const { error: auditError } = await supabase.from('audit_log').insert({
    tenant_id: reviewedSite.tenant_id,
    actor_user_id: input.actorUserId,
    is_support_mode: true,
    support_reason: input.reason.trim(),
    action: 'site.published_as_support',
    entity_type: 'site',
    entity_id: siteId,
    payload_json: {
      publication_id: result.publicationId,
      publication_number: result.publicationNumber,
      reviewed_by: input.reviewedBy.trim(),
    },
  });
  if (auditError) {
    return { ok: false, code: 'error', errors: [`Publicó, pero falló la auditoría: ${auditError.message}`] };
  }
  return result;
}

/** Rollback transversal con la misma autorización explícita y auditoría. */
export async function rollbackSiteAsSupport(
  supabase: SupabaseClient,
  siteId: string,
  publicationId: string,
  input: { actorUserId: string; reason: string },
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isActivePlatformAdmin(supabase, input.actorUserId))) {
    return { ok: false, error: 'Operador de plataforma no autorizado' };
  }
  if (!input.reason.trim()) return { ok: false, error: 'El motivo es obligatorio' };

  const result = await rollbackSite(supabase, siteId, publicationId);
  if (!result.ok) return result;

  const { data: site } = await supabase.from('sites').select('tenant_id').eq('id', siteId).single();
  if (!site) return { ok: false, error: 'No se pudo auditar el rollback' };
  const { error } = await supabase.from('audit_log').insert({
    tenant_id: site.tenant_id,
    actor_user_id: input.actorUserId,
    is_support_mode: true,
    support_reason: input.reason.trim(),
    action: 'site.rolled_back_as_support',
    entity_type: 'site',
    entity_id: siteId,
    payload_json: { publication_id: publicationId },
  });
  return error ? { ok: false, error: `Rollback aplicado, pero falló la auditoría: ${error.message}` } : { ok: true };
}

/**
 * ¿Hay cambios guardados que aún no son públicos? (§4.5, `changes_pending`)
 *
 * No es una columna: se deriva comparando timestamps. Almacenarlo obligaría a
 * mantenerlo sincronizado desde dos rutas distintas de escritura.
 */
export function hasPendingChanges(params: {
  draftUpdatedAt: string | null;
  publishedAt: string | null;
}): boolean {
  if (!params.draftUpdatedAt) return false;
  if (!params.publishedAt) return true;
  return new Date(params.draftUpdatedAt) > new Date(params.publishedAt);
}

function firstOf<T>(value: T | T[] | null | undefined): T | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

async function isActivePlatformAdmin(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  return Boolean(data);
}
