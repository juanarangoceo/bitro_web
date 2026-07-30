# Estado del proyecto y cómo continuar

> **Documento de traspaso.** Se actualiza al cerrar cada fase. Si retomas el
> trabajo (Codex, Claude Code u otra persona), **empieza por aquí**.

- **Última actualización:** 2026-07-30
- **Fase actual:** piloto asistido operable
- **Estado:** corte vertical **cerrado y pulido**. La landing del piloto está publicada y
  pública en https://nitro-web-renderer.vercel.app, y `apps/dashboard` existe con
  auth, editor, imágenes, publicación, pedidos y métricas. La capa de IA (`packages/ai`) ya está integrada con cuotas y auditoría; siguen abiertas las decisiones de §25 que requieren definición comercial. El 30 jul comenzó `apps/admin`, solicitado para operar clientes de forma asistida antes de habilitar autoservicio.

**Admin operativo — desplegado:**

- Aplicación separada en `apps/admin`, puerto 3002.
- Acceso limitado por sesión + `platform_admins`.
- Alta y estado de tenants, invitación de owners e instalación de sitios.
- Oferta y dominios por sitio.
- Catálogo de plantillas, versiones validadas y ciclo de aprobación.
- Toda mutación escribe `audit_log`.
- Migración `0013` aplicada en `zdhdhlqnwubckdnqonxp`; un operador activo.
- Proyecto Vercel `nitro-web-admin`, raíz `apps/admin`, producción en
  `https://nitro-web-admin.vercel.app`.
- Publicación y rollback en modo soporte, revisión humana, dominios vía API de
  Vercel, pedidos, métricas, consumo de IA, notas internas y auditoría.

**Verificación al cierre de esta fase:**

```
pnpm test                    → 75 pruebas en verde
pnpm typecheck               → sin errores
next build (renderer)        → compila
./scripts/validate-sql.sh    → 25 tablas con RLS; AISLAMIENTO MULTI-TENANT: OK
Supabase (zdhdhlqnwubckdnqonxp) → 25 tablas, 25 con RLS, 37 políticas, 0 grants a anon
get_advisors(security)       → sin bloqueantes (ver §2, "Esquema en Supabase")
REST con la clave publicable → 42501 en toda tabla; solo responden las dos funciones
Storage con sesión del owner → escritura propia 200, ajena 400, SVG 400, lectura pública 200
Borrador del sitio piloto    → pasa compileContentValidator(schema, 'publish')
```

---

## 1. Lo que hay que leer antes de tocar código

| Orden | Documento                                            | Por qué                                           |
| ----- | ---------------------------------------------------- | ------------------------------------------------- |
| 1     | [`ESPECIFICACION-RESUMEN.md`](ESPECIFICACION-RESUMEN.md) | Restricciones que no se pueden violar         |
| 2     | [`adr/`](adr/)                                       | Por qué el sistema está hecho así                 |
| 3     | [`RUNBOOKS.md`](RUNBOOKS.md)                          | Infra provisionada y procedimientos               |
| 4     | [`ENTORNO.md`](ENTORNO.md)                            | Qué variable va en qué aplicación                 |

La especificación completa está en Google Drive (carpeta `openclaw`, file id
`1MfdvL0mdiHVRMS-MILxGxza7FRShfRvr`).

---

## 2. Hecho y verificado

### Monorepo

pnpm workspaces, Node 22, TypeScript estricto (`noUncheckedIndexedAccess`),
Vitest. `pnpm test` → **75 pruebas en verde**.

### `packages/shared`

Utilidades sin dependencias de framework, con pruebas de casos límite:

- `normalizeHostname()` — única normalización autorizada para el lookup de dominios
- `validateSubdomainSlug()` + lista de reservados (`www`, `admin`, marcas propias)
- `normalizeEmail()` / `normalizePhone()` — deduplicación de contactos, E.164 con
  indicativo colombiano por defecto
- `calculateOrderTotals()` — enteros en unidad mínima, rechaza descuento > subtotal
- `extractAttribution()` — lista blanca de UTMs y click IDs, sin caracteres de control
- `buildWhatsAppUrl()` — mensaje prellenado con plantilla por tenant
- Enums del dominio, espejados en Postgres

### `packages/contracts`

El contrato de plantilla. Una declaración alimenta editor, validación e IA:

- `parseContentSchema()` — valida el `content_schema` de una plantilla
- `compileContentValidator()` — compila el schema a un validador Zod **estricto**
  (una sección desconocida es un error, no algo que se ignora)
- `buildAiJsonSchema()` — deriva el JSON Schema para el modelo, **excluyendo**
  precios, imágenes y URLs
- `mergeAiContent()` — fusiona la salida del modelo conservando lo que no puede escribir
- `validateManifest()` — coherencia cruzada: `ai_sections` y `assetSlot` deben
  apuntar a cosas que existen

