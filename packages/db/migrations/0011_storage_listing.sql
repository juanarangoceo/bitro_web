-- =============================================================================
-- 0011_storage_listing.sql — Quita el listado abierto del bucket
--
-- 0010 creó una política SELECT abierta sobre `storage.objects` para el bucket
-- `site-assets`. Era innecesaria y filtraba información entre tenants.
--
-- Innecesaria: en un bucket público, la URL de objeto
-- (`/storage/v1/object/public/site-assets/...`) se sirve sin pasar por RLS. La
-- política SELECT no habilita ver una imagen; habilita **listar** el bucket.
--
-- Filtraba: las rutas son `<tenant_id>/<site_id>/<archivo>`, así que poder
-- listarlas le dice a cualquiera cuántos clientes hay, cuántos sitios tiene
-- cada uno y cómo se llaman sus archivos. Ninguna imagen concreta se protegía
-- con esto, pero el inventario completo sí quedaba expuesto.
--
-- Lo detectó el advisor `public_bucket_allows_listing`.
-- =============================================================================

drop policy if exists site_assets_read_public on storage.objects;

-- Listar sigue siendo necesario para el dashboard: el editor tiene que mostrar
-- los assets ya subidos de un sitio. Se acota a los tenants del usuario, igual
-- que toda política de lectura del esquema.
--
-- `anon` queda fuera a propósito: el visitante de una landing consume las
-- imágenes por su URL pública y nunca necesita enumerar nada.
drop policy if exists site_assets_list_member on storage.objects;

create policy site_assets_list_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'site-assets'
    and app.tenant_from_storage_path(name) in (select app.current_tenant_ids())
  );
