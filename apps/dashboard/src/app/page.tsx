import Link from 'next/link';
import { redirect } from 'next/navigation';
import { hasPendingChanges } from '@nitro-web/db';
import { Shell } from '@/components/Shell';
import { puedeEditar, requerirSesion } from '@/lib/session';
import { supabaseServidor } from '@/lib/supabase';

/**
 * Listado de landings del tenant.
 *
 * `changes_pending` no se lee de una columna: se deriva comparando el
 * timestamp del borrador con el de la publicación vigente (§4.5). Guardarlo
 * obligaría a mantenerlo sincronizado desde dos rutas de escritura distintas.
 */
export default async function SitiosPage() {
  const sesion = await requerirSesion();
  const supabase = await supabaseServidor();

  const { data: sitios } = await supabase
    .from('sites')
    .select(
      `id, name, status, updated_at,
       site_content_drafts ( updated_at ),
       site_publications!sites_published_publication_fk ( published_at, publication_number ),
       domains ( hostname, is_canonical, status ),
       offers ( price_amount, currency, is_active )`,
    )
    .order('created_at', { ascending: false });

  async function crearSitio(formData: FormData) {
    'use server';

    const sesionActual = await requerirSesion();
    if (!puedeEditar(sesionActual)) redirect('/?error=permiso');

    const nombre = String(formData.get('nombre') ?? '').trim();
    const templateVersionId = String(formData.get('template_version_id') ?? '');
    if (!nombre || !templateVersionId) redirect('/?error=datos');

    const db = await supabaseServidor();

    const { data: version } = await db
      .from('template_versions')
      .select('id, default_content')
      .eq('id', templateVersionId)
      .maybeSingle();

    if (!version) redirect('/?error=plantilla');

    const { data: sitio, error } = await db
      .from('sites')
      .insert({
        tenant_id: sesionActual.tenantId,
        template_version_id: version.id,
        name: nombre,
        status: 'draft',
      })
      .select('id')
      .single();

    if (error || !sitio) redirect('/?error=crear');

    // El sitio nace con el contenido de ejemplo de la plantilla: enfrentarse a
    // campos vacíos es la forma más rápida de abandonar el editor (§4.3).
    await db.from('site_content_drafts').insert({
      site_id: sitio.id,
      tenant_id: sesionActual.tenantId,
      content_json: version.default_content,
      updated_by: sesionActual.userId,
    });

    redirect(`/sitios/${sitio.id}`);
  }

  const { data: plantillas } = await supabase
    .from('template_versions')
    .select('id, version, templates ( display_name, template_key )')
    .eq('status', 'published')
    .order('version', { ascending: false });

  return (
    <Shell sesion={sesion} titulo="Tus landings">
      {(sitios ?? []).length === 0 && (
        <p className="mb-6 rounded-lg bg-white p-6 text-sm text-ink-600 shadow-sm">
          Todavía no tienes ninguna landing. Crea la primera desde una plantilla.
        </p>
      )}

      <ul className="space-y-3">
        {(sitios ?? []).map((sitio) => {
          const borrador = primero(sitio.site_content_drafts);
          const publicacion = primero(sitio.site_publications);
          const oferta = primero(sitio.offers);
          const canonico = (sitio.domains ?? []).find(
            (d) => d.is_canonical && d.status === 'active',
          );

          const pendientes = hasPendingChanges({
            draftUpdatedAt: borrador?.updated_at ?? null,
            publishedAt: publicacion?.published_at ?? null,
          });

          return (
            <li key={sitio.id} className="tarjeta p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/sitios/${sitio.id}`}
                    className="font-medium hover:text-brand-700 hover:underline"
                  >
                    {sitio.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <Estado estado={sitio.status} />
                    {pendientes && sitio.status === 'published' && (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">
                        cambios sin publicar
                      </span>
                    )}
                    {publicacion && (
                      <span className="text-ink-500">
                        publicación #{publicacion.publication_number}
                      </span>
                    )}
                    {oferta && (
                      <span className="text-ink-500">
                        {formatoMoneda(oferta.price_amount, oferta.currency)}
                        {!oferta.is_active && ' · oferta inactiva'}
                      </span>
                    )}
                  </div>
                </div>

                {canonico && (
                  <a
                    href={`https://${canonico.hostname}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-brand-700 underline"
                  >
                    {canonico.hostname}
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {puedeEditar(sesion) && (
        <form action={crearSitio} className="tarjeta mt-8 space-y-4 p-6">
          <h2 className="font-medium">Crear una landing</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="etiqueta" htmlFor="nombre">
                Nombre
              </label>
              <input id="nombre" name="nombre" required className="campo mt-1" />
              <p className="ayuda">Solo lo ves tú. No aparece en la página.</p>
            </div>

            <div>
              <label className="etiqueta" htmlFor="template_version_id">
                Plantilla
              </label>
              <select id="template_version_id" name="template_version_id" required className="campo mt-1">
                {(plantillas ?? []).map((p) => {
                  const t = primero(p.templates);
                  return (
                    <option key={p.id} value={p.id}>
                      {t?.display_name ?? t?.template_key} {p.version}
                    </option>
                  );
                })}
              </select>
              <p className="ayuda">La landing queda fijada a esta versión (§7.3).</p>
            </div>
          </div>

          <button type="submit" className="boton-primario" disabled={(plantillas ?? []).length === 0}>
            Crear
          </button>

          {(plantillas ?? []).length === 0 && (
            <p className="ayuda">No hay plantillas publicadas disponibles todavía.</p>
          )}
        </form>
      )}
    </Shell>
  );
}

function Estado({ estado }: { estado: string }) {
  const estilos: Record<string, string> = {
    draft: 'bg-ink-100 text-ink-700',
    published: 'bg-green-100 text-green-900',
    paused: 'bg-amber-100 text-amber-900',
    archived: 'bg-ink-100 text-ink-500',
  };
  const textos: Record<string, string> = {
    draft: 'borrador',
    published: 'publicada',
    paused: 'pausada',
    archived: 'archivada',
  };
  return (
    <span className={`rounded px-2 py-0.5 ${estilos[estado] ?? 'bg-ink-100'}`}>
      {textos[estado] ?? estado}
    </span>
  );
}

function formatoMoneda(monto: number, moneda: string): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: moneda,
    maximumFractionDigits: 0,
  }).format(monto);
}

function primero<T>(valor: T | T[] | null | undefined): T | undefined {
  if (!valor) return undefined;
  return Array.isArray(valor) ? valor[0] : valor;
}
