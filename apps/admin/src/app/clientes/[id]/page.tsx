import { createSecretClient } from '@nitro-web/db';
import { redirect, notFound } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { auditar, requerirOperador } from '@/lib/admin';

export default async function Cliente({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const operador = await requerirOperador();
  const { id } = await params;
  const mensajes = await searchParams;
  const db = createSecretClient();
  const [{ data: cliente }, { data: planes }, { data: versiones }, { data: miembros }, { data: usuariosAuth }] = await Promise.all([
    db.from('tenants').select('*, sites ( id, name, status, template_version_id, domains ( hostname, status, is_canonical ) )').eq('id', id).maybeSingle(),
    db.from('plans').select('id, display_name').order('sort_order'),
    db.from('template_versions').select('id, version, default_content, templates ( display_name, template_key )').eq('status', 'published'),
    db.from('tenant_members').select('user_id, role, created_at').eq('tenant_id', id),
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  if (!cliente) notFound();

  async function actualizar(formData: FormData) {
    'use server';
    const actor = await requerirOperador();
    const status = String(formData.get('status'));
    const billing = String(formData.get('billing_status'));
    const plan = String(formData.get('plan_id'));
    if (!['active', 'suspended', 'archived'].includes(status) || !['trial', 'active', 'past_due', 'suspended'].includes(billing)) redirect(`/clientes/${id}?error=datos`);
    const secreto = createSecretClient();
    const { error } = await secreto.from('tenants').update({
      status: status as 'active' | 'suspended' | 'archived',
      billing_status: billing as 'trial' | 'active' | 'past_due' | 'suspended',
      plan_id: plan,
    }).eq('id', id);
    if (error) redirect(`/clientes/${id}?error=actualizar`);
    await auditar({ operador: actor, accion: 'tenant.updated', tenantId: id, entidad: 'tenant', entidadId: id, payload: { status, billing_status: billing, plan_id: plan } });
    redirect(`/clientes/${id}?ok=actualizado`);
  }

  async function invitar(formData: FormData) {
    'use server';
    const actor = await requerirOperador();
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const secreto = createSecretClient();
    const existente = usuariosAuth.users.find((user) => user.email?.toLowerCase() === email);
    const invitacion = existente ? null : await secreto.auth.admin.inviteUserByEmail(email, {
      redirectTo: process.env.NITRO_WEB_DASHBOARD_URL,
      data: { tenant_id: id },
    });
    if (invitacion?.error || (!existente && !invitacion?.data.user)) redirect(`/clientes/${id}?error=invitar`);
    const userId = existente?.id ?? invitacion?.data.user?.id;
    if (!userId) redirect(`/clientes/${id}?error=invitar`);
    const { error: membershipError } = await secreto.from('tenant_members').upsert({
      tenant_id: id, user_id: userId, role: 'owner', invited_by: actor.userId,
    });
    if (membershipError) redirect(`/clientes/${id}?error=membresia`);
    await auditar({ operador: actor, accion: 'tenant.owner_invited', tenantId: id, entidad: 'tenant', entidadId: id, payload: { email } });
    redirect(`/clientes/${id}?ok=invitado`);
  }

  async function actualizarMiembro(formData: FormData) {
    'use server';
    const actor = await requerirOperador();
    const userId = String(formData.get('user_id') ?? '');
    const role = String(formData.get('role') ?? '');
    if (!['owner', 'editor', 'viewer'].includes(role)) redirect(`/clientes/${id}?error=rol`);
    const secreto = createSecretClient();
    const { error } = await secreto.from('tenant_members').update({
      role: role as 'owner' | 'editor' | 'viewer',
    }).eq('tenant_id', id).eq('user_id', userId);
    if (error) redirect(`/clientes/${id}?error=rol`);
    await auditar({ operador: actor, accion: 'tenant_member.role_updated', tenantId: id, entidad: 'tenant', entidadId: id, payload: { user_id: userId, role } });
    redirect(`/clientes/${id}?ok=rol`);
  }

  async function crearSitio(formData: FormData) {
    'use server';
    const actor = await requerirOperador();
    const nombre = String(formData.get('nombre') ?? '').trim();
    const versionId = String(formData.get('template_version_id') ?? '');
    const secreto = createSecretClient();
    const { data: version } = await secreto.from('template_versions').select('id, default_content').eq('id', versionId).eq('status', 'published').maybeSingle();
    if (!nombre || !version) redirect(`/clientes/${id}?error=sitio`);
    const { data: sitio, error } = await secreto.from('sites').insert({ tenant_id: id, template_version_id: version.id, name: nombre, status: 'draft' }).select('id').single();
    if (error || !sitio) redirect(`/clientes/${id}?error=sitio`);
    const { error: draftError } = await secreto.from('site_content_drafts').insert({ tenant_id: id, site_id: sitio.id, content_json: version.default_content, updated_by: actor.userId });
    if (draftError) redirect(`/clientes/${id}?error=borrador`);
    await auditar({ operador: actor, accion: 'site.created', tenantId: id, entidad: 'site', entidadId: sitio.id, payload: { name: nombre, template_version_id: version.id } });
    redirect(`/sitios/${sitio.id}?creado=1`);
  }

  return <Shell operador={operador} titulo={cliente.name}>
    <div className="mb-5"><a href={`/clientes/${id}/operacion`} className="boton-secundario">Pedidos, métricas, consumo y auditoría</a></div>
    {(mensajes.ok || mensajes.error) && <p className={`mb-5 rounded-lg p-3 text-sm ${mensajes.error ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>{mensajes.error ? 'La operación no pudo completarse.' : 'Operación completada.'}</p>}
    <div className="grid gap-6 lg:grid-cols-2">
      <form action={actualizar} className="tarjeta space-y-4 p-5"><h2 className="font-medium">Cuenta</h2>
        <Select nombre="status" etiqueta="Estado operativo" valor={cliente.status} opciones={['active', 'suspended', 'archived']} />
        <Select nombre="billing_status" etiqueta="Estado de cobro" valor={cliente.billing_status} opciones={['trial', 'active', 'past_due', 'suspended']} />
        <div><label className="etiqueta">Plan</label><select className="campo mt-1" name="plan_id" defaultValue={cliente.plan_id ?? ''}>{(planes ?? []).map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select></div>
        <button className="boton-primario">Guardar</button>
      </form>
      <form action={invitar} className="tarjeta h-fit space-y-4 p-5"><h2 className="font-medium">Propietario</h2>
        <p className="text-sm text-ink-500">{miembros?.length ?? 0} membresías actuales.</p>
        <div><label className="etiqueta">Correo</label><input name="email" type="email" required className="campo mt-1" /></div>
        <button className="boton-primario">Invitar y asignar como owner</button>
        <div className="space-y-2 border-t pt-4">{(miembros ?? []).map(m => {
          const usuario = usuariosAuth.users.find(u => u.id === m.user_id);
          return <form action={actualizarMiembro} key={m.user_id} className="flex items-center gap-2"><input type="hidden" name="user_id" value={m.user_id} /><span className="min-w-0 flex-1 truncate text-xs">{usuario?.email ?? m.user_id}</span><select name="role" defaultValue={m.role} className="rounded border px-2 py-1 text-xs"><option>owner</option><option>editor</option><option>viewer</option></select><button className="text-xs text-brand-700 underline">Guardar</button></form>;
        })}</div>
      </form>
    </div>
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
      <div><h2 className="mb-3 font-medium">Sitios</h2><div className="space-y-3">{(cliente.sites ?? []).map(s => <a href={`/sitios/${s.id}`} key={s.id} className="tarjeta block p-4 hover:border-brand-500"><div className="flex justify-between"><span>{s.name}</span><span className="text-xs text-ink-500">{s.status}</span></div></a>)}</div></div>
      <form action={crearSitio} className="tarjeta h-fit space-y-4 p-5"><h2 className="font-medium">Instalar plantilla</h2>
        <div><label className="etiqueta">Nombre interno</label><input className="campo mt-1" name="nombre" required /></div>
        <div><label className="etiqueta">Versión</label><select className="campo mt-1" name="template_version_id">{(versiones ?? []).map(v => { const t = uno(v.templates); return <option key={v.id} value={v.id}>{t?.display_name} {v.version}</option>; })}</select></div>
        <button className="boton-primario w-full">Crear sitio</button>
      </form>
    </div>
  </Shell>;
}

function Select({ nombre, etiqueta, valor, opciones }: { nombre: string; etiqueta: string; valor: string; opciones: string[] }) {
  return <div><label className="etiqueta">{etiqueta}</label><select name={nombre} defaultValue={valor} className="campo mt-1">{opciones.map(o => <option key={o}>{o}</option>)}</select></div>;
}
function uno<T>(valor: T | T[] | null): T | undefined { return Array.isArray(valor) ? valor[0] : valor ?? undefined; }
