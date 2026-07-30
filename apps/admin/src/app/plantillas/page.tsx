import Link from 'next/link';
import { createSecretClient } from '@nitro-web/db';
import { redirect } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { auditar, requerirOperador } from '@/lib/admin';

export default async function Plantillas({ searchParams }: {
  searchParams: Promise<{ error?: string }>;
}) {
  const operador = await requerirOperador();
  const mensajes = await searchParams;
  const db = createSecretClient();
  const [{ data: plantillas }, { data: tenants }] = await Promise.all([
    db.from('templates').select('id, template_key, display_name, category, visibility, origin, updated_at, template_versions ( id, version, status )').order('updated_at', { ascending: false }),
    db.from('tenants').select('id, name').eq('status', 'active').order('name'),
  ]);

  async function crear(formData: FormData) {
    'use server';
    const actor = await requerirOperador();
    const key = String(formData.get('template_key') ?? '').trim();
    const nombre = String(formData.get('display_name') ?? '').trim();
    const visibilidad = String(formData.get('visibility') ?? 'hidden');
    const owner = String(formData.get('owner_tenant_id') ?? '') || null;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(key) || !nombre || !['public', 'private', 'hidden'].includes(visibilidad) || (visibilidad === 'private' && !owner)) redirect('/plantillas?error=datos');
    const secreto = createSecretClient();
    const { data, error } = await secreto.from('templates').insert({
      template_key: key, display_name: nombre, category: String(formData.get('category') ?? '').trim() || null,
      visibility: visibilidad as 'public' | 'private' | 'hidden',
      origin: owner ? 'custom' : 'catalog', owner_tenant_id: owner,
    }).select('id').single();
    if (error || !data) redirect('/plantillas?error=crear');
    await auditar({ operador: actor, accion: 'template.created', tenantId: owner ?? undefined, entidad: 'template', entidadId: data.id, payload: { template_key: key, visibility: visibilidad } });
    redirect(`/plantillas/${data.id}?creada=1`);
  }

  return <Shell operador={operador} titulo="Plantillas">
    {mensajes.error && <p className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-800">No se pudo crear la plantilla.</p>}
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">{(plantillas ?? []).map(t => <Link href={`/plantillas/${t.id}`} key={t.id} className="tarjeta block p-4 hover:border-brand-500">
        <div className="flex justify-between gap-3"><div><p className="font-medium">{t.display_name}</p><p className="text-xs text-ink-500">{t.template_key} · {t.category ?? 'sin categoría'}</p></div>
          <div className="text-right text-xs"><p>{t.visibility}</p><p className="text-ink-500">{t.template_versions?.length ?? 0} versiones</p></div></div>
      </Link>)}</div>
      <form action={crear} className="tarjeta h-fit space-y-4 p-5"><h2 className="font-medium">Nueva plantilla</h2>
        <Campo nombre="display_name" etiqueta="Nombre" /><Campo nombre="template_key" etiqueta="Clave estable" ayuda="kebab-case, por ejemplo cocina-premium" /><Campo nombre="category" etiqueta="Categoría" requerido={false} />
        <div><label className="etiqueta">Visibilidad</label><select name="visibility" className="campo mt-1"><option value="hidden">Oculta</option><option value="public">Pública</option><option value="private">Privada</option></select></div>
        <div><label className="etiqueta">Tenant dueño (solo privada)</label><select name="owner_tenant_id" className="campo mt-1"><option value="">Ninguno</option>{(tenants ?? []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <button className="boton-primario w-full">Crear plantilla</button>
      </form>
    </div>
  </Shell>;
}
function Campo({ nombre, etiqueta, ayuda, requerido = true }: { nombre: string; etiqueta: string; ayuda?: string; requerido?: boolean }) { return <div><label className="etiqueta">{etiqueta}</label><input name={nombre} required={requerido} className="campo mt-1" />{ayuda && <p className="ayuda">{ayuda}</p>}</div>; }

