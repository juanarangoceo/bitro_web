-- =============================================================================
-- 0002_tenants.sql — Planes, tenants, perfiles y membresías
--
-- `tenant_members` es la tabla sobre la que se apoya toda la autorización del
-- sistema. Sus políticas se escriben a mano (no con el helper) porque el helper
-- la consulta a ella.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- plans — límites y capacidades comerciales (§16.1)
-- -----------------------------------------------------------------------------
-- Tabla de plataforma, no de tenant: la leen todos, la escribe solo el admin.
create table public.plans (
  id            text primary key,
  display_name  text        not null,
  -- Precio en la unidad mínima de la moneda (COP se opera sin decimales).
  price_amount  integer     not null default 0 check (price_amount >= 0),
  currency      text        not null default 'COP',
  -- Límites como JSON: los del piloto son hipótesis y cambiarán tras medir
  -- costo real (§16.1). Una columna por límite obligaría a migrar en cada ajuste.
  -- Claves esperadas: max_active_sites, max_monthly_views, max_ai_generations.
  limits_json   jsonb       not null default '{}'::jsonb,
  is_active     boolean     not null default true,
  sort_order    integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger plans_touch_updated_at
  before update on public.plans
  for each row execute function app.touch_updated_at();

alter table public.plans enable row level security;

-- Cualquier usuario autenticado puede leer el catálogo de planes: lo necesita la
-- pantalla de "Uso y plan". La escritura pasa por service_role (admin).
create policy plans_select_authenticated on public.plans
  for select to authenticated
  using (is_active);


-- -----------------------------------------------------------------------------
-- tenants — clientes de Nitro Web
-- -----------------------------------------------------------------------------
create table public.tenants (
  id              uuid primary key default gen_random_uuid(),
  name            text                not null check (length(trim(name)) > 0),
  -- Slug interno para URLs del dashboard. No es el subdominio público.
  slug            text                not null unique,
  status          app.tenant_status   not null default 'active',
  plan_id         text                references public.plans(id) on delete restrict,
  billing_status  app.billing_status  not null default 'trial',
  -- Fin del periodo de gracia en morosidad. Las landings siguen activas hasta
  -- esta fecha: no se destruyen campañas automáticamente (§16.4).
  grace_until     timestamptz,
  country         text                not null default 'CO',
  currency        text                not null default 'COP',
  -- Plantilla de mensaje de WhatsApp propia del tenant (§10.3).
  whatsapp_template text,
  -- Capacidades reservadas para Nitro Bot (§15). Se declaran ahora para no
  -- rediseñar después; el piloto las deja en su valor inicial.
  nitro_bot_enabled boolean           not null default false,
  nitro_bot_tenant_id text,
  web_chat_enabled  boolean           not null default false,
  whatsapp_enabled  boolean           not null default false,
  whatsapp_number   text,
  commerce_source   text              not null default 'nitro_web',
  -- Las notas internas sobre el cliente NO van aquí: el propietario del tenant
  -- puede leer su propia fila. Viven en `admin_notes` (0006_ops.sql), sin
  -- políticas de lectura para usuarios finales.
  created_at      timestamptz         not null default now(),
  updated_at      timestamptz         not null default now()
);

create trigger tenants_touch_updated_at
  before update on public.tenants
  for each row execute function app.touch_updated_at();

alter table public.tenants enable row level security;
-- Sus políticas se declaran más abajo, después de crear los helpers de
-- autorización: una política se resuelve contra la función en el momento de
-- crearse, así que la función debe existir primero.


-- -----------------------------------------------------------------------------
-- profiles — perfil ligado a Supabase Auth
-- -----------------------------------------------------------------------------
create table public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function app.touch_updated_at();

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (user_id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (user_id = auth.uid());


-- -----------------------------------------------------------------------------
-- tenant_members — membresía y rol
-- -----------------------------------------------------------------------------
create table public.tenant_members (
  tenant_id  uuid              not null references public.tenants(id) on delete cascade,
  user_id    uuid              not null references auth.users(id) on delete cascade,
  role       app.tenant_role   not null default 'editor',
  invited_by uuid              references auth.users(id) on delete set null,
  created_at timestamptz       not null default now(),
  updated_at timestamptz       not null default now(),
  primary key (tenant_id, user_id)
);

-- Índice para el sentido de consulta que usa `app.current_tenant_ids()`:
-- "dado un usuario, sus tenants". La PK cubre el sentido contrario.
create index tenant_members_user_id_idx on public.tenant_members (user_id);

create trigger tenant_members_touch_updated_at
  before update on public.tenant_members
  for each row execute function app.touch_updated_at();


-- -----------------------------------------------------------------------------
-- Helpers de autorización
--
-- Toda política de RLS del sistema se apoya en estas dos funciones. Son el punto
-- único de fallo de seguridad: cualquier cambio exige volver a correr la suite
-- de tests negativos.
--
-- Se definen aquí y no en 0001 porque Postgres valida el cuerpo de una función
-- SQL al crearla, y ambas consultan `tenant_members`.
-- -----------------------------------------------------------------------------

-- Tenants a los que pertenece el usuario autenticado.
--
-- SECURITY DEFINER es obligatorio: sin él, consultar `tenant_members` desde una
-- política sobre `tenant_members` produce recursión infinita.
--
-- STABLE permite a Postgres evaluar la función una vez por consulta en lugar de
-- una vez por fila: la diferencia entre un listado usable y uno que se arrastra.
--
-- `search_path` fijado: sin esto, un usuario podría crear un schema propio con
-- una tabla `tenant_members` falsa y secuestrar la autorización.
create or replace function app.current_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select tm.tenant_id
  from public.tenant_members tm
  where tm.user_id = auth.uid()
$$;

comment on function app.current_tenant_ids() is
  'Tenants del usuario autenticado. Base de toda política de RLS. SECURITY DEFINER evita recursión sobre tenant_members.';


-- ¿El usuario tiene alguno de estos roles en el tenant indicado?
--
-- Se usa en políticas de escritura, donde no basta pertenecer al tenant: un
-- `viewer` pertenece pero no puede modificar nada.
create or replace function app.has_tenant_role(
  target_tenant_id uuid,
  allowed_roles app.tenant_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.tenant_members tm
    where tm.user_id = auth.uid()
      and tm.tenant_id = target_tenant_id
      and tm.role = any(allowed_roles)
  )
$$;

comment on function app.has_tenant_role(uuid, app.tenant_role[]) is
  'Verifica rol dentro de un tenant. Usada en políticas de escritura (INSERT/UPDATE/DELETE).';


-- Estas funciones no deben ser invocables por tráfico anónimo: `anon` es el rol
-- del visitante de una landing, que nunca tiene tenants.
revoke all on function app.current_tenant_ids() from public, anon;
revoke all on function app.has_tenant_role(uuid, app.tenant_role[]) from public, anon;
grant execute on function app.current_tenant_ids() to authenticated;
grant execute on function app.has_tenant_role(uuid, app.tenant_role[]) to authenticated;


-- -----------------------------------------------------------------------------
-- Políticas de `tenants` (ya existen los helpers)
-- -----------------------------------------------------------------------------
create policy tenants_select_member on public.tenants
  for select to authenticated
  using (id in (select app.current_tenant_ids()));

-- Solo el propietario edita los datos de su empresa. Crear y suspender tenants
-- es operación de plataforma: pasa por service_role con auditoría (§5.3).
create policy tenants_update_owner on public.tenants
  for update to authenticated
  using (app.has_tenant_role(id, array['owner']::app.tenant_role[]))
  with check (app.has_tenant_role(id, array['owner']::app.tenant_role[]));


alter table public.tenant_members enable row level security;

-- ATENCIÓN: las políticas de esta tabla NO pueden usar app.current_tenant_ids(),
-- porque esa función lee esta misma tabla. Se escriben en términos de auth.uid()
-- directamente para evitar la recursión.

-- Un usuario ve su propia membresía...
create policy tenant_members_select_own on public.tenant_members
  for select to authenticated
  using (user_id = auth.uid());

-- ...y el propietario ve la de todo su equipo. `has_tenant_role` es
-- SECURITY DEFINER, así que no reentra en RLS y la recursión no ocurre.
create policy tenant_members_select_as_owner on public.tenant_members
  for select to authenticated
  using (app.has_tenant_role(tenant_id, array['owner']::app.tenant_role[]));

-- Invitar y cambiar roles es potestad del propietario.
create policy tenant_members_write_as_owner on public.tenant_members
  for all to authenticated
  using (app.has_tenant_role(tenant_id, array['owner']::app.tenant_role[]))
  with check (app.has_tenant_role(tenant_id, array['owner']::app.tenant_role[]));


-- -----------------------------------------------------------------------------
-- Planes iniciales (§16.1)
--
-- Los precios y límites son HIPÓTESIS a validar durante el piloto. No prometer
-- estas cifras a un cliente sin haber medido costo real y margen.
-- -----------------------------------------------------------------------------
insert into public.plans (id, display_name, price_amount, currency, limits_json, sort_order) values
  ('piloto', 'Piloto', 0, 'COP',
   '{"max_active_sites": 3, "max_monthly_views": 20000, "max_ai_generations": 200}'::jsonb, 0),
  ('fundador', 'Fundador', 99000, 'COP',
   '{"max_active_sites": 3, "max_monthly_views": 30000, "max_ai_generations": 300}'::jsonb, 1),
  ('crecimiento', 'Crecimiento', 189000, 'COP',
   '{"max_active_sites": 10, "max_monthly_views": 100000, "max_ai_generations": 1000}'::jsonb, 2),
  ('escala', 'Escala', 349000, 'COP',
   '{"max_active_sites": 30, "max_monthly_views": 300000, "max_ai_generations": 3000}'::jsonb, 3);
