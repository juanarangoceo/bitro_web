# ADR 0001 — Monorepo con dashboard y renderer como despliegues separados

- **Fecha:** 2026-07-28
- **Estado:** Aceptada

## Contexto

La especificación (§6) exige que dashboard y renderer sean aplicaciones y despliegues
separados, con variables secretas independientes, pero permite que convivan en un
monorepo.

El riesgo que se busca evitar es concreto: el renderer sirve tráfico pagado de
campañas de terceros. Si un cambio en el panel administrativo puede tumbar el
renderer, un despliegue interno rompe las campañas de todos los clientes. Y si ambos
comparten variables de entorno, una credencial administrativa termina disponible en el
proceso que atiende tráfico anónimo de internet.

## Decisión

Monorepo pnpm con dos aplicaciones Next.js independientes:

- `apps/renderer` → proyecto Vercel propio, variables mínimas
- `apps/dashboard` → proyecto Vercel propio, variables administrativas

El código común vive en `packages/*` y se consume como TypeScript sin build
intermedio, mediante `transpilePackages` de Next.

## Consecuencias

- Un fallo del dashboard o de la IA no afecta las landings publicadas (§18, disponibilidad).
- `VERCEL_TOKEN`, `GEMINI_API_KEY` y `SUPABASE_SECRET_KEY` existen **solo** en el
  dashboard. El renderer nunca puede gestionar dominios ni generar contenido.
- Los paquetes compartidos se distribuyen como fuente: no hay paso de build que
  mantener, pero cada app debe declarar el paquete en `transpilePackages`.
- Los dos proyectos de Vercel deben crearse manualmente una vez. Está documentado en
  `docs/RUNBOOKS.md`.

## Alternativas descartadas

- **Una sola aplicación con rutas `/admin`:** más simple de desplegar, pero mezcla
  superficies de seguridad y hace que cualquier despliegue arriesgue las campañas.
  La especificación lo prohíbe explícitamente.
- **Dos repositorios separados:** obliga a versionar y publicar los paquetes
  compartidos en un registry para un equipo que hoy es una persona. Costo sin retorno.
