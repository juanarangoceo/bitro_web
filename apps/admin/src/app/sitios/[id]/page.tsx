import { createSecretClient, publishSiteAsSupport, rollbackSiteAsSupport } from '@nitro-web/db';
import { normalizeHostname } from '@nitro-web/shared';
import { notFound, redirect } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { auditar, requerirOperador } from '@/lib/admin';
import { invalidarRenderer } from '@/lib/cache-renderer';
import { agregarDominioAlRenderer, retirarDominioDelRenderer, verificarDominioDelRenderer } from '@/lib/vercel';

export default async function Sitio({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const operador = await requerirOperador();
  const { id } = await params;
  const mensajes = await searchParams;
  const db = createSecretClient();
  const { data: sitio } = await db.from('sites').select(
    '*, tenants ( name ), template_versions ( version, templates ( display_name ) ), domains ( id, hostname, status, is_canonical, is_subdomain ), offers ( id, title, price_amount, compare_at_amount, shipping_amount, currency, inventory, is_active ), publications:site_publications!site_publications_site_id_fkey ( id, publication_number, published_at )',
  ).eq('id', id).maybeSingle();
  if (!sitio) notFound();
  const sitioActual = sitio;
  const tenant = uno(sitio.tenants); const version = uno(sitio.template_versions); const plantilla = uno(version?.templates); const oferta = uno(sitio.offers);

  async function estado(formData: FormData) {
    'use server';
    const actor = await requerirOperador();
    const valor = String(formData.get('status'));
    const permitidos = sitioActual.published_publication_id
      ? ['published', 'paused', 'archived']
      : ['draft', 'archived'];
    if (!permitidos.includes(valor)) redirect(`/sitios/${id}?error=estado`);
    const secreto = createSecretClient();
    const { error } = await secreto.from('sites').update({
      status: valor as 'draft' | 'published' | 'paused' | 'archived',
      archived_at: valor === 'archived' ? new Date().toISOString() : null,
    }).eq('id', id);
    if (error) redirect(`/sitios/${id}?error=estado`);
    await auditar({ operador: actor, accion: 'site.status_updated', tenantId: sitioActual.tenant_id, entidad: 'site', entidadId: id, payload: { status: valor } });
    redirect(`/sitios/${id}?ok=estado`);
  }

  async function guardarOferta(formData: FormData) {
    'use server';
    const actor = await requerirOperador();
    const precio = Number(formData.get('price_amount'));
    const envio = Number(formData.get('shipping_amount') ?? 0);
    const anteriorRaw = String(formData.get('compare_at_amount') ?? '').trim();
    const anterior = anteriorRaw ? Number(anteriorRaw) : null;
    const titulo = String(formData.get('title') ?? '').trim();
    if (!titulo || !Number.isInteger(precio) || precio < 0 || !Number.isInteger(envio) || envio < 0 || (anterior !== null && (!Number.isInteger(anterior) || anterior <= precio))) redirect(`/sitios/${id}?error=oferta`);
    const secreto = createSecretClient();
    const { error } = await secreto.from('offers').upsert({
      site_id: id, tenant_id: sitioActual.tenant_id, title: titulo, price_amount: precio,
      compare_at_amount: anterior, shipping_amount: envio, currency: 'COP',
      is_active: formData.get('is_active') === 'on',
    }, { onConflict: 'site_id' });
    if (error) redirect(`/sitios/${id}?error=oferta`);
    await auditar({ operador: actor, accion: 'offer.updated', tenantId: sitioActual.tenant_id, entidad: 'site', entidadId: id, payload: { price_amount: precio, shipping_amount: envio } });
    redirect(`/sitios/${id}?ok=oferta`);
  }

  async function agregarDominio(formData: FormData) {
    'use server';
    const actor = await requerirOperador();
    let hostname: string;
    try {
      const normalizado = normalizeHostname(String(formData.get('hostname') ?? ''));
      if (!normalizado) redirect(`/sitios/${id}?error=dominio`);
      hostname = normalizado;
    }
    catch { redirect(`/sitios/${id}?error=dominio`); }
    const secreto = createSecretClient();
    const canonico = formData.get('is_canonical') === 'on';
    const esSubdominio = formData.get('is_subdomain') === 'on';
    let estadoVercel: Awaited<ReturnType<typeof agregarDominioAlRenderer>> | undefined;
    if (!esSubdominio) {
      try { estadoVercel = await agregarDominioAlRenderer(hostname); }
      catch (error) {
        const mensaje = error instanceof Error ? error.message : 'Vercel rechazó el dominio';
        redirect(`/sitios/${id}?error=${encodeURIComponent(mensaje)}`);
      }
    }
    const anterioresCanonicos = canonico
      ? (sitioActual.domains ?? []).filter((dominio) => dominio.is_canonical && dominio.status !== 'removed').map((dominio) => dominio.id)
      : [];
    if (canonico) await secreto.from('domains').update({ is_canonical: false }).eq('site_id', id).neq('status', 'removed');
    const { data, error } = await secreto.from('domains').insert({
      tenant_id: sitioActual.tenant_id, site_id: id, hostname,
      status: esSubdominio || estadoVercel?.verified ? 'active' : 'verifying',
      is_canonical: canonico, is_subdomain: esSubdominio,
      verification_json: estadoVercel ? JSON.parse(JSON.stringify(estadoVercel)) : {},
      verified_at: esSubdominio || estadoVercel?.verified ? new Date().toISOString() : null,
      last_checked_at: new Date().toISOString(),
    }).select('id').single();
    if (error || !data) {
      if (anterioresCanonicos.length > 0) {
        await secreto.from('domains').update({ is_canonical: true }).in('id', anterioresCanonicos);
      }
      redirect(`/sitios/${id}?error=dominio`);
    }
    await auditar({ operador: actor, accion: 'domain.created', tenantId: sitioActual.tenant_id, entidad: 'domain', entidadId: data.id, payload: { hostname, is_canonical: canonico } });
    redirect(`/sitios/${id}?ok=dominio`);
  }

  async function activarDominio(formData: FormData) {
    'use server';
    const actor = await requerirOperador();
    const domainId = String(formData.get('domain_id') ?? '');
    const secreto = createSecretClient();
    const { data: dominio } = await secreto.from('domains').select('hostname, is_subdomain').eq('id', domainId).eq('site_id', id).maybeSingle();
    if (!dominio) redirect(`/sitios/${id}?error=activar`);
    let verificacion: Awaited<ReturnType<typeof verificarDominioDelRenderer>> | undefined;
    if (!dominio.is_subdomain) {
      try { verificacion = await verificarDominioDelRenderer(dominio.hostname); }
      catch (error) {
        const mensaje = error instanceof Error ? error.message : 'No se verificó en Vercel';
        redirect(`/sitios/${id}?error=${encodeURIComponent(mensaje)}`);
      }
      if (!verificacion.verified) {
        await secreto.from('domains').update({
          status: 'verifying', last_checked_at: new Date().toISOString(),
          verification_json: JSON.parse(JSON.stringify(verificacion)),
        }).eq('id', domainId);
        redirect(`/sitios/${id}?error=dns_no_configurado`);
      }
    }
    const { data, error } = await secreto.from('domains').update({
      status: 'active', verified_at: new Date().toISOString(), last_checked_at: new Date().toISOString(),
      verification_json: verificacion ? JSON.parse(JSON.stringify(verificacion)) : {},
    }).eq('id', domainId).eq('site_id', id).select('hostname').single();
    if (error || !data) redirect(`/sitios/${id}?error=activar`);
    await auditar({ operador: actor, accion: 'domain.activated', tenantId: sitioActual.tenant_id, entidad: 'domain', entidadId: domainId, payload: { hostname: data.hostname } });
    redirect(`/sitios/${id}?ok=activar`);
  }

  async function publicar(formData: FormData) {
    'use server';
    const actor = await requerirOperador();
    const reviewedBy = String(formData.get('reviewed_by') ?? '').trim();
    const reason = String(formData.get('reason') ?? '').trim();
    const secreto = createSecretClient();
    const result = await publishSiteAsSupport(secreto, id, {
      actorUserId: actor.userId, reviewedBy, reason,
    });
    if (!result.ok) redirect(`/sitios/${id}?error=${encodeURIComponent(result.errors.join(' | '))}`);
    try { await invalidarRenderer(id); }
    catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No se invalidó la caché';
      redirect(`/sitios/${id}?error=${encodeURIComponent(`Publicado; ${mensaje}`)}`);
    }
    redirect(`/sitios/${id}?ok=publicado`);
  }

  async function retirarDominio(formData: FormData) {
    'use server';
    const actor = await requerirOperador();
    const domainId = String(formData.get('domain_id') ?? '');
    const reason = String(formData.get('reason') ?? '').trim();
    if (!reason) redirect(`/sitios/${id}?error=motivo_requerido`);
    const secreto = createSecretClient();
    const { data: dominio } = await secreto.from('domains').select('hostname, is_subdomain').eq('id', domainId).eq('site_id', id).maybeSingle();
    if (!dominio) redirect(`/sitios/${id}?error=dominio_no_existe`);
    // El orden es deliberado: primero deja de resolver en Nitro Web. Si Vercel
    // falla después queda un alias huérfano, no tráfico sirviendo al cliente equivocado.
    const { error } = await secreto.from('domains').update({ status: 'removed', is_canonical: false }).eq('id', domainId).eq('site_id', id);
    if (error) redirect(`/sitios/${id}?error=no_se_retiro`);
    if (!dominio.is_subdomain) {
      try { await retirarDominioDelRenderer(dominio.hostname); }
      catch (vercelError) {
        await auditar({ operador: actor, accion: 'domain.removed_with_vercel_error', tenantId: sitioActual.tenant_id, entidad: 'domain', entidadId: domainId, payload: { hostname: dominio.hostname, error: vercelError instanceof Error ? vercelError.message : 'desconocido' } });
        redirect(`/sitios/${id}?error=retirado_localmente_pero_sigue_en_vercel`);
      }
    }
    await auditar({ operador: actor, accion: 'domain.removed', tenantId: sitioActual.tenant_id, entidad: 'domain', entidadId: domainId, payload: { hostname: dominio.hostname, reason } });
    redirect(`/sitios/${id}?ok=dominio_retirado`);
  }

  async function restaurar(formData: FormData) {
    'use server';
    const actor = await requerirOperador();
    const publicationId = String(formData.get('publication_id') ?? '');
    const reason = String(formData.get('reason') ?? '').trim();
    const secreto = createSecretClient();
    const result = await rollbackSiteAsSupport(secreto, id, publicationId, {
      actorUserId: actor.userId, reason,
    });
    if (!result.ok) redirect(`/sitios/${id}?error=${encodeURIComponent(result.error ?? 'No se restauró')}`);
    try { await invalidarRenderer(id); }
    catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No se invalidó la caché';
      redirect(`/sitios/${id}?error=${encodeURIComponent(`Restaurado; ${mensaje}`)}`);
    }
    redirect(`/sitios/${id}?ok=restaurado`);
  }

  return <Shell operador={operador} titulo={sitio.name}>
    <p className="mb-6 text-sm text-ink-500">{tenant?.name} · {plantilla?.display_name} {version?.version}</p>
    {(mensajes.ok || mensajes.error) && <p className={`mb-5 rounded-lg p-3 text-sm ${mensajes.error ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>{mensajes.error ? 'No se pudo completar la operación.' : 'Cambio guardado.'}</p>}
    <div className="grid gap-6 lg:grid-cols-2">
      <form action={estado} className="tarjeta space-y-4 p-5"><h2 className="font-medium">Estado operativo</h2>
        <select name="status" defaultValue={sitio.status} className="campo">{(sitio.published_publication_id ? ['published', 'paused', 'archived'] : ['draft', 'archived']).map(s => <option key={s}>{s}</option>)}</select>
        <p className="ayuda">Publicar contenido debe hacerse desde el flujo de publicación; este control sirve para pausar o archivar.</p>
        <button className="boton-primario">Guardar estado</button>
      </form>
      <form action={guardarOferta} className="tarjeta space-y-4 p-5"><h2 className="font-medium">Oferta</h2>
        <Entrada nombre="title" etiqueta="Título" valor={oferta?.title} />
        <div className="grid grid-cols-3 gap-3"><Entrada nombre="price_amount" etiqueta="Precio COP" tipo="number" valor={oferta?.price_amount} /><Entrada nombre="compare_at_amount" etiqueta="Precio anterior" tipo="number" valor={oferta?.compare_at_amount} /><Entrada nombre="shipping_amount" etiqueta="Envío" tipo="number" valor={oferta?.shipping_amount ?? 0} /></div>
        <label className="flex gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={oferta?.is_active ?? true} />Oferta activa</label>
        <button className="boton-primario">Guardar oferta</button>
      </form>
    </div>
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
      <div><h2 className="mb-3 font-medium">Dominios</h2><div className="space-y-3">{(sitio.domains ?? []).map(d => <div className="tarjeta p-4" key={d.id}><div className="flex items-center justify-between gap-3"><div><p>{d.hostname}</p><p className="text-xs text-ink-500">{d.status}{d.is_canonical ? ' · canónico' : ''}</p></div>{d.status !== 'active' && d.status !== 'removed' && <form action={activarDominio}><input type="hidden" name="domain_id" value={d.id} /><button className="boton-secundario">Verificar en Vercel</button></form>}</div>
        {d.status !== 'removed' && <form action={retirarDominio} className="mt-3 flex gap-2"><input type="hidden" name="domain_id" value={d.id} /><input name="reason" required placeholder="Motivo para retirar" className="campo" /><button className="boton-secundario text-red-700">Retirar</button></form>}</div>)}</div></div>
      <form action={agregarDominio} className="tarjeta h-fit space-y-4 p-5"><h2 className="font-medium">Conectar dominio</h2><Entrada nombre="hostname" etiqueta="Hostname" />
        <label className="flex gap-2 text-sm"><input type="checkbox" name="is_canonical" defaultChecked />Canónico</label>
        <label className="flex gap-2 text-sm"><input type="checkbox" name="is_subdomain" />Subdominio operativo</label>
        <button className="boton-primario w-full">Agregar pendiente</button>
      </form>
    </div>
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <form action={publicar} className="tarjeta space-y-4 p-5">
        <div><h2 className="font-medium">Publicar como soporte</h2><p className="ayuda">Crea un snapshot validado y registra quién revisó la primera publicación.</p></div>
        <Entrada nombre="reviewed_by" etiqueta="Revisado por" valor={operador.nombre} />
        <div><label className="etiqueta">Motivo y revisión realizada</label><textarea className="campo mt-1" name="reason" rows={3} required /></div>
        <button className="boton-primario">Validar y publicar</button>
      </form>
      <div><h2 className="mb-3 font-medium">Historial y rollback</h2><div className="space-y-3">{(sitio.publications ?? []).sort((a, b) => b.publication_number - a.publication_number).map(p => <div className="tarjeta p-4" key={p.id}>
        <div className="flex justify-between gap-3"><div><p className="font-medium">Publicación #{p.publication_number}</p><p className="text-xs text-ink-500">{new Date(p.published_at).toLocaleString('es-CO')}</p></div>{sitio.published_publication_id === p.id && <span className="h-fit rounded bg-green-100 px-2 py-1 text-xs text-green-800">vigente</span>}</div>
        {sitio.published_publication_id !== p.id && <form action={restaurar} className="mt-3 flex gap-2"><input type="hidden" name="publication_id" value={p.id} /><input name="reason" required placeholder="Motivo del rollback" className="campo" /><button className="boton-secundario">Restaurar</button></form>}
      </div>)}</div></div>
    </div>
  </Shell>;
}
function Entrada({ nombre, etiqueta, tipo = 'text', valor }: { nombre: string; etiqueta: string; tipo?: string; valor?: string | number | null }) { return <div><label className="etiqueta">{etiqueta}</label><input name={nombre} type={tipo} required={nombre !== 'compare_at_amount'} defaultValue={valor ?? ''} className="campo mt-1" /></div>; }
function uno<T>(valor: T | T[] | null | undefined): T | undefined { return Array.isArray(valor) ? valor[0] : valor ?? undefined; }
