# ADR 0005 — Resolución de dominios en el renderer

- **Fecha:** 2026-07-28
- **Estado:** Aceptada

## Contexto

Todos los dominios de todos los clientes apuntan al mismo renderer (§6.2). El renderer
debe convertir un hostname entrante en el `site_id` correcto antes de renderizar. Un
error aquí muestra la landing de un cliente bajo el dominio de otro: el peor fallo
posible del producto.

## Decisión

1. **Normalización única.** `normalizeHostname()` en `@nitro-web/shared` es la única
   implementación autorizada, y se usa tanto al escribir en `domains` como al leer.
   Dos normalizaciones distintas producirían un lookup que falla de forma
   intermitente y dificilísima de diagnosticar.
2. **Lookup por clave única.** `domains.hostname` tiene un índice único **parcial**
   sobre las filas activas: un hostname activo pertenece a un solo `site_id` (§12.3).
   Un hostname desvinculado conserva su fila histórica sin bloquear la reasignación.
3. **`www` no se colapsa.** `www.x.com` y `x.com` son filas distintas. La fila no
   canónica redirige (301) a la canónica, evitando contenido duplicado en SEO.
4. **Subdominio operativo.** Si el hostname pertenece a `NITRO_WEB_ROOT_DOMAIN`, se
   extrae el slug y se resuelve igual, contra la misma tabla. No hay dos caminos de
   resolución.
5. **Hostname desconocido → 404 controlado**, nunca la landing de otro tenant ni un
   error 500.

## Consecuencias

- La resolución es una sola consulta indexada, cacheable por hostname.
- El dominio corporativo nunca aloja páginas de clientes (§12.4): es un proyecto
  aparte y su hostname jamás entra en `domains`.
- Desarrollo local no puede usar hostnames reales. `localhost` se resuelve por una vía
  explícita de desarrollo (`?__site=` o `NITRO_WEB_DEV_SITE_ID`), deshabilitada en
  producción.

## Verificación

Tests de integración: un dominio resuelve el site correcto; un hostname desconocido da
404; el alterno redirige al canónico; y `normalizeHostname` tiene cobertura de casos
límite en `packages/shared/src/__tests__/hostname.test.ts`.
