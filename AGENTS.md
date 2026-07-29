# Instrucciones para agentes de desarrollo

Este archivo lo leen Codex, Claude Code y cualquier otro agente que trabaje en el
repositorio. La especificación lo exige explícitamente (§27).

**Antes de escribir código, lee [`docs/HANDOFF.md`](docs/HANDOFF.md).** Contiene el
estado actual, qué falta y en qué orden.

---

## Reglas que no se negocian

Vienen de la especificación. Violarlas no es un atajo: rompe el producto o expone datos
de clientes.

1. **Todo dato de negocio lleva `tenant_id` y está protegido por RLS.** No hay
   excepciones. Una tabla nueva sin RLS es un defecto de seguridad, no una tarea
   pendiente.
2. **El total de un pedido se calcula en el servidor**, dentro de
   `create_public_order()`, leyendo `offers`. El navegador nunca envía un precio. No
   añadas campos de precio al endpoint público "por comodidad".
3. **Publicar crea un snapshot inmutable.** Editar el borrador no cambia la página
   pública. El renderer lee `site_publications`, nunca `site_content_drafts`.
4. **Un sitio queda fijado a una `template_version_id`.** Publicar una versión nueva de
   plantilla no migra sitios existentes. Las versiones publicadas son inmutables (hay
   un trigger que lo impide).
5. **Ninguna clave secreta lleva prefijo `NEXT_PUBLIC_`.** Ese prefijo la incrusta en
   el bundle que descarga el navegador.
6. **No se tocan las tablas ni el proyecto Supabase de Nitro Bot**
   (`snbxdzytpwibctepuiwq`). Nitro Web tiene el suyo: `zdhdhlqnwubckdnqonxp`.
7. **Producción se despliega solo vía Vercel.** Nunca por Docker ni CLI local. (Docker
   sí se usa en `scripts/validate-sql.sh`, que levanta un Postgres desechable para
   pruebas y lo destruye — eso no es un despliegue.)
8. **No se crea un proyecto de Vercel por cliente.** Un renderer sirve todos los
   dominios; la tabla `domains` decide qué `site_id` corresponde a cada hostname.

## Alcance

Se está construyendo el **corte vertical del piloto** (§19.1). No construyas por
adelantado la v1 comercial.

Fuera de alcance, no lo implementes aunque parezca fácil: Nitro Bot, chatbot web,
sincronización con Shopify, generación de imágenes con IA, editor drag-and-drop,
ecommerce multiproducto, pipeline de eventos y sesiones, Meta CAPI, pruebas A/B,
marketplace de plantillas.

## Antes de dar algo por terminado

```bash
pnpm test                    # pruebas unitarias
pnpm typecheck
./scripts/validate-sql.sh    # si tocaste SQL: migraciones + aislamiento multi-tenant
pnpm --filter @nitro-web/renderer exec next build
```

Si tocaste RLS o cualquier política, `validate-sql.sh` debe terminar con
`AISLAMIENTO MULTI-TENANT: OK`. Es el criterio de aceptación §22.1.9 y no se marca como
cumplido sin esa salida en verde.

## Convenciones

- **Idioma:** código, comentarios y documentación en español. Los identificadores de
  base de datos y las claves de contenido, en inglés y `snake_case` (es lo que espera
  PostgREST y lo que ya usa el esquema).
- **Comentarios:** explican *por qué*, no *qué*. Si un comentario repite lo que dice la
  línea siguiente, sobra. Si una decisión tiene una alternativa obvia que se descartó,
  di por qué se descartó.
- **Dinero:** siempre enteros en la unidad mínima de la moneda. Nunca `float`.
- **Migraciones:** archivos numerados en `packages/db/migrations/`, aplicados en orden.
  No edites una migración ya aplicada; añade una nueva.
- **Decisiones de arquitectura:** si cambias una de las reglas de arriba o tomas una
  decisión con alternativas reales, escribe una ADR en `docs/adr/`.
- **Mantén `docs/HANDOFF.md` al día** al cerrar cada fase. Es el punto de entrada del
  siguiente agente.

## Estructura

```
apps/renderer     App pública. Resuelve hostname → site_id y renderiza landings.
apps/dashboard    App privada (pendiente). Auth, editor, pedidos, métricas, IA.
packages/shared   Normalización, dinero, atribución, enums. Sin dependencias de framework.
packages/contracts Contrato de plantilla: manifest, content_schema, validación, JSON Schema para IA.
packages/db       Migraciones SQL, clientes de Supabase, resolución y publicación.
packages/templates Manifests y contenido por defecto de cada plantilla.
packages/ai       Capa de generación con Gemini (pendiente).
```

Los paquetes se consumen como TypeScript sin build previo, vía `transpilePackages`.
Los imports relativos van **sin extensión** (`from './hostname'`, no `'./hostname.js'`):
con extensión, el bundler de Next no los resuelve.
