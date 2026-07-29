-- =============================================================================
-- 0007_ops.sql — IA, consumo, auditoría, banderas, onboarding y notas internas
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ai_generations — uso, costo e historial de IA (§8.3)
--
-- Cada generación queda registrada con su modelo y prompt_version. Sin esto no
-- se puede calcular el costo por generación (§16.5) ni reproducir por qué el
-- modelo devolvió un texto concreto cuando un cliente reclama.
-- -----------------------------------------------------------------------------
create table public.ai_generations (
  id             uuid        primary key default gen_random_uuid(),
  tenant_id      uuid        not null references public.tenants(id) on delete cascade,
  site_id        uuid        references public.sites(id) on delete set null,
  user_id        uuid        references auth.users(id) on delete set null,
  -- 'full' | 'section' | 'field' (§8.2).
  mode           text        not null check (mode in ('full', 'section', 'field')),
  -- Sección o campo afectado. NULL en generación completa.
  target_key     text,
  model          text        not null,
  prompt_version text        not null,
  input_tokens   integer     check (input_tokens is null or input_tokens >= 0),
  output_tokens  integer     check (output_tokens is null or output_tokens >= 0),
  latency_ms     integer     check (latency_ms is null or latency_ms >= 0),
  -- Costo estimado en micro-unidades de USD, para no perder precisión con
  -- montos por debajo del centavo.
  cost_micros    bigint      check (cost_micros is null or cost_micros >= 0),
  status         text        not null default 'ok' check (status in ('ok', 'invalid_output', 'error')),
  error_message  text,
  -- Resultado guardado para poder restaurar contenido anterior (§8.3).
  result_json    jsonb,
  created_at     timestamptz not null default now()
);

create index ai_generations_tenant_created_idx
  on public.ai_generations (tenant_id, created_at desc);
create index ai_generations_site_idx on public.ai_generations (site_id, created_at desc);

alter table public.ai_generations enable row level security;

create policy ai_generations_select_member on public.ai_generations
  for select to authenticated
  using (tenant_id in (select app.current_tenant_ids()));

-- Sin política de INSERT: los registros los escribe el servicio de IA del
-- dashboard con la clave secreta. Un usuario no puede fabricar consumo ajeno
-- ni borrar el propio.


-- -----------------------------------------------------------------------------
-- usage_monthly — contadores por periodo (§16.3)
--
-- Alimenta las alertas al 70%, 85% y 100% del plan, y el bloqueo de IA al
-- agotar la cuota. `period` es el primer día del mes.
-- -----------------------------------------------------------------------------
create table public.usage_monthly (
  tenant_id uuid    not null references public.tenants(id) on delete cascade,
  period    date    not null,
  -- 'page_views' | 'ai_generations' | 'active_sites' | 'storage_bytes'
  metric    text    not null,
  value     bigint  not null default 0 check (value >= 0),
  updated_at timestamptz not null default now(),

  primary key (tenant_id, period, metric)
);

alter table public.usage_monthly enable row level security;

create policy usage_monthly_select_member on public.usage_monthly
  for select to authenticated
  using (tenant_id in (select app.current_tenant_ids()));


-- -----------------------------------------------------------------------------
-- audit_log — acciones sensibles (§5.3, §18)
--
-- Registra quién hizo qué y sobre qué. Es requisito de aceptación de la v1
-- (§22.2) y la única forma de sustentar un "modo soporte" en el que el equipo
-- de Nitro Web actúa en nombre del cliente.
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id            bigserial   primary key,
  -- NULL cuando la acción es de plataforma y no afecta a un tenant concreto.
  tenant_id     uuid        references public.tenants(id) on delete set null,
  actor_user_id uuid        references auth.users(id) on delete set null,
  -- true cuando el actor es el equipo de Nitro Web operando en nombre del
  -- cliente. Sin este campo, un cambio hecho en modo soporte parecería hecho
  -- por el propio cliente.
  is_support_mode boolean   not null default false,
  support_reason text,
  action        text        not null,
  entity_type   text,
  entity_id     uuid,
  payload_json  jsonb       not null default '{}'::jsonb,
  ip_address    inet,
  created_at    timestamptz not null default now()
);

