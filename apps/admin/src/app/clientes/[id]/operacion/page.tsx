import { createSecretClient } from '@nitro-web/db';
import { formatMoney, ORDER_STATUSES, type Currency } from '@nitro-web/shared';
import { notFound, redirect } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { auditar, requerirOperador } from '@/lib/admin';

export default async function OperacionCliente({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const operador = await requerirOperador();
  const { id } = await params;
  const mensajes = await searchParams;
  const db = createSecretClient();
  const desde = new Date();
  desde.setDate(desde.getDate() - 30);
  const periodo = new Date().toISOString().slice(0, 7) + '-01';
  const [
    { data: cliente }, { data: pedidos }, { data: metricas }, { data: consumo },
    { data: generaciones }, { data: notas }, { data: auditoria },
  ] = await Promise.all([
    db.from('tenants').select('id, name, plan_id, status, billing_status').eq('id', id).maybeSingle(),
    db.from('orders').select('id, order_number, status, customer_name, customer_phone, city, total_amount, currency, created_at, sites ( name )').eq('tenant_id', id).order('created_at', { ascending: false }).limit(100),
    db.from('site_metrics_daily').select('page_views, orders, revenue, revenue_cancelled').eq('tenant_id', id).gte('metric_date', desde.toISOString().slice(0, 10)),
    db.from('usage_monthly').select('metric, value').eq('tenant_id', id).eq('period', periodo),
    db.from('ai_generations').select('status, input_tokens, output_tokens, cost_micros, created_at, model').eq('tenant_id', id).order('created_at', { ascending: false }).limit(50),
    db.from('admin_notes').select('id, body, created_at, author_user_id').eq('entity_type', 'tenant').eq('entity_id', id).order('created_at', { ascending: false }),
    db.from('audit_log').select('id, action, entity_type, support_reason, actor_user_id, created_at, payload_json').eq('tenant_id', id).order('created_at', { ascending: false }).limit(100),
  ]);
  if (!cliente) notFound();

  const totales = (metricas ?? []).reduce((acc, item) => ({
    vistas: acc.vistas + item.page_views,
    pedidos: acc.pedidos + item.orders,
    ingresos: acc.ingresos + Number(item.revenue) - Number(item.revenue_cancelled),
  }), { vistas: 0, pedidos: 0, ingresos: 0 });
  const ia = (generaciones ?? []).reduce((acc, item) => ({
    tokens: acc.tokens + (item.input_tokens ?? 0) + (item.output_tokens ?? 0),
    costo: acc.costo + Number(item.cost_micros ?? 0),
  }), { tokens: 0, costo: 0 });

  async function guardarEstado(formData: FormData) {
    'use server';
    const actor = await requerirOperador();
    const pedidoId = String(formData.get('pedido_id') ?? '');
    const estado = String(formData.get('estado') ?? '');
    if (!ORDER_STATUSES.includes(estado as (typeof ORDER_STATUSES)[number])) redirect(`/clientes/${id}/operacion?error=estado`);
    const secreto = createSecretClient();
    const { data, error } = await secreto.from('orders').update({
      status: estado as (typeof ORDER_STATUSES)[number],
    }).eq('id', pedidoId).eq('tenant_id', id).select('id').single();
    if (error || !data) redirect(`/clientes/${id}/operacion?error=pedido`);
    await auditar({ operador: actor, accion: 'order.status_updated_as_support', tenantId: id, entidad: 'order', entidadId: pedidoId, payload: { status: estado } });
    redirect(`/clientes/${id}/operacion?ok=pedido`);
  }

  async function agregarNota(formData: FormData) {
    'use server';
    const actor = await requerirOperador();
    const body = String(formData.get('body') ?? '').trim();
    if (!body || body.length > 5000) redirect(`/clientes/${id}/operacion?error=nota`);
    const secreto = createSecretClient();
    const { data, error } = await secreto.from('admin_notes').insert({
      entity_type: 'tenant', entity_id: id, body, author_user_id: actor.userId,
    }).select('id').single();
    if (error || !data) redirect(`/clientes/${id}/operacion?error=nota`);
    await auditar({ operador: actor, accion: 'admin_note.created', tenantId: id, entidad: 'admin_note', entidadId: data.id });
    redirect(`/clientes/${id}/operacion?ok=nota`);
  }

  return <Shell operador={operador} titulo={`Operación · ${cliente.name}`}>
    <a href={`/clientes/${id}`} className="mb-5 inline-block text-sm text-brand-700 underline">← Volver al cliente</a>
    {(mensajes.ok || mensajes.error) && <p className={`mb-5 rounded-lg p-3 text-sm ${mensajes.error ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>{mensajes.error ? 'No se completó la operación.' : 'Operación completada.'}</p>}
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Metrica titulo="Vistas · 30 días" valor={totales.vistas.toLocaleString('es-CO')} />
      <Metrica titulo="Pedidos · 30 días" valor={totales.pedidos.toLocaleString('es-CO')} />
      <Metrica titulo="Ingresos · 30 días" valor={formatMoney(totales.ingresos, 'COP')} />
      <Metrica titulo="Tokens IA · últimas 50" valor={ia.tokens.toLocaleString('es-CO')} />
      <Metrica titulo="Costo IA estimado" valor={`US$ ${(ia.costo / 1_000_000).toFixed(4)}`} />
    </section>
    <section className="tarjeta mt-6 p-5"><h2 className="font-medium">Consumo mensual</h2><div className="mt-3 flex flex-wrap gap-3">{(consumo ?? []).map(c => <span key={c.metric} className="rounded bg-ink-100 px-3 py-2 text-sm">{c.metric}: <strong>{Number(c.value).toLocaleString('es-CO')}</strong></span>)}{(consumo ?? []).length === 0 && <p className="text-sm text-ink-500">Sin consumo registrado este mes.</p>}</div></section>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <section><h2 className="mb-3 font-medium">Pedidos recientes</h2><div className="space-y-3">{(pedidos ?? []).map(p => <div className="tarjeta p-4" key={p.id}>
        <div className="flex flex-wrap justify-between gap-3"><div><p className="font-medium">{p.order_number} · {p.customer_name}</p><p className="text-xs text-ink-500">{uno(p.sites)?.name} · {p.city} · {p.customer_phone}</p><p className="text-xs text-ink-500">{new Date(p.created_at).toLocaleString('es-CO')}</p></div><p className="font-medium">{formatMoney(p.total_amount, p.currency as Currency)}</p></div>
        <form action={guardarEstado} className="mt-3 flex gap-2"><input type="hidden" name="pedido_id" value={p.id} /><select name="estado" defaultValue={p.status} className="campo">{ORDER_STATUSES.map(e => <option key={e}>{e}</option>)}</select><button className="boton-secundario">Guardar</button></form>
      </div>)}{(pedidos ?? []).length === 0 && <p className="tarjeta p-5 text-sm text-ink-500">Sin pedidos.</p>}</div></section>
      <section><form action={agregarNota} className="tarjeta p-5"><h2 className="font-medium">Nota interna</h2><textarea name="body" required maxLength={5000} rows={4} className="campo mt-3" /><button className="boton-primario mt-3">Guardar nota</button></form>
        <div className="mt-4 space-y-3">{(notas ?? []).map(n => <div className="tarjeta p-4 text-sm" key={n.id}><p>{n.body}</p><p className="mt-2 text-xs text-ink-500">{new Date(n.created_at).toLocaleString('es-CO')}</p></div>)}</div>
      </section>
    </div>
    <section className="mt-8"><h2 className="mb-3 font-medium">Auditoría</h2><div className="tarjeta overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-ink-50 text-xs text-ink-500"><tr><th className="p-3">Fecha</th><th className="p-3">Acción</th><th className="p-3">Entidad</th><th className="p-3">Motivo</th></tr></thead><tbody>{(auditoria ?? []).map(a => <tr className="border-b last:border-0" key={a.id}><td className="p-3 whitespace-nowrap">{new Date(a.created_at).toLocaleString('es-CO')}</td><td className="p-3">{a.action}</td><td className="p-3">{a.entity_type ?? '—'}</td><td className="p-3">{a.support_reason ?? '—'}</td></tr>)}</tbody></table></div></section>
  </Shell>;
}

function Metrica({ titulo, valor }: { titulo: string; valor: string }) {
  return <div className="tarjeta p-4"><p className="text-xs text-ink-500">{titulo}</p><p className="mt-1 text-xl font-semibold">{valor}</p></div>;
}
function uno<T>(valor: T | T[] | null | undefined): T | undefined { return Array.isArray(valor) ? valor[0] : valor ?? undefined; }
