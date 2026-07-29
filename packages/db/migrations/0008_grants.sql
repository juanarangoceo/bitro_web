-- =============================================================================
-- 0008_grants.sql — Permisos por rol
--
-- RLS filtra filas, pero solo actúa sobre roles que YA tienen permiso sobre la
-- tabla. Los dos mecanismos son independientes y ambos son necesarios:
--   GRANT  → "puedes tocar esta tabla"
--   RLS    → "de esta tabla, solo estas filas"
--
-- Postura adoptada:
--   authenticated → CRUD sobre las tablas de negocio; RLS decide qué filas
--   anon          → NINGÚN acceso directo a tablas; solo dos funciones
--   service_role  → omite RLS por diseño; solo servidor
-- =============================================================================

-- El visitante de una landing es `anon`. No debe poder consultar ninguna tabla
-- directamente: si pudiera, un `select` sobre `orders` desde el navegador
-- expondría los pedidos de otros compradores en cuanto una política tuviera un
-- hueco. Su única superficie son las dos funciones SECURITY DEFINER.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

grant usage on schema public to anon, authenticated, service_role;

-- El usuario autenticado opera sobre las tablas de negocio. RLS restringe cada
-- consulta a las filas de sus propios tenants.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Tablas que ningún usuario final debe tocar, ni siquiera con RLS de por medio:
--   order_counters → lo maneja create_public_order()
--   admin_notes    → notas internas del equipo Nitro Web
--   audit_log      → evidencia; escribible solo por el servidor
revoke all on public.order_counters from authenticated;
revoke all on public.admin_notes from authenticated;
revoke insert, update, delete on public.audit_log from authenticated;

-- Los agregados los actualizan funciones SECURITY DEFINER; un usuario no puede
-- inflar sus propias métricas ni su consumo.
revoke insert, update, delete on public.site_metrics_daily from authenticated;
revoke insert, update, delete on public.usage_monthly from authenticated;
revoke insert, update, delete on public.ai_generations from authenticated;

-- El catálogo de plantillas y planes es de lectura para el cliente.
revoke insert, update, delete on public.plans from authenticated;
revoke insert, update, delete on public.templates from authenticated;
revoke insert, update, delete on public.template_versions from authenticated;

-- Las publicaciones son append-only: se crean, no se editan ni se borran.
revoke update, delete on public.site_publications from authenticated;

-- Los pedidos entran solo por create_public_order().
revoke insert, delete on public.orders from authenticated;
revoke insert, update, delete on public.order_items from authenticated;

-- Las banderas de funcionalidad las controla la plataforma.
revoke insert, update, delete on public.feature_flags from authenticated;

-- Lo mismo para futuras tablas creadas por migraciones posteriores.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
