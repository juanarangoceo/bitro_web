-- =============================================================================
-- 0005_commerce.sql — Pedidos, ítems y contactos
--
-- Regla central (§14.2): el total de un pedido se calcula EN EL SERVIDOR desde
-- la oferta publicada. El navegador nunca envía un precio.
--
-- Esa regla se implementa aquí abajo, en `public.create_public_order()`: es una
-- función SECURITY DEFINER que lee el precio de `offers` y lo escribe ella
-- misma. El formulario público no tiene permiso de INSERT sobre `orders`, así
-- que no existe una ruta por la que un precio del cliente llegue a la base.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- contacts — suscriptores y compradores (§10.4)
-- -----------------------------------------------------------------------------
create table public.contacts (
  id               uuid                primary key default gen_random_uuid(),
  tenant_id        uuid                not null references public.tenants(id) on delete cascade,
  -- Sitio donde se capturó. Se conserva aunque el contacto sea del tenant.
  site_id          uuid                references public.sites(id) on delete set null,
  full_name        text,
  -- Normalizados con normalizeEmail/normalizePhone de @nitro-web/shared. Son la
  -- clave de deduplicación: cambiar la normalización invalida el histórico.
  normalized_email text,
  normalized_phone text,
  status           app.contact_status  not null default 'new',
  -- Prueba de consentimiento (§14.4): sin propósito, versión y fecha no se puede
  -- demostrar que el tratamiento fue autorizado.
  consent_purpose  text,
  consent_text_version text,
  consent_at       timestamptz,
  source           text,
  attribution_json jsonb               not null default '{}'::jsonb,
  created_at       timestamptz         not null default now(),
  updated_at       timestamptz         not null default now(),

  -- Un contacto sin ningún identificador no es deduplicable ni contactable.
  constraint contacts_requires_identifier
    check (normalized_email is not null or normalized_phone is not null)
);

-- Deduplicación POR TENANT (§10.4): el mismo comprador en dos clientes distintos
-- son dos contactos distintos. Nunca se mezclan contactos entre clientes.
create unique index contacts_tenant_email_uniq
  on public.contacts (tenant_id, normalized_email)
  where normalized_email is not null;

create unique index contacts_tenant_phone_uniq
  on public.contacts (tenant_id, normalized_phone)
  where normalized_phone is not null;

create index contacts_tenant_created_idx on public.contacts (tenant_id, created_at desc);

create trigger contacts_touch_updated_at
  before update on public.contacts
  for each row execute function app.touch_updated_at();

alter table public.contacts enable row level security;

create policy contacts_select_member on public.contacts
  for select to authenticated
  using (tenant_id in (select app.current_tenant_ids()));

create policy contacts_write_editor on public.contacts
  for all to authenticated
  using (app.has_tenant_role(tenant_id, array['owner', 'editor']::app.tenant_role[]))
  with check (app.has_tenant_role(tenant_id, array['owner', 'editor']::app.tenant_role[]));


-- -----------------------------------------------------------------------------
-- orders — encabezado del pedido (§10.2)
-- -----------------------------------------------------------------------------
create table public.orders (
  id                uuid                primary key default gen_random_uuid(),
  tenant_id         uuid                not null references public.tenants(id) on delete cascade,
  site_id           uuid                not null references public.sites(id) on delete cascade,
  contact_id        uuid                references public.contacts(id) on delete set null,
  -- Consecutivo legible por tenant, p. ej. 'NW-000042'.
  order_number      text                not null,
  status            app.order_status    not null default 'new',

  customer_name     text                not null,
  customer_phone    text                not null,
  customer_email    text,
  city              text                not null,
  address           text                not null,
  delivery_notes    text,

  -- Totales en unidad mínima de la moneda, calculados por el servidor.
  subtotal_amount   integer             not null check (subtotal_amount >= 0),
  discount_amount   integer             not null default 0 check (discount_amount >= 0),
  shipping_amount   integer             not null default 0 check (shipping_amount >= 0),
  total_amount      integer             not null check (total_amount >= 0),
  currency          text                not null default 'COP',
  payment_method    app.payment_method  not null default 'cod',

  -- Atribución capturada al crear el pedido (§11.1). En el piloto esta es la
  -- única fuente de atribución: no hay pipeline de eventos.
  attribution_json  jsonb               not null default '{}'::jsonb,
  -- Snapshot de la oferta al momento de comprar (§10.2). Preserva el precio
  -- histórico aunque la oferta cambie después.
  offer_snapshot    jsonb               not null default '{}'::jsonb,

  -- Evita pedidos duplicados por doble clic o reintento de red (§14.2).
  idempotency_key   text,
  notes             text,
  created_at        timestamptz         not null default now(),
  updated_at        timestamptz         not null default now(),

  unique (tenant_id, order_number)
);

