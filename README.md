# Nitro Web

Plataforma multiempresa (multi-tenant) para crear, personalizar, publicar y medir
**landing pages de una sola oferta**.

No es un ecommerce multiproducto ni un constructor visual libre. Su ventaja es reducir
la complejidad de Shopify cuando el negocio necesita vender una sola oferta y lanzar
campañas rápido.

- **Propietario del producto:** Juan David Arango Trejos / Nitro Ecom
- **Fuente de verdad:** `Nitro_Web_Especificacion_Integral.docx` v1.1 (Google Drive,
  carpeta `openclaw`, file id `1MfdvL0mdiHVRMS-MILxGxza7FRShfRvr`).
  Resumen vinculante en [`docs/ESPECIFICACION-RESUMEN.md`](docs/ESPECIFICACION-RESUMEN.md).
- **Estado actual y próximos pasos:** [`docs/HANDOFF.md`](docs/HANDOFF.md) ← empieza aquí

## Arquitectura

Dos aplicaciones Next.js sobre un mismo Supabase, desplegadas por separado:

| Paquete                  | Rol                                                                        |
| ------------------------ | -------------------------------------------------------------------------- |
| `apps/renderer`          | App pública multi-tenant. Resuelve `hostname → site_id` y renderiza landings |
| `apps/dashboard`         | App privada. Auth, editor, pedidos, métricas, IA                            |
| `packages/shared`        | Normalización, dinero, atribución, enums del dominio                        |
| `packages/contracts`     | Contrato de plantilla: manifest, `content_schema`, validación               |
| `packages/db`            | Migraciones SQL, tipos y clientes de Supabase                               |
| `packages/templates`     | Registro de plantillas y sus componentes                                    |
| `packages/ai`            | Capa de generación de contenido (Gemini)                                    |

El dominio **no** define un proyecto: todos los dominios apuntan al mismo renderer y la
tabla `domains` determina qué `site_id` corresponde a cada hostname. No se crea un
proyecto de Vercel por cliente.

## Requisitos

- Node.js ≥ 22
- pnpm 11
- Un proyecto Supabase **propio de Nitro Web** (nunca el de Nitro Bot)

## Puesta en marcha

```bash
pnpm install
cp .env.example .env.local        # y completar valores
pnpm test                         # pruebas unitarias
pnpm typecheck
pnpm dev:renderer                 # http://localhost:3000
pnpm dev:dashboard                # http://localhost:3001
```

Variables de entorno: ver [`docs/ENTORNO.md`](docs/ENTORNO.md).

## Reglas no negociables

Estas restricciones vienen de la especificación y **no** deben relajarse sin una ADR
que lo justifique:

1. Toda fila de negocio lleva `tenant_id` y está protegida por RLS.
2. El total de un pedido se calcula **en el servidor** desde la oferta publicada.
   El navegador nunca envía un precio.
3. Publicar crea un **snapshot inmutable**; editar el borrador no cambia el sitio público.
4. Un sitio queda fijado a una `template_version_id`. Publicar una versión nueva de
   plantilla **no** migra sitios existentes.
5. Ninguna clave secreta lleva el prefijo `NEXT_PUBLIC_`.
6. No se tocan las tablas ni el proyecto Supabase de Nitro Bot.
7. Producción se despliega **solo vía Vercel**, nunca por Docker ni CLI local.

## Documentación

| Documento                                                          | Contenido                                  |
| ------------------------------------------------------------------ | ------------------------------------------ |
| [`docs/HANDOFF.md`](docs/HANDOFF.md)                                 | Estado, qué falta, cómo retomar            |
| [`docs/ESPECIFICACION-RESUMEN.md`](docs/ESPECIFICACION-RESUMEN.md)   | Restricciones vinculantes de la spec       |
| [`docs/ENTORNO.md`](docs/ENTORNO.md)                                 | Variables de entorno y su exposición       |
| [`docs/DECISIONES-PENDIENTES.md`](docs/DECISIONES-PENDIENTES.md)     | Lo que falta decidir antes de producción   |
| [`docs/RUNBOOKS.md`](docs/RUNBOOKS.md)                               | Publicar plantilla, revertir, dominio roto |
| [`docs/adr/`](docs/adr/)                                             | Decisiones de arquitectura y su porqué     |
