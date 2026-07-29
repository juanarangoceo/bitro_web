import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  compileContentValidator,
  parseContentSchema,
  type ContentSchema,
} from '@nitro-web/contracts';
import { hasPendingChanges, publishSite, type Json } from '@nitro-web/db';
import { AvisoSoloLectura, Shell } from '@/components/Shell';
import { CampoEditor, type OpcionAsset } from '@/components/CampoEditor';
import { codificarNombre, elementosDe, filasDeLista, interpretarFormulario, valorDe } from '@/lib/formulario';
import { puedeEditar, requerirSesion } from '@/lib/session';
import { supabaseServidor } from '@/lib/supabase';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string; detalle?: string }>;
};

export default async function SitioPage({ params, searchParams }: Props) {
  const { id } = await params;
  const avisos = await searchParams;

  const sesion = await requerirSesion();
  const supabase = await supabaseServidor();

  const { data: sitio } = await supabase
    .from('sites')
    .select(
      `id, name, status, preview_token, published_publication_id,
       template_versions:template_version_id ( version, content_schema, templates ( display_name ) ),
       site_content_drafts ( content_json, updated_at ),
       site_publications!sites_published_publication_fk ( published_at, publication_number ),
       offers ( id, title, price_amount, compare_at_amount, shipping_amount, currency, inventory, is_active ),
       domains ( hostname, is_canonical, status )`,
    )
    .eq('id', id)
    .maybeSingle();

  // Un sitio de otro tenant no existe para este usuario: RLS ya lo filtró, así
  // que aquí no hay que distinguir "no existe" de "no es tuyo".
  if (!sitio) notFound();

  const version = primero(sitio.template_versions);
  const borrador = primero(sitio.site_content_drafts);
  const publicacion = primero(sitio.site_publications);
  const oferta = primero(sitio.offers);
  const canonico = (sitio.domains ?? []).find((d) => d.is_canonical && d.status === 'active');

  let schema: ContentSchema;
  try {
    schema = parseContentSchema(version?.content_schema);
  } catch {
    notFound();
  }

  const contenido = (borrador?.content_json ?? {}) as Record<string, unknown>;
  const editable = puedeEditar(sesion);

  const { data: assetsCrudos } = await supabase
    .from('assets')
    .select('id, asset_slot, storage_path, width, height')
    .eq('site_id', id)
    .order('created_at', { ascending: false });

  const assets: OpcionAsset[] = (assetsCrudos ?? []).map((a) => ({
    id: a.id,
    slot: a.asset_slot,
    etiqueta: `${a.asset_slot ?? 'sin espacio'} · ${a.storage_path.split('/').pop() ?? a.id}${
      a.width && a.height ? ` (${a.width}×${a.height})` : ''
    }`,
  }));

  const pendientes = hasPendingChanges({
    draftUpdatedAt: borrador?.updated_at ?? null,
    publishedAt: publicacion?.published_at ?? null,
  });

  // Se valida en modo `publish` solo para *avisar*: publicar vuelve a validar
  // en el servidor, y ese es el control que cuenta.
  const validacion = compileContentValidator(schema, 'publish').safeParse(contenido);
  const faltantes = validacion.success
    ? []
    : validacion.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);

  async function guardar(formData: FormData) {
    'use server';

    const s = await requerirSesion();
    if (!puedeEditar(s)) redirect(`/sitios/${id}?error=permiso`);

    const db = await supabaseServidor();

    const { data: fila } = await db
      .from('sites')
      .select('template_versions:template_version_id ( content_schema ), site_content_drafts ( revision )')
      .eq('id', id)
      .maybeSingle();

    const tv = primero(fila?.template_versions);
    if (!tv) redirect(`/sitios/${id}?error=guardar`);

    const esquema = parseContentSchema(tv.content_schema);
    const nuevo = interpretarFormulario(esquema, formData);

    // Modo `draft`: lo obligatorio no se exige al guardar. Bloquear el guardado
    // por un campo incompleto obligaría a terminar la página de una sentada.
    const revisado = compileContentValidator(esquema, 'draft').safeParse(nuevo);
    if (!revisado.success) {
      const primerFallo = revisado.error.issues[0];
      const detalle = primerFallo ? `${primerFallo.path.join('.')}: ${primerFallo.message}` : '';
      redirect(`/sitios/${id}?error=contenido&detalle=${encodeURIComponent(detalle)}`);
    }

    const borradorActual = primero(fila?.site_content_drafts);

    const { error } = await db
      .from('site_content_drafts')
      .update({
        // El round-trip por JSON es exactamente lo que hará el driver al enviar
        // el valor a una columna `jsonb`; hacerlo aquí lo tipa y de paso falla
        // ruidosamente si algo no fuera serializable.
        content_json: JSON.parse(JSON.stringify(revisado.data)) as Json,
        revision: (borradorActual?.revision ?? 1) + 1,
        updated_by: s.userId,
      })
      .eq('site_id', id);

    if (error) redirect(`/sitios/${id}?error=guardar`);
    redirect(`/sitios/${id}?ok=guardado`);
  }

  async function guardarOferta(formData: FormData) {
    'use server';

    const s = await requerirSesion();
    if (!puedeEditar(s)) redirect(`/sitios/${id}?error=permiso`);

    const entero = (clave: string): number | null => {
      const crudo = String(formData.get(clave) ?? '').trim();
      if (crudo === '') return null;
      const n = Number(crudo);
      return Number.isInteger(n) && n >= 0 ? n : null;
    };

    const precio = entero('price_amount');
    if (precio === null) redirect(`/sitios/${id}?error=precio`);

    const anterior = entero('compare_at_amount');
    // Lo impide un CHECK, pero su mensaje no explica que un "antes" más barato
    // mostraría un descuento negativo.
    if (anterior !== null && anterior <= precio) redirect(`/sitios/${id}?error=comparar`);

    const db = await supabaseServidor();
    const { error } = await db.from('offers').upsert(
      {
        site_id: id,
        tenant_id: s.tenantId,
        title: String(formData.get('title') ?? '').trim() || 'Oferta',
        price_amount: precio,
        compare_at_amount: anterior,
        shipping_amount: entero('shipping_amount') ?? 0,
        inventory: entero('inventory'),
        currency: String(formData.get('currency') ?? 'COP'),
        is_active: formData.get('is_active') !== null,
      },
      { onConflict: 'site_id' },
    );

    if (error) redirect(`/sitios/${id}?error=oferta`);
    redirect(`/sitios/${id}?ok=oferta`);
  }

  async function publicar() {
    'use server';

    const s = await requerirSesion();
    if (!puedeEditar(s)) redirect(`/sitios/${id}?error=permiso`);

    // Con la sesión del usuario, no con la clave secreta: que RLS verifique la
    // pertenencia al tenant ES la autorización de publicar.
    const db = await supabaseServidor();
    const resultado = await publishSite(db, id);

    if (!resultado.ok) {
      const detalle = resultado.errors.slice(0, 2).join(' · ');
      redirect(`/sitios/${id}?error=${resultado.code}&detalle=${encodeURIComponent(detalle)}`);
    }

    redirect(`/sitios/${id}?ok=publicado`);
  }

  return (
    <Shell
      sesion={sesion}
      titulo={sitio.name}
      volverA={{ href: '/', texto: 'Tus landings' }}
      acciones={
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/sitios/${id}/imagenes`} className="boton-secundario">
            Imágenes
          </Link>
          <Link href={`/sitios/${id}/pedidos`} className="boton-secundario">
            Pedidos
          </Link>
          <a
            href={`${process.env.NEXT_PUBLIC_RENDERER_URL ?? 'http://localhost:3000'}/preview/${sitio.preview_token}`}
            target="_blank"
            rel="noreferrer"
            className="boton-secundario"
          >
            Ver preview
          </a>
        </div>
      }
    >
      {!editable && <AvisoSoloLectura />}

      <Avisos avisos={avisos} />

      <section className="tarjeta mb-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <p className="font-medium">
              {sitio.status === 'published' ? 'Publicada' : 'Sin publicar'}
              {pendientes && sitio.status === 'published' && ' · con cambios sin publicar'}
            </p>
            <p className="mt-1 text-ink-500">
              {primero(version?.templates)?.display_name} {version?.version}
              {publicacion && ` · publicación #${publicacion.publication_number}`}
              {canonico && ` · ${canonico.hostname}`}
            </p>
          </div>

          {editable && (
            <form action={publicar}>
              <button type="submit" className="boton-primario" disabled={faltantes.length > 0}>
                {sitio.status === 'published' ? 'Publicar cambios' : 'Publicar'}
              </button>
            </form>
          )}
        </div>

        {faltantes.length > 0 && (
          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">Falta esto para poder publicar:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {faltantes.slice(0, 6).map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <form action={guardarOferta} className="tarjeta mb-6 space-y-4 p-5">
        <div>
          <h2 className="font-medium">Oferta</h2>
          <p className="ayuda">
            El precio vive aquí y no en los textos: es el número desde el que el servidor calcula
            el total de cada pedido. Va en la unidad mínima de la moneda, sin decimales.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="etiqueta" htmlFor="title">Título</label>
            <input id="title" name="title" defaultValue={oferta?.title ?? sitio.name}
                   disabled={!editable} className="campo mt-1" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="price_amount">Precio *</label>
            <input id="price_amount" name="price_amount" type="number" min={0} step={1} required
                   defaultValue={oferta?.price_amount ?? ''} disabled={!editable} className="campo mt-1" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="compare_at_amount">Precio anterior</label>
            <input id="compare_at_amount" name="compare_at_amount" type="number" min={0} step={1}
                   defaultValue={oferta?.compare_at_amount ?? ''} disabled={!editable} className="campo mt-1" />
            <p className="ayuda">Debe ser mayor al actual, y haber sido real.</p>
          </div>
          <div>
            <label className="etiqueta" htmlFor="shipping_amount">Envío</label>
            <input id="shipping_amount" name="shipping_amount" type="number" min={0} step={1}
                   defaultValue={oferta?.shipping_amount ?? 0} disabled={!editable} className="campo mt-1" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="inventory">Inventario</label>
            <input id="inventory" name="inventory" type="number" min={0} step={1}
                   defaultValue={oferta?.inventory ?? ''} disabled={!editable} className="campo mt-1" />
            <p className="ayuda">Vacío = no se gestiona.</p>
          </div>
          <div>
            <label className="etiqueta" htmlFor="currency">Moneda</label>
            <select id="currency" name="currency" defaultValue={oferta?.currency ?? 'COP'}
                    disabled={!editable} className="campo mt-1">
              <option value="COP">COP</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_active" defaultChecked={oferta?.is_active ?? true}
                 disabled={!editable} className="h-4 w-4 rounded border-ink-300" />
          <span>Oferta activa</span>
        </label>

        {editable && <button type="submit" className="boton-secundario">Guardar oferta</button>}
      </form>

      <form action={guardar} className="space-y-6">
        {schema.sections.map((seccion) => (
          <section key={seccion.key} className="tarjeta p-5">
            <div className="mb-4">
              <h2 className="font-medium">{seccion.label}</h2>
              {seccion.description && <p className="ayuda">{seccion.description}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(seccion.fields)
                .filter(([, campo]) => campo.type !== 'list')
                .map(([clave, campo]) => (
                  <CampoEditor
                    key={clave}
                    campo={campo}
                    ruta={[seccion.key, clave]}
                    valor={valorDe(contenido, [seccion.key, clave])}
                    assets={assets}
                    soloLectura={!editable}
                  />
                ))}
            </div>

            {Object.entries(seccion.fields)
              .filter(([, campo]) => campo.type === 'list')
              .map(([clave, campo]) => {
                const actuales = elementosDe(contenido, seccion.key, clave);
                const filas = filasDeLista(actuales.length, campo);

                return (
                  <fieldset key={clave} className="mt-6 border-t border-ink-100 pt-4">
                    <legend className="etiqueta">{campo.label}</legend>
                    {campo.help && <p className="ayuda mb-3">{campo.help}</p>}

                    <div className="space-y-4">
                      {Array.from({ length: filas }, (_, indice) => (
                        <div key={indice} className="rounded-lg bg-ink-50 p-3">
                          <p className="mb-2 text-xs font-medium text-ink-500">
                            {indice + 1}
                            {indice >= actuales.length && ' · nuevo'}
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {Object.entries(campo.itemSchema ?? {}).map(([subclave, subcampo]) => (
                              <CampoEditor
                                key={subclave}
                                campo={subcampo}
                                ruta={[seccion.key, clave, indice, subclave]}
                                valor={valorDe(contenido, [seccion.key, clave, indice, subclave])}
                                assets={assets}
                                soloLectura={!editable}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <p className="ayuda mt-2">
                      Para quitar un elemento, borra su contenido y guarda.
                      {campo.maxItems && ` Máximo ${campo.maxItems}.`}
                    </p>
                  </fieldset>
                );
              })}
          </section>
        ))}

        {editable && (
          <div className="sticky bottom-4 flex justify-end">
            <button type="submit" className="boton-primario shadow-lg">
              Guardar cambios
            </button>
          </div>
        )}
      </form>
    </Shell>
  );
}

function Avisos({ avisos }: { avisos: { error?: string; ok?: string; detalle?: string } }) {
  const mensajes: Record<string, string> = {
    permiso: 'Tu rol no permite hacer ese cambio.',
    contenido: 'Hay un campo con un valor que la plantilla no acepta.',
    guardar: 'No se pudo guardar. Intenta de nuevo.',
    precio: 'El precio debe ser un entero mayor o igual a cero.',
    comparar: 'El precio anterior debe ser mayor que el actual.',
    oferta: 'No se pudo guardar la oferta.',
    no_offer: 'Configura la oferta antes de publicar.',
    invalid_content: 'Falta contenido obligatorio para publicar.',
    not_found: 'No se encontró el sitio.',
    error: 'No se pudo completar la operación.',
  };

  const exitos: Record<string, string> = {
    guardado: 'Cambios guardados.',
    oferta: 'Oferta guardada.',
    publicado: 'Publicado. Ya es la versión pública.',
  };

  if (avisos.ok && exitos[avisos.ok]) {
    return (
      <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">
        {exitos[avisos.ok]}
      </p>
    );
  }

  if (avisos.error) {
    return (
      <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">
        {mensajes[avisos.error] ?? mensajes.error}
        {avisos.detalle && <span className="block text-xs opacity-80">{avisos.detalle}</span>}
      </p>
    );
  }

  return null;
}

function primero<T>(valor: T | T[] | null | undefined): T | undefined {
  if (!valor) return undefined;
  return Array.isArray(valor) ? valor[0] : valor;
}
