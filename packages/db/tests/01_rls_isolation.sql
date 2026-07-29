-- =============================================================================
-- 01_rls_isolation.sql — Pruebas NEGATIVAS de aislamiento multi-tenant
--
-- Criterio de aceptación §22.1.9: "Dos tenants de prueba no pueden consultar
-- datos cruzados."
--
-- Este archivo es la evidencia de ese criterio. Falla ruidosamente (raise
-- exception) ante cualquier fuga, de modo que la validación completa se detiene.
--
-- Las pruebas se ejecutan con `set local role authenticated`, porque el rol
-- `postgres` es superusuario y OMITE RLS: correrlas como postgres daría verde
-- siempre y no probaría nada.
-- =============================================================================

begin;

-- --- Datos de prueba -------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@ejemplo.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@ejemplo.com');

insert into public.tenants (id, name, slug, plan_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tenant A', 'tenant-a', 'piloto'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Tenant B', 'tenant-b', 'piloto');

insert into public.tenant_members (tenant_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner');

insert into public.templates (id, template_key, display_name, visibility)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'plantilla-prueba', 'Plantilla de prueba', 'public');

insert into public.template_versions
  (id, template_id, version, status, component_key, manifest_json, content_schema, default_content)
values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
   '1.0.0', 'published', 'pruebaV1', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb);

insert into public.sites (id, tenant_id, template_version_id, name) values
  ('e1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Landing A'),
  ('e2222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Landing B');

insert into public.offers (site_id, tenant_id, title, price_amount, currency) values
  ('e1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Oferta A', 490000, 'COP'),
  ('e2222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'Oferta B', 300000, 'COP');

insert into public.contacts (tenant_id, site_id, full_name, normalized_email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'e1111111-1111-1111-1111-111111111111',
   'Comprador A', 'compradora@ejemplo.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'e2222222-2222-2222-2222-222222222222',
   'Comprador B', 'compradorb@ejemplo.com');


-- --- Helper de aserción ----------------------------------------------------
create or replace function pg_temp.assert_eq(actual bigint, expected bigint, etiqueta text)
returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FALLA [%]: se esperaba %, se obtuvo %', etiqueta, expected, actual;
  end if;
  raise notice '  ok  %', etiqueta;
end $$;


-- ===========================================================================
-- Usuario A (tenant A)
-- ===========================================================================
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
begin
  raise notice 'Usuario A — lectura';
end $$;

select pg_temp.assert_eq((select count(*) from public.tenants), 1,
  'A ve exactamente 1 tenant (el suyo)');

select pg_temp.assert_eq((select count(*) from public.sites), 1,
  'A ve exactamente 1 sitio (el suyo)');

select pg_temp.assert_eq(
  (select count(*) from public.sites where id = 'e2222222-2222-2222-2222-222222222222'), 0,
  'A NO ve el sitio del tenant B');

select pg_temp.assert_eq(
  (select count(*) from public.offers where tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0,
  'A NO ve las ofertas del tenant B');

select pg_temp.assert_eq(
  (select count(*) from public.contacts where tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0,
  'A NO ve los contactos del tenant B');

select pg_temp.assert_eq(
  (select count(*) from public.tenant_members
   where tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0,
  'A NO ve las membresías del tenant B');

-- Notas internas del equipo Nitro Web. La defensa aquí es doble: RLS sin
-- políticas (0 filas) y además GRANT revocado (0008_grants.sql). El GRANT actúa
-- primero, así que el resultado esperado es "permission denied", no una lista
-- vacía — una barrera más fuerte que el filtrado por filas.
do $$
declare
  ok boolean := false;
  n  bigint;
begin
  begin
    select count(*) into n from public.admin_notes;
  exception when insufficient_privilege then
    ok := true;
  end;
  if not ok then
    raise exception 'FALLA: A pudo consultar admin_notes (devolvió % filas)', n;
  end if;
  raise notice '  ok  A NO puede leer admin_notes (permiso denegado)';
end $$;


-- --- Escrituras cruzadas: todas deben fallar -------------------------------
do $$
declare
  ok boolean;
begin
  raise notice 'Usuario A — escritura cruzada';

  -- UPDATE sobre un sitio ajeno: RLS lo convierte en "0 filas afectadas", que
  -- es tan seguro como un error pero silencioso. Se verifica contando.
  update public.sites set name = 'SECUESTRADO'
  where id = 'e2222222-2222-2222-2222-222222222222';
  if found then
    raise exception 'FALLA: A modificó el sitio del tenant B';
  end if;
  raise notice '  ok  A NO puede modificar el sitio del tenant B';

  update public.offers set price_amount = 1
  where tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  if found then
    raise exception 'FALLA: A modificó el precio de la oferta del tenant B';
  end if;
  raise notice '  ok  A NO puede modificar el precio del tenant B';

  -- INSERT en el tenant ajeno: aquí RLS sí levanta excepción, porque el
  -- WITH CHECK de la política rechaza la fila.
  ok := false;
  begin
    insert into public.sites (tenant_id, template_version_id, name)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Intruso');
  exception when insufficient_privilege or check_violation then
    ok := true;
  end;
  if not ok then
    raise exception 'FALLA: A creó un sitio dentro del tenant B';
  end if;
  raise notice '  ok  A NO puede crear un sitio en el tenant B';

  -- DELETE cruzado.
  delete from public.sites where id = 'e2222222-2222-2222-2222-222222222222';
  if found then
    raise exception 'FALLA: A borró el sitio del tenant B';
  end if;
  raise notice '  ok  A NO puede borrar el sitio del tenant B';

  -- Los pedidos no se insertan a mano: solo por create_public_order().
  ok := false;
  begin
    insert into public.orders (
      tenant_id, site_id, order_number, customer_name, customer_phone,
      city, address, subtotal_amount, total_amount
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'e1111111-1111-1111-1111-111111111111',
      'FALSO-1', 'Tramposo', '3000000000', 'Pereira', 'Calle 1', 1, 1
    );
  exception when insufficient_privilege then
    ok := true;
  end;
  if not ok then
    raise exception 'FALLA: se insertó un pedido saltándose create_public_order()';
  end if;
  raise notice '  ok  Nadie inserta pedidos directamente (el total lo calcula el servidor)';
end $$;


-- ===========================================================================
-- Usuario B — simétrico: confirma que el aislamiento no depende del orden
-- ===========================================================================
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

do $$ begin raise notice 'Usuario B — lectura'; end $$;

select pg_temp.assert_eq((select count(*) from public.sites), 1,
  'B ve exactamente 1 sitio (el suyo)');

select pg_temp.assert_eq(
  (select count(*) from public.sites where id = 'e1111111-1111-1111-1111-111111111111'), 0,
  'B NO ve el sitio del tenant A');


-- ===========================================================================
-- Usuario sin sesión
-- ===========================================================================
set local request.jwt.claim.sub = '';

do $$ begin raise notice 'Usuario sin sesión'; end $$;

select pg_temp.assert_eq((select count(*) from public.sites), 0,
  'Un usuario sin sesión no ve ningún sitio');

select pg_temp.assert_eq((select count(*) from public.orders), 0,
  'Un usuario sin sesión no ve ningún pedido');

reset role;

do $$ begin raise notice 'AISLAMIENTO MULTI-TENANT: OK'; end $$;

rollback;
