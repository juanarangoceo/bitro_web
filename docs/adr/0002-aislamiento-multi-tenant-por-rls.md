# ADR 0002 — Aislamiento multi-tenant por RLS con función `SECURITY DEFINER`

- **Fecha:** 2026-07-28
- **Estado:** Aceptada

## Contexto

Toda fila de negocio lleva `tenant_id` y debe estar protegida por RLS (§14.1). La
especificación es explícita en que `TO authenticated` no constituye autorización: eso
solo prueba que alguien inició sesión, no que pertenezca al tenant dueño de la fila.

La pertenencia vive en `tenant_members(tenant_id, user_id, role)`. Escribir la política
como un `EXISTS (SELECT 1 FROM tenant_members ...)` dentro de cada tabla tiene dos
problemas: se evalúa por fila (costoso en listados) y, si `tenant_members` también
tiene RLS, produce recursión infinita al consultarse a sí misma.

## Decisión

Una función `app.current_tenant_ids()` marcada `SECURITY DEFINER` y `STABLE` que
devuelve el conjunto de `tenant_id` a los que pertenece `auth.uid()`. Las políticas de
cada tabla se reducen a `tenant_id IN (SELECT app.current_tenant_ids())`.

- `SECURITY DEFINER` evita la recursión al consultar `tenant_members`.
- `STABLE` permite a Postgres evaluar la función una vez por consulta en lugar de una
  vez por fila.
- `search_path` fijado explícitamente en la función, para que no pueda secuestrarse
  con un schema del usuario.

Los roles (`owner`, `editor`, `viewer`) se resuelven con una segunda función
`app.has_tenant_role(tenant_id, roles[])` usada en las políticas de escritura.

## Consecuencias

- Las políticas quedan cortas, uniformes y auditables: una plantilla por tabla.
- El costo de la verificación no crece con el tamaño del listado.
- La función es un punto único de fallo de seguridad: cualquier cambio en ella exige
  volver a correr la suite de tests negativos (`packages/db/tests`).
- El rol `service_role` omite RLS por diseño. Solo se usa desde el servidor, en
  operaciones explícitamente auditadas, y nunca llega al navegador.

## Verificación

`packages/db/tests/rls.test.ts` incluye pruebas **negativas**: un usuario del tenant A
que intenta leer, insertar y actualizar filas del tenant B debe fallar en todos los
casos. Es el criterio de aceptación §22.1.9 y no puede marcarse como cumplido sin
esas pruebas en verde contra una base real.