### `packages/db` — esquema completo

24 tablas, **todas con RLS activo**. Aplicadas y verificadas contra un Postgres
real (`./scripts/validate-sql.sh`).

Piezas clave:

- `app.current_tenant_ids()` y `app.has_tenant_role()` — `SECURITY DEFINER`,
  `STABLE`, `search_path` fijado. Base de toda política.
- `create_public_order()` — **única** vía de creación de pedidos. Lee el precio de
  `offers`; el navegador no tiene INSERT sobre `orders`, así que no existe ruta
  por la que un precio del cliente llegue a la base.
- `record_page_view()` — agregados diarios sin pipeline de eventos.
- Trigger de **inmutabilidad**: una `template_version` publicada no se puede editar.
- `0008_grants.sql` — `anon` sin acceso a ninguna tabla; solo dos funciones.
- `admin_notes` — tabla sin políticas: las notas internas no las lee el cliente.

**Pruebas negativas de aislamiento** (`packages/db/tests/01_rls_isolation.sql`),
que es el criterio de aceptación §22.1.9:

```
ok  A NO ve el sitio / ofertas / contactos / membresías del tenant B
ok  A NO puede modificar el sitio ni el precio del tenant B
ok  A NO puede crear ni borrar sitios en el tenant B
ok  A NO puede leer admin_notes (permiso denegado)
ok  Nadie inserta pedidos directamente
ok  Un usuario sin sesión no ve nada
AISLAMIENTO MULTI-TENANT: OK
```

### `packages/templates` — plantilla `coffee-maker` 1.1.0

Portada del inventario de la landing real. Once secciones (`hero`, `problem`,
`gallery`, `hotspots`, `recipes`, `bundle`, `savings`, `social_proof`, `offer`, `faq`, `seo`), ocho
`asset_slots` con proporciones y tamaños mínimos, y contenido por defecto tomado de la
página en producción.

Decisiones que conviene no revertir:

- El **precio no está en el schema**: vive en `offers`. Editar textos no puede tocar lo
  que cobra el servidor.
- Los **testimonios no son generables por IA**: inventar uno es fabricar prueba social.
- El contenido por defecto **no trae imágenes** y por eso **no es publicable tal cual**.
  Es la fricción correcta: nadie debe publicar con las fotos de otro producto. Hay una
  prueba que lo verifica.

### `apps/renderer` — app pública

Compila y pasa TypeScript. Incluye:

- Resolución `hostname → site_id` con normalización única, redirección del dominio
  alterno al canónico, 404 para hostname desconocido y aviso neutro para sitio pausado
- Lectura del **snapshot publicado**, nunca del borrador
- Registro estático de componentes por `component_key`
- `record_page_view()` sin bloquear el render
- Caché por hostname con etiqueta por `site_id`; publicar o restaurar invalida
  únicamente el sitio afectado mediante un endpoint autenticado
- Ruta de preview por token, con `noindex` por cabecera y por metadatos
- Plantilla `CoffeeMakerV1` completa, con lectura defensiva del contenido: un campo que
  falta oculta esa parte en vez de tumbar la página
- `POST /api/orders`: validación en servidor, honeypot, rate limiting, idempotency key.
  **El schema de entrada no admite ningún campo de precio** — no es que se ignore, es
  que no existe en el contrato.

### Flujo de publicación (`packages/db/src/publication.ts`)

`publishSite()` valida el borrador en modo `publish`, exige oferta activa, inserta el
snapshot y recién entonces mueve el puntero. `rollbackSite()` solo mueve el puntero,
verificando que la publicación pertenezca a ese sitio. `hasPendingChanges()` deriva
`changes_pending` de timestamps, sin columna que mantener sincronizada.

### Esquema en Supabase — aplicado

Las once migraciones están aplicadas en `zdhdhlqnwubckdnqonxp` (R2 ejecutado). El
remoto coincide con lo que valida `validate-sql.sh`: 24 tablas, 24 con RLS, 37
políticas, cuatro planes sembrados y **cero grants para `anon`**.

`0009_search_path.sql` se añadió a raíz de los advisors: `app.touch_updated_at` y
`app.enforce_template_version_immutability` no tenían `search_path` fijado. Es el mismo
argumento de ADR 0002 aplicado a las funciones de trigger.

Los seis avisos que quedan son **por diseño** y no se van a "arreglar":

| Aviso                                              | Por qué se acepta                                             |
| -------------------------------------------------- | ------------------------------------------------------------- |
| `admin_notes` y `order_counters` con RLS sin políticas | Es el mecanismo: sin políticas, nadie salvo `service_role` lee |
| `create_public_order` y `record_page_view` ejecutables por `anon` | Son exactamente las dos funciones que §14.2 expone al visitante |

