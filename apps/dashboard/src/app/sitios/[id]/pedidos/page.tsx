import { notFound, redirect } from 'next/navigation';
import { ORDER_STATUSES } from '@nitro-web/shared';
import { buildWhatsAppUrl, formatMoney, type Currency } from '@nitro-web/shared';
import { Shell } from '@/components/Shell';
import { puedeEditar, requerirSesion } from '@/lib/session';
import { supabaseServidor } from '@/lib/supabase';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ estado?: string; ok?: string; error?: string }>;
};

const ETIQUETAS: Record<string, string> = {
  new: 'Nuevo',
  pending_confirmation: 'Por confirmar',
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  returned: 'Devuelto',
};

/**
 * Bandeja de pedidos y métricas del sitio.
 *
 * Las métricas salen de `site_metrics_daily`, que se actualiza de forma
 * incremental al registrar una vista o crear un pedido. No hay pipeline de
 * eventos en el piloto (§11.2): recalcular esto recorriendo eventos crudos en
 * cada carga es exactamente el "dashboard lento" que la especificación marca
 * como riesgo.
 */
export default async function PedidosPage({ params, searchParams }: Props) {
  const { id } = await params;
  const filtros = await searchParams;

  const sesion = await requerirSesion();
  const supabase = await supabaseServidor();

  const { data: sitio } = await supabase
    .from('sites')
    .select('id, name')
    .eq('id', id)
    .maybeSingle();

  if (!sitio) notFound();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('whatsapp_template')
    .eq('id', sesion.tenantId)
    .maybeSingle();

  let consulta = supabase
    .from('orders')
    .select(
      'id, order_number, status, customer_name, customer_phone, customer_email, city, address, total_amount, currency, payment_method, created_at, notes',
    )
    .eq('site_id', id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (filtros.estado && filtros.estado !== 'todos') {
    consulta = consulta.eq('status', filtros.estado as (typeof ORDER_STATUSES)[number]);
  }

  const { data: pedidos } = await consulta;

  // Últimos 30 días: el rango que responde "¿cómo va la campaña?".
  const desde = new Date();
  desde.setDate(desde.getDate() - 30);

  const { data: metricas } = await supabase
    .from('site_metrics_daily')
    .select('page_views, orders, revenue, revenue_cancelled')
    .eq('site_id', id)
    .gte('metric_date', desde.toISOString().slice(0, 10));

  const totales = (metricas ?? []).reduce(
    (acc, m) => ({
      vistas: acc.vistas + m.page_views,
      pedidos: acc.pedidos + m.orders,
      ingresos: acc.ingresos + Number(m.revenue),
      cancelado: acc.cancelado + Number(m.revenue_cancelled),
    }),
    { vistas: 0, pedidos: 0, ingresos: 0, cancelado: 0 },
  );

  const conversion = totales.vistas > 0 ? (totales.pedidos / totales.vistas) * 100 : null;
  const editable = puedeEditar(sesion);

  async function cambiarEstado(formData: FormData) {
    'use server';

    const s = await requerirSesion();
    if (!puedeEditar(s)) redirect(`/sitios/${id}/pedidos?error=permiso`);

    const pedidoId = String(formData.get('pedido_id') ?? '');
    const estado = String(formData.get('estado') ?? '');

    if (!ORDER_STATUSES.includes(estado as (typeof ORDER_STATUSES)[number])) {
      redirect(`/sitios/${id}/pedidos?error=estado`);
    }

    const db = await supabaseServidor();
    const { error } = await db
      .from('orders')
      .update({ status: estado as (typeof ORDER_STATUSES)[number] })
      .eq('id', pedidoId);

    if (error) redirect(`/sitios/${id}/pedidos?error=guardar`);
    redirect(`/sitios/${id}/pedidos?ok=estado`);
  }

  return (
    <Shell
      sesion={sesion}
      titulo={`Pedidos · ${sitio.name}`}
      volverA={{ href: `/sitios/${id}`, texto: 'Volver a la landing' }}
      acciones={
        <a href={`/sitios/${id}/pedidos/csv`} className="boton-secundario">
          Exportar CSV
        </a>
      }
    >
      <section className="mb-6 grid gap-3 sm:grid-cols-4">
        <Metrica titulo="Vistas (30 días)" valor={totales.vistas.toLocaleString('es-CO')} />
        <Metrica titulo="Pedidos" valor={totales.pedidos.toLocaleString('es-CO')} />
        <Metrica
          titulo="Ingresos"
          valor={formatMoney(totales.ingresos - totales.cancelado, 'COP')}
          nota={totales.cancelado > 0 ? `${formatMoney(totales.cancelado, 'COP')} cancelado` : undefined}
        />
        <Metrica
          titulo="Conversión"
          valor={conversion === null ? '—' : `${conversion.toFixed(2)}%`}
          nota={conversion === null ? 'sin vistas todavía' : 'pedidos ÷ vistas'}
        />
      </section>

      <nav className="mb-4 flex flex-wrap gap-2 text-xs">
        <FiltroEstado id={id} valor="todos" activo={!filtros.estado || filtros.estado === 'todos'} />
        {ORDER_STATUSES.map((e) => (
          <FiltroEstado key={e} id={id} valor={e} activo={filtros.estado === e} />
        ))}
      </nav>

      {(pedidos ?? []).length === 0 ? (
        <p className="tarjeta p-6 text-sm text-ink-600">
          No hay pedidos{filtros.estado && filtros.estado !== 'todos' ? ' con ese estado' : ' todavía'}.
        </p>
      ) : (
        <ul className="space-y-3">
          {(pedidos ?? []).map((p) => {
            const wa = buildWhatsAppUrl({
              phone: p.customer_phone,
              template: tenant?.whatsapp_template ?? undefined,
              context: {
                customerName: p.customer_name,
                offerTitle: sitio.name,
                total: formatMoney(p.total_amount, p.currency as Currency),
                city: p.city,
                orderNumber: p.order_number,
              },
            });

            return (
              <li key={p.id} className="tarjeta p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-medium">
                      {p.order_number} · {p.customer_name}
                    </p>
                    <p className="text-ink-600">
                      {p.city} · {p.address}
                    </p>
                    <p className="text-ink-500">
                      {p.customer_phone}
                      {p.customer_email && ` · ${p.customer_email}`}
                    </p>
                    <p className="mt-1 text-ink-500">
                      {new Date(p.created_at).toLocaleString('es-CO')} · {p.payment_method}
                    </p>
                  </div>

                  <div className="text-right text-sm">
                    <p className="font-semibold">
                      {formatMoney(p.total_amount, p.currency as Currency)}
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      {wa && (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                        >
                          WhatsApp
                        </a>
                      )}

                      {editable ? (
                        <form action={cambiarEstado} className="flex items-center gap-1">
                          <input type="hidden" name="pedido_id" value={p.id} />
                          <select
                            name="estado"
                            defaultValue={p.status}
                            className="rounded border border-ink-200 px-2 py-1 text-xs"
                          >
                            {ORDER_STATUSES.map((e) => (
                              <option key={e} value={e}>
                                {ETIQUETAS[e] ?? e}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="text-xs text-brand-700 underline">
                            Guardar
                          </button>
                        </form>
                      ) : (
                        <span className="rounded bg-ink-100 px-2 py-1 text-xs">
                          {ETIQUETAS[p.status] ?? p.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Shell>
  );
}

function Metrica({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="tarjeta p-4">
      <p className="text-xs text-ink-500">{titulo}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{valor}</p>
      {nota && <p className="ayuda">{nota}</p>}
    </div>
  );
}

function FiltroEstado({ id, valor, activo }: { id: string; valor: string; activo: boolean }) {
  return (
    <a
      href={`/sitios/${id}/pedidos?estado=${valor}`}
      className={`rounded-full px-3 py-1 ${
        activo ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 hover:bg-ink-100'
      }`}
    >
      {valor === 'todos' ? 'Todos' : (ETIQUETAS[valor] ?? valor)}
    </a>
  );
}
