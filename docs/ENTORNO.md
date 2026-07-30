# Variables de entorno

Plantilla completa en [`.env.example`](../.env.example).

## Regla de oro

> El prefijo `NEXT_PUBLIC_` incrusta el valor en el bundle que descarga el navegador.
> **Ninguna clave secreta puede llevar ese prefijo.** (§24 de la especificación.)

Si una variable secreta se filtra a un `NEXT_PUBLIC_`, rotarla es obligatorio: ya está
en el JavaScript servido a todos los visitantes de todas las landings.

## Reparto por aplicación

La separación no es cosmética: el renderer atiende tráfico anónimo de internet. Todo lo
que no necesita, no debe tenerlo.

| Variable                               | Renderer | Dashboard | Exposición |
| -------------------------------------- | :------: | :-------: | ---------- |
| `NEXT_PUBLIC_SUPABASE_URL`             |    ✅    |    ✅     | Pública    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |    ✅    |    ✅     | Pública    |
| `SUPABASE_SECRET_KEY`                  |    ✅    |    ❌     | **Secreta** |
| `GEMINI_API_KEY`                       |    ❌    |    ✅     | **Secreta** |
| `GEMINI_MODEL`                         |    ❌    |    ✅     | Servidor   |
| `VERCEL_TOKEN`                         |    ❌    |    ✅     | **Secreta** |
| `VERCEL_TEAM_ID`                       |    ❌    |    ✅     | Servidor   |
| `VERCEL_RENDERER_PROJECT_ID`           |    ❌    |    ✅     | Servidor   |
| `NITRO_WEB_ROOT_DOMAIN`                |    ✅    |    ✅     | Servidor   |
| `CACHE_REVALIDATION_SECRET`            |    ✅    |    ✅     | **Secreta** |
| `NITRO_WEB_CORPORATE_DOMAIN`           |    ❌    |    ✅     | Servidor   |
| `WHATSAPP_TEMPLATE_DEFAULT`            |    ❌    |    ✅     | Servidor   |
| `EMAIL_PROVIDER_KEY`                   |    ❌    |    ✅     | **Secreta** |
| `BILLING_PROVIDER_KEY`                 |    ❌    |    ✅     | **Secreta** |
| `NITRO_WEB_DEV_SITE_ID`                |    ✅    |    ❌     | Solo local |

El renderer **no** puede gestionar dominios ni llamar a Gemini. Si alguna vez necesita
`VERCEL_TOKEN`, algo se diseñó mal: esa operación pertenece al dashboard.

`apps/admin` es una aplicación interna separada. Recibe las dos variables públicas de
Supabase, `SUPABASE_SECRET_KEY`, `NITRO_WEB_ADMIN_URL` y
`NITRO_WEB_DASHBOARD_URL`. Su clave secreta solo se usa en servidor después de
verificar la sesión y la fila activa en `platform_admins`; no debe copiar las claves
de Gemini ni del renderer si no las necesita.

**El renderer sí necesita `SUPABASE_SECRET_KEY`**, y no es una concesión: el visitante
de una landing es `anon`, y `0008_grants.sql` le quita el acceso a *todas* las tablas.
Sin la clave secreta el renderer no puede resolver `hostname → site_id` ni leer la
publicación, así que no hay página que servir. Los usos están encapsulados en
`packages/db` (`resolveSiteByHostname`, `resolveSiteByPreviewToken`) y en
`POST /api/orders`; ningún componente la toca directamente.

### Desarrollo local

Next carga `.env.local` desde la raíz de **cada app**, no desde la del monorepo. Hay que
crear `apps/renderer/.env.local` con solo las variables marcadas ✅ para el renderer.
Copiar el archivo de la raíz entero funcionaría, pero le daría al renderer claves que
no le corresponden.

Para el admin se crea `apps/admin/.env.local` con:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
NITRO_WEB_ADMIN_URL=http://localhost:3002
NITRO_WEB_DASHBOARD_URL=http://localhost:3001
```

## Claves de Supabase

Supabase renombró sus claves. Nomenclatura vigente:

| Nombre actual      | Nombre anterior | Uso                                              |
| ------------------ | --------------- | ------------------------------------------------ |
| `publishable key`  | `anon key`      | Cliente y servidor. **Respeta RLS.**             |
| `secret key`       | `service_role`  | Solo servidor. **Omite RLS por completo.**       |

La `secret key` se usa exclusivamente para operaciones que deben saltarse RLS de forma
deliberada y auditada: crear un tenant, resolver un dominio en el renderer, insertar un
pedido desde un formulario público. Cada uno de esos usos está encapsulado en
`packages/db` y no se llama directamente desde componentes.

## Entornos

Preview y producción usan credenciales **distintas** (§14.3). Un preview con la clave
de producción convierte cualquier rama en un acceso total a los datos reales de los
clientes.

Las variables se cargan en Vercel por proyecto. No se versiona ningún `.env` con
valores reales: `.gitignore` excluye `.env*` salvo `.env.example`.

## Rotación

Rotar `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY` y `VERCEL_TOKEN` ante cualquier sospecha
de exposición, y de forma programada. El procedimiento está en
[`RUNBOOKS.md`](RUNBOOKS.md).
