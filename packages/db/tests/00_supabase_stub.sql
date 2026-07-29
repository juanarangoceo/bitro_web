-- =============================================================================
-- Stub de Supabase para validar las migraciones en un Postgres limpio.
--
-- Supabase provee el schema `auth`, la función `auth.uid()` y los roles
-- `anon` / `authenticated` / `service_role`. Un Postgres vacío no los tiene, así
-- que las migraciones fallarían por razones que no son errores nuestros.
--
-- Este archivo NO se aplica en Supabase. Es exclusivo del entorno de pruebas.
-- =============================================================================

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema if not exists auth;

-- Subconjunto mínimo de auth.users: solo lo que referencian nuestras FKs.
create table auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique
);

-- En Supabase, auth.uid() lee el claim `sub` del JWT. En pruebas lo emulamos con
-- una GUC de sesión, que los tests fijan con `set local`.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;
