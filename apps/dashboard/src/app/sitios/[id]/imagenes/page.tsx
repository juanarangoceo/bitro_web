import Image from 'next/image';
import { notFound, redirect } from 'next/navigation';
import { parseContentSchema, templateManifestSchema } from '@nitro-web/contracts';
import { Shell } from '@/components/Shell';
import { puedeEditar, requerirSesion } from '@/lib/session';
import { supabaseServidor } from '@/lib/supabase';

const BUCKET = 'site-assets';

/** MIME aceptados por el bucket. SVG queda fuera: puede contener scripts. */
const MIME_VALIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const TAMANO_MAXIMO = 5 * 1024 * 1024;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string; detalle?: string }>;
};

/**
 * Carga de imágenes por `asset_slot`.
 *
 * Los espacios no son una lista libre: los declara el manifest de la plantilla,
 * con su proporción y tamaño mínimo. Subir una foto 4:5 donde va una cuadrada
 * la recorta por donde no debe, así que la interfaz muestra esos requisitos
 * junto a cada espacio en vez de dejarlos en la documentación.
 */
export default async function ImagenesPage({ params, searchParams }: Props) {
  const { id } = await params;
  const avisos = await searchParams;

  const sesion = await requerirSesion();
  const supabase = await supabaseServidor();

  const { data: sitio } = await supabase
    .from('sites')
    .select('id, name, tenant_id, template_versions:template_version_id ( manifest_json, content_schema )')
    .eq('id', id)
    .maybeSingle();

  if (!sitio) notFound();

  const version = primero(sitio.template_versions);
  const manifest = templateManifestSchema.safeParse(version?.manifest_json);
  const slots = manifest.success ? manifest.data.asset_slots : {};

  // El schema dice qué campos usan cada slot: útil para saber dónde aparecerá.
  const schema = (() => {
    try {
      return parseContentSchema(version?.content_schema);
    } catch {
      return null;
    }
  })();

  const usosPorSlot = new Map<string, string[]>();
  for (const seccion of schema?.sections ?? []) {
    for (const [clave, campo] of Object.entries(seccion.fields)) {
      if (campo.type === 'image' && campo.assetSlot) {
        const previos = usosPorSlot.get(campo.assetSlot) ?? [];
        usosPorSlot.set(campo.assetSlot, [...previos, `${seccion.label} · ${campo.label}`]);
      }
      for (const [subclave, subcampo] of Object.entries(campo.itemSchema ?? {})) {
        if (subcampo.type === 'image' && subcampo.assetSlot) {
          const previos = usosPorSlot.get(subcampo.assetSlot) ?? [];
          usosPorSlot.set(subcampo.assetSlot, [...previos, `${seccion.label} · ${clave}.${subclave}`]);
        }
      }
    }
  }

  const { data: assets } = await supabase
    .from('assets')
    .select('id, asset_slot, storage_path, mime_type, byte_size, width, height, alt_text')
    .eq('site_id', id)
    .order('created_at', { ascending: false });

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const editable = puedeEditar(sesion);

  async function subir(formData: FormData) {
    'use server';

    const s = await requerirSesion();
    if (!puedeEditar(s)) redirect(`/sitios/${id}/imagenes?error=permiso`);

    const archivo = formData.get('archivo');
    const slot = String(formData.get('slot') ?? '').trim();
    const alt = String(formData.get('alt_text') ?? '').trim();

    if (!(archivo instanceof File) || archivo.size === 0) {
      redirect(`/sitios/${id}/imagenes?error=archivo`);
    }
    if (!MIME_VALIDOS.includes(archivo.type)) {
      redirect(`/sitios/${id}/imagenes?error=tipo&detalle=${encodeURIComponent(archivo.type)}`);
    }
    if (archivo.size > TAMANO_MAXIMO) {
      redirect(`/sitios/${id}/imagenes?error=tamano`);
    }

    const db = await supabaseServidor();

    const extension = archivo.name.includes('.') ? archivo.name.slice(archivo.name.lastIndexOf('.')) : '';
    // La ruta empieza por el tenant porque esa carpeta es la frontera que
    // comprueban las políticas de Storage; el sufijo de tiempo evita pisar una
    // imagen que una publicación viva pueda seguir usando.
    const rutaStorage = `${s.tenantId}/${id}/${slot || 'sin-slot'}-${Date.now()}${extension}`;

    const { error: errorSubida } = await db.storage
      .from(BUCKET)
      .upload(rutaStorage, archivo, { contentType: archivo.type, upsert: false });

    if (errorSubida) {
      redirect(`/sitios/${id}/imagenes?error=subida&detalle=${encodeURIComponent(errorSubida.message)}`);
    }

    const { error: errorAsset } = await db.from('assets').insert({
      tenant_id: s.tenantId,
      site_id: id,
      storage_path: rutaStorage,
      mime_type: archivo.type,
      byte_size: archivo.size,
      asset_slot: slot || null,
      alt_text: alt || null,
      created_by: s.userId,
    });

    if (errorAsset) {
      // Sin fila que lo represente, el archivo es un huérfano que nadie podrá
      // atribuir ni limpiar con criterio.
      await db.storage.from(BUCKET).remove([rutaStorage]);
      redirect(`/sitios/${id}/imagenes?error=registro`);
    }

    redirect(`/sitios/${id}/imagenes?ok=subida`);
  }

  return (
    <Shell
      sesion={sesion}
      titulo={`Imágenes · ${sitio.name}`}
      volverA={{ href: `/sitios/${id}`, texto: 'Volver a la landing' }}
    >
      {avisos.ok && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">
          Imagen subida.
        </p>
      )}
      {avisos.error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">
          {
            {
              permiso: 'Tu rol no permite subir imágenes.',
              archivo: 'Elige un archivo.',
              tipo: 'Ese formato no se acepta. Usa JPG, PNG, WebP o AVIF.',
              tamano: 'La imagen supera los 5 MB.',
              subida: 'No se pudo subir el archivo.',
              registro: 'El archivo se subió pero no se pudo registrar.',
            }[avisos.error] ?? 'No se pudo completar la operación.'
          }
          {avisos.detalle && <span className="block text-xs opacity-80">{avisos.detalle}</span>}
        </p>
      )}

      {editable && (
        <form action={subir} className="tarjeta mb-8 space-y-4 p-5">
          <h2 className="font-medium">Subir una imagen</h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="etiqueta" htmlFor="slot">Espacio</label>
              <select id="slot" name="slot" required className="campo mt-1">
                {Object.entries(slots).map(([clave, def]) => (
                  <option key={clave} value={clave}>
                    {clave}
                    {def.ratio ? ` (${def.ratio})` : ''}
                    {def.required ? ' · obligatorio' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="etiqueta" htmlFor="archivo">Archivo</label>
              <input
                id="archivo"
                name="archivo"
                type="file"
                accept={MIME_VALIDOS.join(',')}
                required
                className="campo mt-1"
              />
              <p className="ayuda">JPG, PNG, WebP o AVIF. Máximo 5 MB.</p>
            </div>

            <div>
              <label className="etiqueta" htmlFor="alt_text">Texto alternativo</label>
              <input id="alt_text" name="alt_text" className="campo mt-1" />
              <p className="ayuda">Describe la imagen para quien no puede verla.</p>
            </div>
          </div>

          <button type="submit" className="boton-primario">Subir</button>
        </form>
      )}

      <section className="mb-8">
        <h2 className="mb-3 font-medium">Espacios de esta plantilla</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(slots).map(([clave, def]) => {
            const subidas = (assets ?? []).filter((a) => a.asset_slot === clave);
            return (
              <div key={clave} className="tarjeta p-4 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{clave}</p>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      def.required && subidas.length === 0
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-ink-100 text-ink-600'
                    }`}
                  >
                    {subidas.length} subida{subidas.length === 1 ? '' : 's'}
                    {def.required && subidas.length === 0 && ' · falta'}
                  </span>
                </div>
                {def.purpose && <p className="ayuda">{def.purpose}</p>}
                <p className="ayuda">
                  {def.ratio && `Proporción ${def.ratio}. `}
                  {def.minWidth && def.minHeight && `Mínimo ${def.minWidth}×${def.minHeight}. `}
                  {def.max && `Hasta ${def.max}.`}
                </p>
                {usosPorSlot.get(clave) && (
                  <p className="ayuda">Se usa en: {usosPorSlot.get(clave)?.join(', ')}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-medium">Subidas</h2>
        {(assets ?? []).length === 0 ? (
          <p className="text-sm text-ink-500">Todavía no hay imágenes.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {(assets ?? []).map((a) => (
              <figure key={a.id} className="tarjeta overflow-hidden">
                <div className="relative aspect-square bg-ink-100">
                  <Image
                    src={`${base}/storage/v1/object/public/${BUCKET}/${a.storage_path}`}
                    alt={a.alt_text ?? ''}
                    fill
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className="object-cover"
                  />
                </div>
                <figcaption className="p-3 text-xs text-ink-600">
                  <p className="font-medium text-ink-800">{a.asset_slot ?? 'sin espacio'}</p>
                  <p>
                    {a.width && a.height ? `${a.width}×${a.height} · ` : ''}
                    {Math.round(a.byte_size / 1024)} kB
                  </p>
                  <p className="mt-1 break-all font-mono text-[10px] text-ink-400">{a.id}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
    </Shell>
  );
}

function primero<T>(valor: T | T[] | null | undefined): T | undefined {
  if (!valor) return undefined;
  return Array.isArray(valor) ? valor[0] : valor;
}