-- La idempotencia se acota al sitio: dos landings distintas pueden generar la
-- misma clave sin colisionar.
create unique index orders_idempotency_uniq
  on public.orders (site_id, idempotency_key)
  where idempotency_key is not null;

create index orders_tenant_created_idx on public.orders (tenant_id, created_at desc);
create index orders_site_created_idx on public.orders (site_id, created_at desc);
create index orders_tenant_status_idx on public.orders (tenant_id, status);

create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function app.touch_updated_at();

alter table public.orders enable row level security;

create policy orders_select_member on public.orders
  for select to authenticated
  using (tenant_id in (select app.current_tenant_ids()));

-- El equipo del cliente actualiza estado y notas. NO hay política de INSERT:
-- los pedidos entran únicamente por create_public_order(), que es la que
-- garantiza que el total lo calculó el servidor.
create policy orders_update_editor on public.orders
  for update to authenticated
  using (app.has_tenant_role(tenant_id, array['owner', 'editor']::app.tenant_role[]))
  with check (app.has_tenant_role(tenant_id, array['owner', 'editor']::app.tenant_role[]));


-- -----------------------------------------------------------------------------
-- order_items — snapshot de los ítems
-- -----------------------------------------------------------------------------
create table public.order_items (
  id          uuid        primary key default gen_random_uuid(),
  order_id    uuid        not null references public.orders(id) on delete cascade,
  tenant_id   uuid        not null references public.tenants(id) on delete cascade,
  -- Título copiado, no referenciado: si la oferta se renombra, el pedido
  -- histórico debe seguir diciendo qué se vendió realmente.
  title       text        not null,
  unit_amount integer     not null check (unit_amount >= 0),
  quantity    integer     not null check (quantity > 0),
  created_at  timestamptz not null default now()
);

create index order_items_order_idx on public.order_items (order_id);

alter table public.order_items enable row level security;

create policy order_items_select_member on public.order_items
  for select to authenticated
  using (tenant_id in (select app.current_tenant_ids()));


-- -----------------------------------------------------------------------------
-- order_counters — consecutivo de pedidos por tenant
--
-- Tabla propia en vez de una secuencia de Postgres: una secuencia por tenant
-- exigiría DDL dinámico al crear cada cliente, y una secuencia global filtraría
-- el volumen de pedidos de otros clientes en el número.
-- -----------------------------------------------------------------------------
create table public.order_counters (
  tenant_id  uuid    primary key references public.tenants(id) on delete cascade,
  next_value integer not null default 1 check (next_value > 0)
);

alter table public.order_counters enable row level security;
-- Sin políticas: solo la accede create_public_order() como SECURITY DEFINER.