Los tipos están en `packages/db/src/types.generated.ts` y los clientes ya son
`SupabaseClient<Database>`. Tiparlos destapó dos defectos reales en
`POST /api/orders`: se pasaba `null` donde la función espera que se omita el argumento
para que aplique su `DEFAULT`, y `Attribution` era una `interface`, que TypeScript no
considera asignable a `Json`. Ambos corregidos.

### Storage — bucket `site-assets`

Rutas `<tenant_id>/<site_id>/<archivo>`. La primera carpeta **es** la frontera de
seguridad: `app.tenant_from_storage_path()` la lee y las políticas la comprueban con
`app.has_tenant_role()`, igual que el resto del esquema.

Público en lectura, y no es un descuido: una imagen de una landing publicada se le
sirve a visitantes anónimos, así que es pública por definición. Firmarla rompería el
caché del CDN y el optimizador de Next sin esconder nada. Lo que se controla es quién
escribe.

Techo de 5 MB por archivo y lista blanca de MIME. **SVG queda fuera**: puede contener
`<script>` y se serviría desde el mismo origen que las landings.

`0011` quitó la política de lectura abierta que creó `0010`. La detectó el advisor
`public_bucket_allows_listing`: en un bucket público esa política no habilita ver una
imagen —la URL pública no pasa por RLS— sino **listar** el bucket, y como las rutas
llevan `tenant_id`, eso exponía cuántos clientes hay y cuántos sitios tiene cada uno.
Listar quedó acotado a los tenants del usuario.

Verificado contra el proyecto real con una sesión del owner:

```
subir a la carpeta propia        → 200
subir a la carpeta de otro tenant→ 400
subir sin carpeta de tenant      → 400
subir un SVG                     → 400
leer por URL pública, sin credenciales → 200 image/png
anon listando el bucket          → []
```

### `apps/dashboard` — app privada

Next 16 + Tailwind 3 + `@supabase/ssr`. Corre en el puerto 3001
(`pnpm dev:dashboard`). **Ojo:** en la máquina de Juan ese puerto suele estar tomado
por otro proyecto; si `curl` devuelve una página ajena, es eso y no un fallo de auth.

Lo que hay:

| Ruta | Qué hace |
| ---- | -------- |
| `/login` | Contraseña o enlace por correo |
| `/` | Listado de landings + creación desde plantilla publicada |
| `/sitios/[id]` | Editor generado desde `content_schema`, oferta, publicar, preview |
| `/sitios/[id]/imagenes` | Subida y borrado seguro por `asset_slot`; no borra assets usados por borradores o snapshots |
| `/sitios/[id]/pedidos` | Bandeja con estados, wa.me y métricas de 30 días |
| `/sitios/[id]/pedidos/csv` | Exportación |

Decisiones que conviene no revertir:

- **El editor se genera, no se escribe.** `src/lib/formulario.ts` traduce entre el
  `content_schema` y un `<form>` plano con la convención `seccion.campo.indice`. Una
  plantilla nueva trae su editor sin tocar el dashboard, que es el punto de §7.4.
- **Todo pasa por la sesión del usuario**, no por la clave secreta. Publicar, guardar y
  listar se apoyan en RLS: es la comprobación, no un adorno. El dashboard no importa
  `createSecretClient()` en ninguna parte.
- **Guardar valida en modo `draft`; publicar en modo `publish`.** Bloquear el guardado
  por un campo incompleto obligaría a terminar la landing de una sentada.
- **El CSV antepone `'` a las celdas que empiezan por `= + - @`.** Esos valores los
  escribe un comprador anónimo en el formulario público, y Excel los ejecutaría como
  fórmulas.
- **La auth se comprueba dos veces**: el middleware redirige y cada página vuelve a
  llamar `requerirSesion()`. Confiar solo en el middleware dejaría cualquier ruta nueva
  desprotegida por olvido. Verificado: `/`, `/sitios/x` y `/sitios/x/pedidos` devuelven
  307 a `/login` sin sesión.

### Infraestructura

- Proyecto Supabase **`nitro_web`** creado: ref `zdhdhlqnwubckdnqonxp`, `us-east-1`.
  Credenciales públicas ya en `.env.local` (no versionado).
- Proyecto de referencia identificado y clonado: `coffee-maker-pro` en Vercel →
  repo público `github.com/juanarangoceo/cafetera_espresso`.

---

## 3. Lo que falta fuera del corte vertical

En orden. El orden importa: viene de §20 de la especificación.

### 3.1 Acceso

El owner ya inició sesión. No existe una contraseña recuperable: se entra por enlace
mágico o se crea una nueva mediante recuperación. El recorrido está en
[`GUIA-ACCESO.md`](GUIA-ACCESO.md). Antes de clientes externos falta conectar un SMTP
propio; el servicio compartido de Supabase sirve únicamente para pruebas limitadas.

