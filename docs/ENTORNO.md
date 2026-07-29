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
| `SUPABASE_SECRET_KEY`                  |    ❌    |    ✅     | **Secreta** |
| `GEMINI_API_KEY`                       |    ❌    |    ✅     | **Secreta** |
| `GEMINI_MODEL`                         |    ❌    |    ✅     | Servidor   |
| `VERCEL_TOKEN`                         |    ❌    |    ✅     | **Secreta** |
| `VERCEL_TEAM_ID`                       |    ❌    |    ✅     | Servidor   |
| `VERCEL_RENDERER_PROJECT_ID`           |    ❌    |    ✅     | Servidor   |
| `NITRO_WEB_ROOT_DOMAIN`                |    ✅    |    ✅     | Servidor   |
| `NITRO_WEB_CORPORATE_DOMAIN`           |    ❌    |    ✅     | Servidor   |
| `WHATSAPP_TEMPLATE_DEFAULT`            |    ❌    |    ✅     | Servidor   |
| `EMAIL_PROVIDER_KEY`                   |    ❌    |    ✅     | **Secreta** |
| `BILLING_PROVIDER_KEY`                 |    ❌    |    ✅     | **Secreta** |
| `NITRO_WEB_DEV_SITE_ID`                |    ✅    |    ❌     | Solo local |

El renderer **no** puede gestionar dominios ni llamar a Gemini. Si alguna vez necesita
`VERCEL_TOKEN`, algo se diseñó mal: esa operación pertenece al dashboard.

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
