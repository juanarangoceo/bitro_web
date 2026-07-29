-- =============================================================================
-- 0005_metrics.sql — Agregados diarios
--
-- El piloto NO tiene pipeline de eventos (§11.2). La analítica comercial se
-- resuelve con una fila por sitio y día, actualizada de forma incremental al
-- registrar una vista o crear un pedido.
--
-- El motivo es de rendimiento y costo: el dashboard consolida todas las
-- landings del cliente (§4.1), y recalcular eso recorriendo eventos crudos en
-- cada carga es exactamente el "dashboard lento por eventos" que la
-- especificación marca como riesgo (§23).
--
-- Debe crearse ANTES que 0006_commerce.sql: create_public_order() escribe aquí.
-- =============================================================================

create table public.site_metrics_daily (
  tenant_id   uuid    not null references public.tenants(id) on delete cascade,
  site_id     uuid    not null references public.sites(id) on delete cascade,
  metric_date date    not null,

  -- Denominador de la conversión y unidad de consumo del plan.
  page_views  integer not null default 0 check (page_views >= 0),
  orders      integer not null default 0 check (orders >= 0),
  -- Suma de totales en unidad mínima de la moneda. Incluye pedidos que después
  -- pueden cancelarse: el ajuste lo hace `revenue_cancelled`, para no reescribir
  -- historial ya reportado.
  revenue     bigint  not null default 0 check (revenue >= 0),
  revenue_cancelled bigint not null default 0 check (revenue_cancelled >= 0),
  subscribers integer not null default 0 check (subscribers >= 0),

  updated_at  timestamptz not null default now(),

  primary key (site_id, metric_date)
);

-- El dashboard consolidado consulta por tenant y rango de fechas, no por sitio.
create index site_metrics_daily_tenant_date_idx
  on public.site_metrics_daily (tenant_id, metric_date desc);

alter table public.site_metrics_daily enable row level security;

create policy site_metrics_daily_select_member on public.site_metrics_daily
  for select to authenticated
  using (tenant_id in (select app.current_tenant_ids()));

-- Sin políticas de escritura: los agregados los actualizan funciones
-- SECURITY DEFINER. Un usuario no puede inflar sus propias métricas.


-- -----------------------------------------------------------------------------
-- record_page_view — registro de vista desde el renderer
--
-- El renderer la llama sin bloquear el render (§6.1, §17). Si esta llamada
-- falla, la landing igual se sirve: perder una vista es aceptable, perder una
-- venta no.
-- -----------------------------------------------------------------------------
create or replace function public.record_page_view(p_site_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.sites where id = p_site_id;
  if not found then
    -- Un site_id inexistente no es un error del visitante: se ignora en
    -- silencio para no dar señal sobre qué IDs existen.
    return;
  end if;

  insert into public.site_metrics_daily (tenant_id, site_id, metric_date, page_views)
  values (v_tenant_id, p_site_id, current_date, 1)
  on conflict (site_id, metric_date) do update
    set page_views = public.site_metrics_daily.page_views + 1,
        updated_at = now();
end;
$$;

grant execute on function public.record_page_view(uuid) to anon, authenticated;


-- -----------------------------------------------------------------------------
-- Ajuste de ingresos al cancelar un pedido
--
-- `revenue` acumula lo vendido; `revenue_cancelled` lo revertido. El ingreso
-- neto es la resta. Se hace así, y no restando de `revenue`, para que la
-- metodología sea visible en el dashboard (§11.4, §11.5): el cliente puede ver
-- cuánto se canceló en lugar de que las cifras cambien sin explicación.
-- -----------------------------------------------------------------------------
create or replace function app.adjust_metrics_on_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- Solo nos interesan las transiciones hacia/desde estados que anulan la venta.
  if (old.status in ('cancelled', 'returned')) = (new.status in ('cancelled', 'returned')) then
    return new;
  end if;

  if new.status in ('cancelled', 'returned') then
    update public.site_metrics_daily
      set revenue_cancelled = revenue_cancelled + new.total_amount,
          updated_at = now()
      where site_id = new.site_id
        and metric_date = (new.created_at at time zone 'UTC')::date;
  else
    -- Reactivación de un pedido antes cancelado.
    update public.site_metrics_daily
      set revenue_cancelled = greatest(revenue_cancelled - new.total_amount, 0),
          updated_at = now()
      where site_id = new.site_id
        and metric_date = (new.created_at at time zone 'UTC')::date;
  end if;

  return new;
end;
$$;

-- El trigger se crea en 0006, junto con la tabla `orders`.
