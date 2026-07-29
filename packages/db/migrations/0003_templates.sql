-- =============================================================================
-- 0003_templates.sql — Catálogo de plantillas y versiones inmutables
--
-- Regla central (§7.3): una versión publicada es INMUTABLE. Un sitio queda
-- fijado a una `template_version_id` y publicar una versión nueva no migra
-- sitios existentes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- templates — identidad y visibilidad
-- -----------------------------------------------------------------------------
create table public.templates (
  id              uuid                    primary key default gen_random_uuid(),
  -- Identificador estable, p. ej. 'coffee-maker'. Nunca cambia entre versiones.
  template_key    text                    not null unique
                                          check (template_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  display_name    text                    not null,
  category        text,
  description     text,
  visibility      app.template_visibility not null default 'hidden',
  origin          app.template_origin     not null default 'catalog',
  -- Solo para plantillas privadas: el tenant que las encargó (§7.6).
  owner_tenant_id uuid                    references public.tenants(id) on delete set null,
  is_featured     boolean                 not null default false,
  -- Planes que pueden instalarla. NULL = disponible para todos.
  allowed_plan_ids text[],
  thumbnail_url   text,
  demo_url        text,
  created_at      timestamptz             not null default now(),
  updated_at      timestamptz             not null default now(),

  -- Una plantilla privada sin dueño sería invisible para todos y editable por
  -- nadie: es un estado inconsistente, no un caso de uso.
  constraint templates_private_requires_owner
    check (visibility <> 'private' or owner_tenant_id is not null)
);

create index templates_visibility_idx on public.templates (visibility);
create index templates_owner_tenant_idx on public.templates (owner_tenant_id)
  where owner_tenant_id is not null;

create trigger templates_touch_updated_at
  before update on public.templates
  for each row execute function app.touch_updated_at();

alter table public.templates enable row level security;

-- El catálogo público lo ve cualquier usuario autenticado; una plantilla privada
-- solo la ve el tenant que la encargó. Las ocultas no aparecen para nadie salvo
-- el admin (service_role).
create policy templates_select_visible on public.templates
  for select to authenticated
  using (
    visibility = 'public'
    or (visibility = 'private' and owner_tenant_id in (select app.current_tenant_ids()))
  );


-- -----------------------------------------------------------------------------
-- template_versions — versión inmutable y su manifest
-- -----------------------------------------------------------------------------
create table public.template_versions (
  id              uuid                primary key default gen_random_uuid(),
  template_id     uuid                not null references public.templates(id) on delete cascade,
  -- Semver. Inmutable una vez publicada.
  version         text                not null check (version ~ '^\d+\.\d+\.\d+$'),
  status          app.template_status not null default 'development',
  -- Componente registrado en el renderer, p. ej. 'coffeeMakerV1'. El renderer
  -- resuelve este string contra su registro; un valor sin componente registrado
  -- produce un error de publicación, no una página en blanco.
  component_key   text                not null,
  -- Manifest completo (§7.1): asset_slots, ai_sections, compatibility.
  manifest_json   jsonb               not null,
  -- JSON Schema de los campos editables. El editor se construye a partir de él
  -- y la IA valida su salida contra él.
  content_schema  jsonb               not null,
  -- Contenido demostrativo con el que nace un sitio nuevo.
  default_content jsonb               not null,
  -- Versión mínima del renderer requerida (§7.1, compatibility).
  min_renderer_version text           not null default '1.0.0',
  changelog       text,
  published_at    timestamptz,
  created_at      timestamptz         not null default now(),
  updated_at      timestamptz         not null default now(),

  unique (template_id, version)
);

create index template_versions_template_status_idx
  on public.template_versions (template_id, status);

create trigger template_versions_touch_updated_at
  before update on public.template_versions
  for each row execute function app.touch_updated_at();

-- Inmutabilidad de versiones publicadas (§7.3).
--
-- Una vez publicada, el contenido de una versión no puede cambiar: hay sitios
-- vivos dependiendo de él. Una corrección urgente exige una versión nueva
-- (1.0.1), no una edición silenciosa. Solo se permite mover el estado a
-- `hidden` o `deprecated`, que frena nuevas instalaciones sin tocar las existentes.
create or replace function app.enforce_template_version_immutability()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'published' then
    if new.manifest_json is distinct from old.manifest_json
       or new.content_schema is distinct from old.content_schema
       or new.default_content is distinct from old.default_content
       or new.component_key is distinct from old.component_key
       or new.version is distinct from old.version
    then
      raise exception
        'La versión % de plantilla ya está publicada y es inmutable. Cree una versión nueva.',
        old.version
        using errcode = 'raise_exception';
    end if;

    if new.status not in ('published', 'hidden', 'deprecated') then
      raise exception
        'Una versión publicada solo puede pasar a hidden o deprecated, no a %.', new.status
        using errcode = 'raise_exception';
    end if;
  end if;

  return new;
end;
$$;

create trigger template_versions_immutability
  before update on public.template_versions
  for each row execute function app.enforce_template_version_immutability();

alter table public.template_versions enable row level security;

-- Un usuario ve las versiones publicadas de las plantillas que puede ver. Las
-- versiones en desarrollo son del admin.
create policy template_versions_select_published on public.template_versions
  for select to authenticated
  using (
    status = 'published'
    and template_id in (
      select t.id from public.templates t
      where t.visibility = 'public'
         or (t.visibility = 'private' and t.owner_tenant_id in (select app.current_tenant_ids()))
    )
  );


-- -----------------------------------------------------------------------------
-- template_requests — solicitudes de plantillas a medida (§7.6)
--
-- El piloto gestiona cotización y seguimiento manualmente; la tabla existe para
-- no perder las solicitudes que lleguen mientras tanto.
-- -----------------------------------------------------------------------------
create table public.template_requests (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null references public.tenants(id) on delete cascade,
  status        text        not null default 'submitted'
                            check (status in ('submitted', 'reviewing', 'quoted', 'approved',
                                              'in_development', 'delivered', 'rejected')),
  brief_json    jsonb       not null default '{}'::jsonb,
  quoted_amount integer     check (quoted_amount is null or quoted_amount >= 0),
  currency      text        not null default 'COP',
  -- Plantilla entregada, cuando la solicitud se completa.
  delivered_template_id uuid references public.templates(id) on delete set null,
  -- Sin notas internas aquí: el tenant lee esta fila. Ver `admin_notes`.
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index template_requests_tenant_idx on public.template_requests (tenant_id, created_at desc);

create trigger template_requests_touch_updated_at
  before update on public.template_requests
  for each row execute function app.touch_updated_at();

alter table public.template_requests enable row level security;

create policy template_requests_select_member on public.template_requests
  for select to authenticated
  using (tenant_id in (select app.current_tenant_ids()));

create policy template_requests_insert_owner on public.template_requests
  for insert to authenticated
  with check (app.has_tenant_role(tenant_id, array['owner']::app.tenant_role[]));
