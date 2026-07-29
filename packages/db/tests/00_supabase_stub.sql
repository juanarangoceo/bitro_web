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


-- -----------------------------------------------------------------------------
-- Schema `storage`
--
-- Subconjunto mínimo de lo que usa 0010_storage.sql. Sin esto, esa migración
-- fallaría en la validación local por una razón que no es un error nuestro, y
-- las políticas del bucket quedarían sin cobertura de pruebas — justo las que
-- deciden quién puede escribir imágenes en la carpeta de quién.
-- -----------------------------------------------------------------------------
create schema if not exists storage;

create table storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets(id),
  name       text not null,
  owner      uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

-- Devuelve los segmentos de carpeta de una ruta, excluyendo el nombre del
-- archivo: 'tenant/site/foto.png' → {tenant, site}. Réplica del comportamiento
-- de la función homónima de Supabase, que es de lo que dependen las políticas.
create or replace function storage.foldername(name text)
returns text[]
language plpgsql
immutable
as $$
declare
  partes text[];
begin
  partes := string_to_array(name, '/');
  return partes[1:array_length(partes, 1) - 1];
end;
$$;

grant usage on schema storage to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated, service_role;
grant select on storage.objects to anon;
