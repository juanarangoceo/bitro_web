-- =============================================================================
-- 0009_search_path.sql — Fija el search_path de las funciones de trigger
--
-- Los advisors de Supabase marcaron `app.touch_updated_at` y
-- `app.enforce_template_version_immutability` como `function_search_path_mutable`.
-- Ambas son funciones de trigger `SECURITY INVOKER`, así que el riesgo es menor
-- que en los helpers de RLS, pero el argumento es el mismo que en ADR 0002: sin
-- `search_path` fijado, la función resuelve sus referencias contra el del rol
-- que la invoca, y un schema colocado antes en esa ruta puede sustituir lo que
-- la función creía estar llamando.
--
-- `app.touch_updated_at` escribe el timestamp del que depende la derivación de
-- `changes_pending`, y `app.enforce_template_version_immutability` es la guarda
-- que impide editar una versión publicada. Ninguna de las dos debe resolverse
-- contra un search_path que no controlamos.
--
-- Se hace en una migración nueva y no editando 0001/0003: esas ya están
-- aplicadas en Supabase.
-- =============================================================================

alter function app.touch_updated_at()
  set search_path = public, pg_catalog;

alter function app.enforce_template_version_immutability()
  set search_path = public, pg_catalog;