-- -----------------------------------------------------------------------------
-- create_public_order — única vía de entrada de pedidos
--
-- SECURITY DEFINER porque el visitante de una landing es `anon` y no tiene (ni
-- debe tener) permiso de escritura sobre `orders`.
--
-- Lo que esta función garantiza:
--   1. El precio sale de `offers`, nunca de los argumentos.
--   2. El sitio debe estar publicado y la oferta activa.
--   3. Reintentar con la misma idempotency_key devuelve el pedido original en
--      lugar de crear un duplicado.
--   4. El consecutivo se serializa por tenant sin condiciones de carrera.
-- -----------------------------------------------------------------------------
create or replace function public.create_public_order(
  p_site_id         uuid,
  p_customer_name   text,
  p_customer_phone  text,
  p_city            text,
  p_address         text,
  p_quantity        integer default 1,
  p_customer_email  text default null,
  p_delivery_notes  text default null,
  p_payment_method  app.payment_method default 'cod',
  p_attribution     jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns table (order_id uuid, order_number text, total_amount integer, currency text)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_site         public.sites%rowtype;
  v_offer        public.offers%rowtype;
  v_existing     public.orders%rowtype;
  v_tenant_id    uuid;
  v_seq          integer;
  v_order_number text;
  v_subtotal     integer;
  v_total        integer;
  v_order_id     uuid;
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > 100 then
    raise exception 'Cantidad inválida' using errcode = 'check_violation';
  end if;

  -- Reintento idempotente: devolver el pedido original sin crear otro.
  if p_idempotency_key is not null then
    select * into v_existing
    from public.orders o
    where o.site_id = p_site_id and o.idempotency_key = p_idempotency_key;

    if found then
      return query select v_existing.id, v_existing.order_number,
                          v_existing.total_amount, v_existing.currency;
      return;
    end if;
  end if;

  select * into v_site from public.sites s where s.id = p_site_id;
  if not found then
    raise exception 'Sitio no encontrado' using errcode = 'no_data_found';
  end if;

  -- Una landing en borrador, pausada o archivada no recibe pedidos. Sin esta
  -- guarda, un formulario cacheado seguiría vendiendo una oferta retirada.
  if v_site.status <> 'published' or v_site.published_publication_id is null then
    raise exception 'El sitio no está publicado' using errcode = 'check_violation';
  end if;

  v_tenant_id := v_site.tenant_id;

  select * into v_offer from public.offers o where o.site_id = p_site_id;
  if not found or not v_offer.is_active then
    raise exception 'La oferta no está disponible' using errcode = 'check_violation';
  end if;

  if v_offer.inventory is not null and v_offer.inventory < p_quantity then
    raise exception 'Inventario insuficiente' using errcode = 'check_violation';
  end if;

  -- EL CÁLCULO. Los montos vienen de `offers`, no de los argumentos.
  v_subtotal := v_offer.price_amount * p_quantity;
  v_total    := v_subtotal + v_offer.shipping_amount;

  -- Consecutivo por tenant. El UPDATE toma un lock de fila, así que dos pedidos
  -- simultáneos del mismo tenant se serializan en lugar de repetir número.
  --
  -- RETURNING ve el valor YA incrementado, así que el número de este pedido es
  -- `next_value - 1`, tanto en el INSERT inicial (2 - 1 = 1) como en el UPDATE.
  insert into public.order_counters (tenant_id, next_value)
  values (v_tenant_id, 2)
  on conflict (tenant_id) do update
    set next_value = public.order_counters.next_value + 1
  returning next_value - 1 into v_seq;

  v_order_number := 'NW-' || lpad(v_seq::text, 6, '0');

  insert into public.orders (
    tenant_id, site_id, order_number, status,
    customer_name, customer_phone, customer_email, city, address, delivery_notes,
    subtotal_amount, discount_amount, shipping_amount, total_amount, currency,
    payment_method, attribution_json, offer_snapshot, idempotency_key
  ) values (
    v_tenant_id, p_site_id, v_order_number, 'new',
    p_customer_name, p_customer_phone, p_customer_email, p_city, p_address, p_delivery_notes,
    v_subtotal, 0, v_offer.shipping_amount, v_total, v_offer.currency,
    p_payment_method, coalesce(p_attribution, '{}'::jsonb),
    jsonb_build_object(
      'offer_id', v_offer.id,
      'title', v_offer.title,
      'price_amount', v_offer.price_amount,
      'compare_at_amount', v_offer.compare_at_amount,
      'shipping_amount', v_offer.shipping_amount,
      'currency', v_offer.currency,
      'captured_at', now()
    ),
    p_idempotency_key
  )
  returning id into v_order_id;

  insert into public.order_items (order_id, tenant_id, title, unit_amount, quantity)
  values (v_order_id, v_tenant_id, v_offer.title, v_offer.price_amount, p_quantity);

  -- Descontar inventario solo si el tenant lo gestiona.
  if v_offer.inventory is not null then
    update public.offers set inventory = inventory - p_quantity where id = v_offer.id;
  end if;

  -- Agregado diario del día (§11.1). Se actualiza aquí para que el dashboard no
  -- tenga que recorrer pedidos en cada carga.
  insert into public.site_metrics_daily (tenant_id, site_id, metric_date, orders, revenue)
  values (v_tenant_id, p_site_id, current_date, 1, v_total)
  on conflict (site_id, metric_date) do update
    set orders  = public.site_metrics_daily.orders + 1,
        revenue = public.site_metrics_daily.revenue + excluded.revenue;

  return query select v_order_id, v_order_number, v_total, v_offer.currency;
end;
$$;

comment on function public.create_public_order is
  'Única vía de creación de pedidos. Calcula el total desde offers; el cliente nunca envía precio (§14.2).';

-- El visitante anónimo de una landing solo puede llamar a esta función.
grant execute on function public.create_public_order(
  uuid, text, text, text, text, integer, text, text, app.payment_method, jsonb, text
) to anon, authenticated;


-- Ajuste de ingresos cuando un pedido se cancela o se devuelve. La función vive
-- en 0005_metrics.sql; el trigger se cuelga aquí porque `orders` nace en esta
-- migración.
create trigger orders_adjust_metrics_on_status_change
  after update of status on public.orders
  for each row execute function app.adjust_metrics_on_order_status_change();
