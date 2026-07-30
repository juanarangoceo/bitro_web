import { validateManifest } from '@nitro-web/contracts';
import { createSecretClient, type Json } from '@nitro-web/db';
import { isComponentRegistered } from '@nitro-web/templates';
import { notFound, redirect } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { auditar, requerirOperador } from '@/lib/admin';

export default async function Plantilla({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const operador = await requerirOperador();
  const { id } = await params;
  const mensajes = await searchParams;
  const db = createSecretClient();
  const { data: plantilla } = await db.from('templates').select('*, template_versions ( id, version, status, component_key, changelog, published_at, created_at )').eq('id', id).maybeSingle();
  if (!plantilla) notFound();
  const plantillaActual = plantilla;
  const ejemplo = JSON.stringify({
    template_key: plantilla.template_key, version: '1.0.0', display_name: plantilla.display_name,
    category: plantilla.category ?? undefined, component_key: 'componenteRegistrado',
    content_schema: { version: 1, sections: [] }, default_content: {}, asset_slots: {},
    ai_sections: [], compatibility: { min_renderer_version: '1.0.0', capabilities: [] },
    visibility: plantilla.visibility, owner_tenant_id: plantilla.owner_tenant_id, origin: plantilla.origin,
  }, null, 2);

  async function crearVersion(formData: FormData) {
    'use server';
    const actor = await requerirOperador();
    let entrada: unknown;
    try { entrada = JSON.parse(String(formData.get('manifest') ?? '')); }
    catch { redirect(`/plantillas/${id}?error=json_invalido`); }
    const validacion = validateManifest(entrada);
    if (!validacion.ok) redirect(`/plantillas/${id}?error=${encodeURIComponent(validacion.errors.slice(0, 3).join(' | '))}`);
    const manifest = validacion.manifest;
    if (manifest.template_key !== plantillaActual.template_key) redirect(`/plantillas/${id}?error=template_key_no_coincide`);
    const secreto = createSecretClient();
    const { data, error } = await secreto.from('template_versions').insert({
      template_id: id, version: manifest.version, status: 'development',
      component_key: manifest.component_key, manifest_json: manifest as unknown as Json,
      content_schema: manifest.content_schema as unknown as Json,
      default_content: manifest.default_content as Json,
      min_renderer_version: manifest.compatibility.min_renderer_version,
      changelog: String(formData.get('changelog') ?? '').trim() || null,
    }).select('id').single();
    if (error || !data) redirect(`/plantillas/${id}?error=no_se_pudo_crear`);
    await auditar({ operador: actor, accion: 'template_version.created', tenantId: plantillaActual.owner_tenant_id ?? undefined, entidad: 'template_version', entidadId: data.id, payload: { version: manifest.version, component_key: manifest.component_key } });
    redirect(`/plantillas/${id}?ok=version`);
  }

  async function cambiarEstado(formData: FormData) {
    'use server';
    const actor = await requerirOperador();
    const versionId = String(formData.get('version_id') ?? '');
    const estado = String(formData.get('status') ?? '');
    if (!['development', 'preview', 'approved', 'published', 'hidden', 'deprecated'].includes(estado)) redirect(`/plantillas/${id}?error=estado_invalido`);
    const secreto = createSecretClient();
    const { data: version } = await secreto.from('template_versions').select('component_key, status').eq('id', versionId).eq('template_id', id).maybeSingle();
    if (!version) redirect(`/plantillas/${id}?error=version_no_existe`);
    const permitidas: Record<string, string[]> = {
      development: ['preview'],
      preview: ['development', 'approved'],
      approved: ['preview', 'published'],
      published: ['hidden', 'deprecated'],
    };
    if (!(permitidas[version.status] ?? []).includes(estado)) redirect(`/plantillas/${id}?error=transicion_invalida`);
    if (estado === 'published' && !isComponentRegistered(version.component_key)) redirect(`/plantillas/${id}?error=componente_no_registrado`);
    const { error } = await secreto.from('template_versions').update({
      status: estado as 'development' | 'preview' | 'approved' | 'published' | 'hidden' | 'deprecated',
      published_at: estado === 'published' ? new Date().toISOString() : undefined,
    }).eq('id', versionId).eq('template_id', id);
    if (error) redirect(`/plantillas/${id}?error=no_se_pudo_cambiar`);
    await auditar({ operador: actor, accion: 'template_version.status_updated', tenantId: plantillaActual.owner_tenant_id ?? undefined, entidad: 'template_version', entidadId: versionId, payload: { from: version.status, to: estado } });
    redirect(`/plantillas/${id}?ok=estado`);
  }

  async function actualizarCatalogo(formData: FormData) {
    'use server';
    const actor = await requerirOperador();
    const visibility = String(formData.get('visibility') ?? '');
    const displayName = String(formData.get('display_name') ?? '').trim();
    if (!displayName || !['public', 'private', 'hidden'].includes(visibility)) redirect(`/plantillas/${id}?error=datos_catalogo`);
    if (visibility === 'private' && !plantillaActual.owner_tenant_id) redirect(`/plantillas/${id}?error=privada_sin_tenant`);
    const secreto = createSecretClient();
    const { error } = await secreto.from('templates').update({
      display_name: displayName,
      category: String(formData.get('category') ?? '').trim() || null,
      description: String(formData.get('description') ?? '').trim() || null,
      visibility: visibility as 'public' | 'private' | 'hidden',
      is_featured: formData.get('is_featured') === 'on',
    }).eq('id', id);
    if (error) redirect(`/plantillas/${id}?error=no_se_actualizo_catalogo`);
    await auditar({ operador: actor, accion: 'template.updated', tenantId: plantillaActual.owner_tenant_id ?? undefined, entidad: 'template', entidadId: id, payload: { visibility, display_name: displayName } });
    redirect(`/plantillas/${id}?ok=catalogo`);
  }

  return <Shell operador={operador} titulo={plantilla.display_name}>
    <p className="mb-6 text-sm text-ink-500">{plantilla.template_key} · {plantilla.visibility} · {plantilla.origin}</p>
    {(mensajes.ok || mensajes.error) && <p className={`mb-5 rounded-lg p-3 text-sm ${mensajes.error ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>{mensajes.error ? decodeURIComponent(mensajes.error) : 'Operación completada.'}</p>}
    <form action={actualizarCatalogo} className="tarjeta mb-8 grid gap-4 p-5 sm:grid-cols-2">
      <div><label className="etiqueta">Nombre</label><input className="campo mt-1" name="display_name" defaultValue={plantilla.display_name} required /></div>
      <div><label className="etiqueta">Categoría</label><input className="campo mt-1" name="category" defaultValue={plantilla.category ?? ''} /></div>
      <div className="sm:col-span-2"><label className="etiqueta">Descripción</label><textarea className="campo mt-1" name="description" defaultValue={plantilla.description ?? ''} /></div>
      <div><label className="etiqueta">Visibilidad</label><select className="campo mt-1" name="visibility" defaultValue={plantilla.visibility}><option value="hidden">Oculta</option><option value="public">Pública</option><option value="private">Privada</option></select></div>
      <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="is_featured" defaultChecked={plantilla.is_featured} />Destacada</label>
      <div className="sm:col-span-2"><button className="boton-secundario">Guardar catálogo</button></div>
    </form>
    <div className="space-y-3">{(plantilla.template_versions ?? []).sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true })).map(v => <div className="tarjeta flex flex-wrap items-center justify-between gap-4 p-4" key={v.id}>
      <div><p className="font-medium">{v.version} <span className="ml-2 rounded bg-ink-100 px-2 py-1 text-xs">{v.status}</span></p><p className="mt-1 text-xs text-ink-500">{v.component_key}{v.changelog ? ` · ${v.changelog}` : ''}</p></div>
      <form action={cambiarEstado} className="flex gap-2"><input type="hidden" name="version_id" value={v.id} /><select name="status" className="campo">
        {transiciones(v.status).map(s => <option key={s}>{s}</option>)}
      </select><button className="boton-secundario">Cambiar</button></form>
    </div>)}</div>
    <form action={crearVersion} className="tarjeta mt-8 space-y-4 p-5">
      <div><h2 className="font-medium">Crear versión</h2><p className="ayuda">El manifest completo alimenta editor, validación e IA. Se valida antes de guardar.</p></div>
      <div><label className="etiqueta">Changelog</label><input name="changelog" className="campo mt-1" /></div>
      <div><label className="etiqueta">Manifest JSON</label><textarea name="manifest" required rows={24} defaultValue={ejemplo} className="campo mt-1 font-mono text-xs" /></div>
      <button className="boton-primario">Validar y crear en desarrollo</button>
    </form>
  </Shell>;
}

function transiciones(actual: string): string[] {
  if (actual === 'development') return ['preview'];
  if (actual === 'preview') return ['development', 'approved'];
  if (actual === 'approved') return ['preview', 'published'];
  if (actual === 'published') return ['hidden', 'deprecated'];
  if (actual === 'hidden' || actual === 'deprecated') return [actual];
  return [actual];
}