### 3.1.1 `packages/ai` — completado el 29 jul 2026

`packages/ai` llama a Gemini 3.6 Flash con salida estructurada. El dashboard permite generación global o por sección, reserva cuota de forma atómica y registra modelo, prompt, tokens, latencia, costo y resultado. Los campos de precio, imágenes y testimonios permanecen fuera del alcance del modelo.

### 3.2 Pendientes comerciales

Selector multiempresa, gestión autoservicio de dominios, admin maestro, billing y SMTP
pertenecen a la v1 comercial. El piloto usa un tenant y el alta de dominios continúa
mediante `pnpm db:seed-domain`.

La decisión operativa del 30 jul adelanta únicamente el **admin interno asistido**:
Juan vincula y opera los clientes. Siguen aplazados el autoservicio, billing automático
y el selector multiempresa del cliente.

### 3.3 Admin operativo — completado el 30 jul 2026

El admin interno ya permite operar el piloto asistido. No convierte la creación de
plantillas visuales en autoservicio: Codex o Claude Code implementan y registran el
componente en el renderer; el admin gestiona su catálogo, contrato, versiones,
aprobación e instalación.

La URL `*.vercel.app` conserva Deployment Protection. El operador debe pertenecer al
equipo de Vercel y además autenticarse en Nitro Web; son dos fronteras deliberadas.

---

## 4. Decisiones ya tomadas (no volver a abrir sin ADR)

1. Monorepo, dos apps, dos despliegues de Vercel (ADR 0001)
2. RLS vía `app.current_tenant_ids()` `SECURITY DEFINER` (ADR 0002)
3. Contenido en JSON validado; precio e inventario relacionales (ADR 0003)
4. Publicación por snapshot inmutable; rollback mueve un puntero (ADR 0004)
5. Una sola normalización de hostname, índice único parcial (ADR 0005)
6. Next 16 / React 19 / Tailwind **3** / Zod 4, para poder portar la landing de
   referencia sin reescribir su sistema de diseño (ADR 0006)

---

## 5. Hallazgos del inventario de Coffee Maker Pro

Cosas que la especificación asumía y que conviene saber:

- **No existía ningún proyecto Coffee Maker local.** El código está en el repo
  público `juanarangoceo/cafetera_espresso`, desplegado como `coffee-maker-pro`.
- La landing de referencia **calcula el total en el cliente y lo hardcodea**
  (`total_price: 490000` en `src/app/actions/order.ts`). Nitro Web corrige esto
  por diseño: el total sale de `offers` dentro de `create_public_order()`.
- La referencia escribe en una tabla `orders_cod` con la clave `anon`. Ese modelo
  no es multi-tenant y **no debe portarse**.
- Trae dependencias que la plantilla no necesita (Sanity, Shopify Buy, Resend,
  react-email, chatbot con `@google/genai`). Al portarla, **eliminar todas**:
  el blog, el checkout de Shopify y el chatbot están fuera del alcance (§2.3).
- Su contenido está en constantes de `src/lib/data.ts`: es exactamente lo que
  debe convertirse en `default_content` de la plantilla.

---

## 6. Comandos

```bash
pnpm install
pnpm test                    # 73 pruebas
pnpm typecheck               # paquetes, apps y scripts/
pnpm db:seed-template        # siembra coffee-maker desde packages/templates (R4)
pnpm db:seed-site -- --price=490000   # crea sitio, borrador y oferta
pnpm db:seed-assets -- --hero-mobile=<ruta> --hero-desktop=<ruta>
pnpm db:migrate-coffee-v11   # migración explícita y auditada; nunca automática
pnpm db:seed-domain -- --hostname=<host>
pnpm db:publish-site -- --as=<correo> --reviewed-by="<quién revisó>"
pnpm dev:dashboard           # puerto 3001 (ojo: suele estar ocupado en local)
./scripts/validate-sql.sh    # Postgres efímero + migraciones + aislamiento

tmux attach -t nitro_web     # sesión de trabajo persistente
```

## 7. Riesgos abiertos

| Riesgo                                   | Estado                                                    |
| ---------------------------------------- | --------------------------------------------------------- |
| Sitio sin imágenes                       | Bloquea publicar; requiere definir Storage (§25.11)       |
| `coffee-maker` 1.1.0                      | Se publica tras verla en preview (R4 pasos 3-4) |
| Dominio operativo sin definir            | `nitrolanding.co` es un placeholder — ver DECISIONES       |
| Owner sin contraseña conocida            | Se accede por enlace mágico o recuperación; nunca se revela un hash |
| Modelo de Gemini                         | La spec nombra `gemini-3.6-flash`; verificar disponibilidad |
| Proveedor de correo y de pagos sin elegir | Bloquea la v1, no el piloto                               |
