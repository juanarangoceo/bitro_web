-- =============================================================================
-- 0001_core.sql — Fundamentos: schema de utilidades, tipos y helpers de RLS
--
-- Esta migración no crea ninguna tabla de negocio. Establece las piezas de las
-- que dependen todas las demás: los tipos enumerados del dominio y las dos
-- funciones sobre las que se apoya cada política de RLS.
--
-- Ver docs/adr/0002-aislamiento-multi-tenant-por-rls.md
-- =============================================================================

-- `gen_random_uuid()` y funciones criptográficas.
create extension if not exists pgcrypto;

-- Schema propio para helpers. Mantenerlos fuera de `public` evita exponerlos
-- por PostgREST y deja claro que son infraestructura, no API.
create schema if not exists app;

revoke all on schema app from public;
grant usage on schema app to authenticated, anon, service_role;


-- -----------------------------------------------------------------------------
-- Tipos enumerados
--
-- Existen también como constantes en packages/shared/src/enums.ts. Los dos lados
-- deben mantenerse sincronizados; agregar valores SIEMPRE al final para no
-- reordenar los existentes.
-- -----------------------------------------------------------------------------

-- Rol dentro de un tenant (§3.2). El piloto usa owner y editor; viewer queda
-- declarado para no migrar la tabla cuando se habilite.
create type app.tenant_role as enum ('owner', 'editor', 'viewer');

-- Estado comercial del tenant (§16.4). Existe desde el día uno aunque el cobro
-- del piloto sea manual: retrofitearlo obligaría a migrar cuentas vivas.
create type app.billing_status as enum ('trial', 'active', 'past_due', 'suspended');

-- Estado operativo del tenant.
create type app.tenant_status as enum ('active', 'suspended', 'archived');

-- Estado de un sitio (§4.5). `changes_pending` NO se almacena: se deriva
-- comparando el timestamp del borrador con el de la publicación vigente.
create type app.site_status as enum ('draft', 'published', 'paused', 'archived');

-- Ciclo de vida de una versión de plantilla (§5.4).
create type app.template_status as enum (
  'development', 'preview', 'approved', 'published', 'hidden', 'deprecated'
);

-- Visibilidad de una plantilla (§7.6). `private` solo aparece para su
-- owner_tenant_id.
create type app.template_visibility as enum ('public', 'private', 'hidden');

-- Origen de la plantilla: catálogo propio o desarrollo a medida.
create type app.template_origin as enum ('catalog', 'custom');

-- Estado de un dominio durante la verificación DNS (§12.2).
create type app.domain_status as enum ('pending', 'verifying', 'active', 'failed', 'removed');

-- Ciclo de vida de un pedido (§10.1).
create type app.order_status as enum (
  'new', 'pending_confirmation', 'confirmed', 'preparing',
  'shipped', 'delivered', 'cancelled', 'returned'
);

-- Forma de pago (§10.2). El piloto no procesa pagos del comprador: `online`
-- queda declarado sin pasarela.
create type app.payment_method as enum ('cod', 'transfer', 'online');

-- Estado de un contacto o suscriptor (§10.4).
create type app.contact_status as enum (
  'new', 'contacted', 'converted', 'discarded', 'unsubscribed'
);


-- Los helpers de autorización (`app.current_tenant_ids`, `app.has_tenant_role`)
-- viven en 0002_tenants.sql, no aquí: Postgres valida el cuerpo de una función
-- SQL al crearla, y esos cuerpos consultan `tenant_members`, que todavía no
-- existe en esta migración.


-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------

-- Mantiene `updated_at` sin depender de que la aplicación se acuerde de hacerlo.
-- `site_content_drafts.updated_at` alimenta la derivación de `changes_pending`,
-- así que un timestamp desactualizado tendría consecuencias visibles.
create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
