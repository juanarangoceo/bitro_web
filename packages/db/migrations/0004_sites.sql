-- =============================================================================
-- 0004_sites.sql — Sitios, contenido, publicaciones, dominios, assets y ofertas
--
-- Modelo de publicación (§4.5, ADR 0004):
--   site_content_drafts  → mutable, es lo que edita el cliente
--   site_publications    → append-only, snapshots inmutables
--   sites.published_publication_id → apunta a la publicación vigente
--
-- El renderer lee SOLO site_publications. Nunca el borrador.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- sites — la landing del cliente
-- -----------------------------------------------------------------------------
create table public.sites (
  id                  uuid            primary key default gen_random_uuid(),
  tenant_id           uuid            not null references public.tenants(id) on delete cascade,
  -- Un sitio queda FIJADO a esta versión (§7.3). Publicar una versión nueva de
  -- la plantilla no lo migra. `on delete restrict`: borrar una versión con
  -- sitios vivos dejaría landings sin código que las renderice.
  template_version_id uuid            not null references public.template_versions(id)
                                      on delete restrict,
  name                text            not null check (length(trim(name)) > 0),
  status              app.site_status not null default 'draft',
  -- Publicación vigente. NULL = nunca se ha publicado. La FK se agrega abajo,
  -- una vez existe site_publications (dependencia circular).
  published_publication_id uuid,
  -- Token para la URL de preview privada (§4.5). Se rota al regenerarlo.
  preview_token       uuid            not null default gen_random_uuid(),
  -- Revisión humana obligatoria de la primera publicación de una cuenta nueva
  -- (§12.4): la reputación del dominio raíz es compartida entre tenants.
  first_publish_reviewed_at timestamptz,
  archived_at         timestamptz,
  created_at          timestamptz     not null default now(),
  updated_at          timestamptz     not null default now()
);

create index sites_tenant_idx on public.sites (tenant_id, created_at desc);
create index sites_template_version_idx on public.sites (template_version_id);
create index sites_preview_token_idx on public.sites (preview_token);

create trigger sites_touch_updated_at
  before update on public.sites
  for each row execute function app.touch_updated_at();

alter table public.sites enable row level security;

create policy sites_select_member on public.sites
  for select to authenticated
  using (tenant_id in (select app.current_tenant_ids()));

-- Owner y editor crean y modifican sitios; viewer solo lee (§3.2).
create policy sites_write_editor on public.sites
  for all to authenticated
  using (app.has_tenant_role(tenant_id, array['owner', 'editor']::app.tenant_role[]))
  with check (app.has_tenant_role(tenant_id, array['owner', 'editor']::app.tenant_role[]));


