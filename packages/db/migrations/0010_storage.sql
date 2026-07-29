-- =============================================================================
-- 0010_storage.sql — Bucket de imágenes y sus políticas (§9)
--
-- Convención de rutas, la misma que documenta `assets.storage_path`:
--
--     <tenant_id>/<site_id>/<archivo>
--
-- La primera carpeta ES la frontera de seguridad. Toda política de escritura se
-- resuelve leyendo ese primer segmento y comprobándolo contra las membresías
-- del usuario, con los mismos helpers que el resto del esquema (ADR 0002).
--
-- El bucket es PÚBLICO en lectura. No es un descuido: una imagen de una landing
-- publicada se le sirve a visitantes anónimos, así que es pública por
-- definición. Servirla con URL firmada obligaría a firmar en cada render,
-- rompería el caché del CDN y el optimizador de imágenes de Next, y no
-- escondería nada — la landing que la muestra es pública.
--
-- Lo que sí se controla es **quién escribe**: subir, reemplazar y borrar quedan
-- restringidos al tenant dueño de la carpeta.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Bucket
-- -----------------------------------------------------------------------------
-- `file_size_limit` y `allowed_mime_types` son la primera línea de defensa, y
-- actúan en el servidor de Storage: una validación en el navegador se salta con
-- una petición directa.
--
-- 5 MB por archivo. El peso de las imágenes es parte del modelo financiero, no
-- solo del rendimiento (§9): una landing de 10 MB consume cinco veces más
-- transferencia que una de 2 MB, y esa transferencia se paga.
--
-- SVG queda FUERA deliberadamente. Un SVG puede contener `<script>`, y aquí se
-- serviría desde el mismo origen que las landings de los clientes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-assets',
  'site-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- -----------------------------------------------------------------------------
-- Tenant dueño de una ruta
-- -----------------------------------------------------------------------------
-- Extrae el primer segmento de la ruta y lo interpreta como `tenant_id`.
--
-- Devuelve NULL ante cualquier ruta que no empiece por un UUID —incluida una
-- construida a propósito para confundir al parser— y `app.has_tenant_role(null,
-- ...)` es false, así que una ruta con forma inesperada se rechaza en lugar de
-- caer en un error de casteo con el objeto ya a medio escribir.
create or replace function app.tenant_from_storage_path(object_name text)
returns uuid
language plpgsql
immutable
set search_path = storage, pg_catalog
as $$
begin
  return nullif((storage.foldername(object_name))[1], '')::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

comment on function app.tenant_from_storage_path(text) is
  'tenant_id a partir del primer segmento de una ruta de Storage. NULL si la ruta no empieza por UUID.';

revoke all on function app.tenant_from_storage_path(text) from public, anon;
grant execute on function app.tenant_from_storage_path(text) to authenticated;


-- -----------------------------------------------------------------------------
-- Políticas sobre storage.objects
-- -----------------------------------------------------------------------------
-- Se recrean para que la migración pueda reaplicarse sin chocar con una
-- política previa del mismo nombre.
drop policy if exists site_assets_read_public   on storage.objects;
drop policy if exists site_assets_insert_editor on storage.objects;
drop policy if exists site_assets_update_editor on storage.objects;
drop policy if exists site_assets_delete_editor on storage.objects;

-- Lectura abierta, acotada a este bucket. Los demás buckets del proyecto no
-- quedan expuestos por esta política.
create policy site_assets_read_public on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'site-assets');

-- Subir: solo dentro de la carpeta del propio tenant, y solo owner/editor.
-- `viewer` pertenece al tenant pero no modifica nada (§3.2).
create policy site_assets_insert_editor on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'site-assets'
    and app.has_tenant_role(
      app.tenant_from_storage_path(name),
      array['owner', 'editor']::app.tenant_role[]
    )
  );

-- Reemplazar. El `with check` es tan necesario como el `using`: sin él, un
-- UPDATE podría mover un objeto propio a la carpeta de otro tenant.
create policy site_assets_update_editor on storage.objects
  for update to authenticated
  using (
    bucket_id = 'site-assets'
    and app.has_tenant_role(
      app.tenant_from_storage_path(name),
      array['owner', 'editor']::app.tenant_role[]
    )
  )
  with check (
    bucket_id = 'site-assets'
    and app.has_tenant_role(
      app.tenant_from_storage_path(name),
      array['owner', 'editor']::app.tenant_role[]
    )
  );

-- Borrar.
--
-- Un asset referenciado por una publicación activa NO debe borrarse: el
-- rollback dejaría imágenes rotas (§9). Esa comprobación no vive aquí sino en
-- la aplicación, porque exige recorrer el JSON de cada publicación y una
-- política de RLS no es el lugar para eso. Esta política solo garantiza que
-- nadie borre archivos de otro tenant.
create policy site_assets_delete_editor on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'site-assets'
    and app.has_tenant_role(
      app.tenant_from_storage_path(name),
      array['owner', 'editor']::app.tenant_role[]
    )
  );