create index audit_log_tenant_created_idx on public.audit_log (tenant_id, created_at desc);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);

alter table public.audit_log enable row level security;

-- El propietario puede revisar la actividad de su cuenta, incluida la del
-- equipo de soporte actuando sobre ella: es justo lo que hace verificable el
-- modo soporte.
create policy audit_log_select_owner on public.audit_log
  for select to authenticated
  using (
    tenant_id is not null
    and app.has_tenant_role(tenant_id, array['owner']::app.tenant_role[])
  );

-- Sin INSERT/UPDATE/DELETE para usuarios: un registro de auditoría que el
-- auditado puede escribir o borrar no sirve como evidencia.


-- -----------------------------------------------------------------------------
-- feature_flags — activaciones futuras (§15)
-- -----------------------------------------------------------------------------
create table public.feature_flags (
  id         uuid        primary key default gen_random_uuid(),
  -- Ambas NULL = bandera global de plataforma.
  tenant_id  uuid        references public.tenants(id) on delete cascade,
  site_id    uuid        references public.sites(id) on delete cascade,
  key        text        not null,
  enabled    boolean     not null default false,
  config_json jsonb      not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- `coalesce` para que el índice trate NULL como un valor: sin esto, dos filas
-- con el mismo key y tenant_id NULL no colisionarían.
create unique index feature_flags_scope_key_uniq
  on public.feature_flags (
    coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid),
    key
  );

create trigger feature_flags_touch_updated_at
  before update on public.feature_flags
  for each row execute function app.touch_updated_at();

alter table public.feature_flags enable row level security;

create policy feature_flags_select_member on public.feature_flags
  for select to authenticated
  using (tenant_id is null or tenant_id in (select app.current_tenant_ids()));


-- -----------------------------------------------------------------------------
-- onboarding_progress — pasos y bloqueos de adopción (§9.1)
--
-- Persistir el progreso hace visible dónde se detiene cada cuenta, que es una
-- de las métricas del piloto: minutos de soporte por cliente.
-- -----------------------------------------------------------------------------
create table public.onboarding_progress (
  id         uuid        primary key default gen_random_uuid(),
  tenant_id  uuid        not null references public.tenants(id) on delete cascade,
  site_id    uuid        references public.sites(id) on delete cascade,
  flow_key   text        not null,
  step_key   text        not null,
  status     text        not null default 'pending'
                         check (status in ('pending', 'done', 'skipped', 'blocked')),
  blocked_reason text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index onboarding_progress_scope_uniq
  on public.onboarding_progress (
    tenant_id,
    coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid),
    flow_key,
    step_key
  );

create trigger onboarding_progress_touch_updated_at
  before update on public.onboarding_progress
  for each row execute function app.touch_updated_at();

alter table public.onboarding_progress enable row level security;

create policy onboarding_progress_select_member on public.onboarding_progress
  for select to authenticated
  using (tenant_id in (select app.current_tenant_ids()));

create policy onboarding_progress_write_editor on public.onboarding_progress
  for all to authenticated
  using (app.has_tenant_role(tenant_id, array['owner', 'editor']::app.tenant_role[]))
  with check (app.has_tenant_role(tenant_id, array['owner', 'editor']::app.tenant_role[]));


-- -----------------------------------------------------------------------------
-- admin_notes — notas internas del equipo Nitro Web
--
-- Tabla aparte a propósito. Las notas internas sobre un cliente ("no paga",
-- "pidió descuento") no pueden vivir en `tenants` ni en `template_requests`,
-- porque el propietario del tenant puede leer sus propias filas y las vería.
-- -----------------------------------------------------------------------------
create table public.admin_notes (
  id            uuid        primary key default gen_random_uuid(),
  entity_type   text        not null,
  entity_id     uuid        not null,
  body          text        not null,
  author_user_id uuid       references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index admin_notes_entity_idx on public.admin_notes (entity_type, entity_id, created_at desc);

alter table public.admin_notes enable row level security;

-- Cero políticas, deliberadamente: con RLS activo y sin políticas, ningún
-- usuario (ni `authenticated` ni `anon`) puede leer nada. Solo `service_role`,
-- que omite RLS, tiene acceso.