-- -----------------------------------------------------------------------------
-- site_content_drafts — contenido editable actual
--
-- Una fila por sitio. `revision` se incrementa en cada guardado para detectar
-- ediciones concurrentes de dos usuarios del mismo tenant.
-- -----------------------------------------------------------------------------
create table public.site_content_drafts (
  site_id      uuid        primary key references public.sites(id) on delete cascade,
  tenant_id    uuid        not null references public.tenants(id) on delete cascade,
  revision     integer     not null default 1 check (revision > 0),
  -- Validado contra template_versions.content_schema al guardar Y al publicar.
  content_json jsonb       not null default '{}'::jsonb,
  updated_by   uuid        references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger site_content_drafts_touch_updated_at
  before update on public.site_content_drafts
  for each row execute function app.touch_updated_at();

alter table public.site_content_drafts enable row level security;

create policy site_content_drafts_select_member on public.site_content_drafts
  for select to authenticated
  using (tenant_id in (select app.current_tenant_ids()));

create policy site_content_drafts_write_editor on public.site_content_drafts
  for all to authenticated
  using (app.has_tenant_role(tenant_id, array['owner', 'editor']::app.tenant_role[]))
  with check (app.has_tenant_role(tenant_id, array['owner', 'editor']::app.tenant_role[]));


-- -----------------------------------------------------------------------------
-- site_publications — snapshots publicados (append-only)
-- -----------------------------------------------------------------------------
create table public.site_publications (
  id                  uuid        primary key default gen_random_uuid(),
  site_id             uuid        not null references public.sites(id) on delete cascade,
  tenant_id           uuid        not null references public.tenants(id) on delete cascade,
  -- Número consecutivo por sitio. Legible para el usuario ("publicación #7").
  publication_number  integer     not null check (publication_number > 0),
  -- La versión de plantilla con la que se publicó. Se copia aquí para que el
  -- renderer resuelva el componente sin hacer join contra `sites`, y para que
  -- un rollback no dependa del estado actual del sitio.
  template_version_id uuid        not null references public.template_versions(id)
                                  on delete restrict,
  content_json        jsonb       not null,
  -- Snapshot de la oferta al publicar: precio y moneda vigentes en ese momento.
  offer_snapshot      jsonb       not null default '{}'::jsonb,
  published_by        uuid        references auth.users(id) on delete set null,
  published_at        timestamptz not null default now(),

  unique (site_id, publication_number)
);

create index site_publications_site_idx
  on public.site_publications (site_id, published_at desc);

alter table public.site_publications enable row level security;

create policy site_publications_select_member on public.site_publications
  for select to authenticated
  using (tenant_id in (select app.current_tenant_ids()));

create policy site_publications_insert_editor on public.site_publications
  for insert to authenticated
  with check (app.has_tenant_role(tenant_id, array['owner', 'editor']::app.tenant_role[]));

-- Append-only: sin políticas de UPDATE ni DELETE. Un snapshot publicado es
-- historial, y el rollback consiste en apuntar a otra fila, no en editar esta.

-- Ahora sí, la FK circular.
alter table public.sites
  add constraint sites_published_publication_fk
  foreign key (published_publication_id)
  references public.site_publications(id)
  on delete set null;


-- -----------------------------------------------------------------------------
-- domains — hostname → site_id (§12.3)
-- -----------------------------------------------------------------------------
create table public.domains (
  id            uuid              primary key default gen_random_uuid(),
  tenant_id     uuid              not null references public.tenants(id) on delete cascade,
  site_id       uuid              not null references public.sites(id) on delete cascade,
  -- SIEMPRE normalizado con normalizeHostname() de @nitro-web/shared antes de
  -- insertar. Dos normalizaciones distintas producen lookups que fallan de
  -- forma intermitente (ADR 0005).
  hostname      text              not null check (hostname = lower(hostname)),
  status        app.domain_status not null default 'pending',
  -- El canónico recibe el tráfico; los alternos redirigen a él (§12.3).
  is_canonical  boolean           not null default false,
  -- true = subdominio del dominio operativo; false = dominio propio del cliente.
  is_subdomain  boolean           not null default false,
  -- Registros DNS que debe configurar el cliente y estado devuelto por Vercel.
  verification_json jsonb         not null default '{}'::jsonb,
  last_checked_at timestamptz,
  verified_at   timestamptz,
  created_at    timestamptz       not null default now(),
  updated_at    timestamptz       not null default now()
);

-- Un hostname ACTIVO pertenece a un solo site (§12.3). El índice es parcial:
-- una fila `removed` conserva el historial sin bloquear que ese hostname se
-- reasigne a otro sitio más adelante.
create unique index domains_hostname_active_uniq
  on public.domains (hostname)
  where status <> 'removed';

-- Un sitio tiene exactamente un canónico entre sus dominios activos.
create unique index domains_one_canonical_per_site
  on public.domains (site_id)
  where is_canonical and status <> 'removed';

create index domains_site_idx on public.domains (site_id);
create index domains_tenant_idx on public.domains (tenant_id);

create trigger domains_touch_updated_at
  before update on public.domains
  for each row execute function app.touch_updated_at();

alter table public.domains enable row level security;

create policy domains_select_member on public.domains
  for select to authenticated
  using (tenant_id in (select app.current_tenant_ids()));

-- Conectar un dominio propio es decisión del propietario: implica costos y
-- afecta la marca del cliente.
create policy domains_write_owner on public.domains
  for all to authenticated
  using (app.has_tenant_role(tenant_id, array['owner']::app.tenant_role[]))
  with check (app.has_tenant_role(tenant_id, array['owner']::app.tenant_role[]));


-- -----------------------------------------------------------------------------
-- offers — precio, inventario y estado de la oferta
--
-- Vive en columnas relacionales, NO en el JSON de contenido (ADR 0003): el
-- precio es el dato del que depende el total que cobra el servidor.
-- -----------------------------------------------------------------------------
create table public.offers (
  id             uuid        primary key default gen_random_uuid(),
  site_id        uuid        not null unique references public.sites(id) on delete cascade,
  tenant_id      uuid        not null references public.tenants(id) on delete cascade,
  title          text        not null,
  -- Montos en la unidad mínima de la moneda. Enteros: el dinero nunca es float.
  price_amount   integer     not null check (price_amount >= 0),
  compare_at_amount integer  check (compare_at_amount is null or compare_at_amount >= 0),
  shipping_amount integer    not null default 0 check (shipping_amount >= 0),
  currency       text        not null default 'COP',
  -- NULL = inventario no gestionado (no bloquea pedidos).
  inventory      integer     check (inventory is null or inventory >= 0),
  is_active      boolean     not null default true,
  payment_methods app.payment_method[] not null default array['cod']::app.payment_method[],
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Un "precio anterior" menor o igual al actual no es un ahorro: es publicidad
  -- engañosa y la interfaz mostraría un descuento negativo.
  constraint offers_compare_at_must_be_higher
    check (compare_at_amount is null or compare_at_amount > price_amount)
);

create index offers_tenant_idx on public.offers (tenant_id);

create trigger offers_touch_updated_at
  before update on public.offers
  for each row execute function app.touch_updated_at();

alter table public.offers enable row level security;

create policy offers_select_member on public.offers
  for select to authenticated
  using (tenant_id in (select app.current_tenant_ids()));

create policy offers_write_editor on public.offers
  for all to authenticated
  using (app.has_tenant_role(tenant_id, array['owner', 'editor']::app.tenant_role[]))
  with check (app.has_tenant_role(tenant_id, array['owner', 'editor']::app.tenant_role[]));


-- -----------------------------------------------------------------------------
-- assets — imágenes y archivos (§9)
-- -----------------------------------------------------------------------------
create table public.assets (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null references public.tenants(id) on delete cascade,
  site_id       uuid        references public.sites(id) on delete cascade,
  -- Ruta en Storage con la forma `tenant_id/site_id/...` (§9).
  storage_path  text        not null unique,
  -- MIME real detectado en servidor, no el declarado por el navegador.
  mime_type     text        not null,
  byte_size     integer     not null check (byte_size > 0),
  width         integer,
  height        integer,
  -- Editable por el cliente; necesario para accesibilidad (§18).
  alt_text      text,
  -- Slot del manifest al que corresponde, p. ej. 'hero' o 'gallery'.
  asset_slot    text,
  created_by    uuid        references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index assets_tenant_site_idx on public.assets (tenant_id, site_id);

create trigger assets_touch_updated_at
  before update on public.assets
  for each row execute function app.touch_updated_at();

alter table public.assets enable row level security;

create policy assets_select_member on public.assets
  for select to authenticated
  using (tenant_id in (select app.current_tenant_ids()));

create policy assets_write_editor on public.assets
  for all to authenticated
  using (app.has_tenant_role(tenant_id, array['owner', 'editor']::app.tenant_role[]))
  with check (app.has_tenant_role(tenant_id, array['owner', 'editor']::app.tenant_role[]));

-- Un asset referenciado por una publicación activa NO puede borrarse
-- físicamente (§9): el rollback dejaría imágenes rotas. La aplicación marca el
-- asset como no usado y la limpieza real la hace un proceso posterior que
-- verifica que ninguna publicación lo referencia.
