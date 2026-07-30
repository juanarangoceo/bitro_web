-- =============================================================================
-- 0013_platform_admins.sql — operadores internos de Nitro Web
--
-- No es una membresía de tenant. Un operador puede administrar varios clientes,
-- así que su acceso transversal se verifica antes de usar la clave secreta.
-- =============================================================================

create table public.platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_active   boolean     not null default true,
  created_by  uuid        references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger platform_admins_touch_updated_at
  before update on public.platform_admins
  for each row execute function app.touch_updated_at();

alter table public.platform_admins enable row level security;

-- Cero políticas: ni `anon` ni `authenticated` pueden enumerar operadores.
-- El admin interno consulta esta tabla con la clave secreta después de validar
-- criptográficamente la sesión del usuario.
revoke all on table public.platform_admins from public, anon, authenticated;

