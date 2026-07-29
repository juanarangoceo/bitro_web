# Estado del proyecto y cómo continuar

> **Documento de traspaso.** Se actualiza al cerrar cada fase. Si retomas el
> trabajo (Codex, Claude Code u otra persona), **empieza por aquí**.

- **Última actualización:** 2026-07-29
- **Fase actual:** piloto validable (§19.1 de la especificación)
- **Estado:** corte vertical en pie: **esquema aplicado, tenant creado, plantilla
  sembrada y el primer sitio renderizando en preview**. Falta subir imágenes y
  publicar; después el dashboard, la capa de IA y la bandeja de pedidos.

**Verificación al cierre de esta fase:**

```
pnpm test                    → 68 pruebas en verde
pnpm typecheck               → sin errores
next build (renderer)        → compila
./scripts/validate-sql.sh    → 24 tablas con RLS; AISLAMIENTO MULTI-TENANT: OK
Supabase (zdhdhlqnwubckdnqonxp) → 24 tablas, 24 con RLS, 37 políticas, 0 grants a anon
get_advisors(security)       → sin bloqueantes (ver §2, "Esquema en Supabase")
REST con la clave publicable → 42501 en toda tabla; solo responden las dos funciones
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
Vitest. `pnpm test` → **68 pruebas en verde**.

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

### `packages/templates` — plantilla `coffee-maker` 1.0.0

Portada del inventario de la landing real. Nueve secciones (`hero`, `problem`,
`gallery`, `bundle`, `savings`, `social_proof`, `offer`, `faq`, `seo`), seis
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

Las nueve migraciones están aplicadas en `zdhdhlqnwubckdnqonxp` (R2 ejecutado). El
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

### Infraestructura

- Proyecto Supabase **`nitro_web`** creado: ref `zdhdhlqnwubckdnqonxp`, `us-east-1`.
  Credenciales públicas ya en `.env.local` (no versionado).
- Proyecto de referencia identificado y clonado: `coffee-maker-pro` en Vercel →
  repo público `github.com/juanarangoceo/cafetera_espresso`.

---

## 3. Lo que falta

En orden. El orden importa: viene de §20 de la especificación.

### 3.1 Imágenes del sitio y publicación — *siguiente paso inmediato*

El sitio del piloto existe, con su borrador y su oferta, y **se ve en preview**. Lo que
falta para publicarlo:

1. Subir las imágenes de los `asset_slots` obligatorios (`hero_mobile` 4:5 y
   `hero_desktop` 1:1). El `default_content` **no trae ninguna** a propósito, así que
   la validación en modo `publish` rechaza el sitio hasta que existan. Requiere antes
   definir el bucket de Storage y sus políticas por `tenant_id/site_id` (§25.11).
2. Revisar preview en móvil y escritorio, peso y consola (R4 pasos 3 y 4).
3. `pnpm db:seed-template -- --publish` y publicar el sitio con `publishSite()`.
4. Conectar un dominio, que sigue bloqueado por §25.1.

### 3.2 Caché del renderer

Está decidido el *qué* (caché por `site_id`, invalidada solo al publicar ese sitio) pero
falta el *cómo*: `revalidateTag` con una etiqueta por `site_id`, o la Runtime Cache API
de Vercel. Hoy el renderer resuelve en cada petición.

### 3.3 Secciones de la plantilla que quedaron fuera

La landing de referencia tiene tres bloques que no se portaron por no ser esenciales al
corte vertical. Añadirlos es extender el `content_schema` y el componente:

- **Hotspots del producto** — puntos con coordenadas porcentuales sobre la foto
- **Recetas** — tarjetas con ingredientes, pasos y "secreto pro", en modal
- **Contador de cuenta regresiva** — el campo `show_countdown` ya existe en el schema;
  falta el componente

### 3.4 `apps/dashboard`

Auth con `@supabase/ssr`, listado de sitios, creación desde plantilla, editor
generado desde el `content_schema`, carga de imágenes por `asset_slot`, preview,
publicación, bandeja de pedidos y métricas.

### 3.5 `packages/ai`

Servicio server-side con Gemini. `buildAiJsonSchema()` ya produce el formato de
respuesta; falta la llamada, el registro en `ai_generations` (modelo,
`prompt_version`, tokens, latencia, costo) y las cuotas por tenant.

### 3.6 Bandeja de pedidos y métricas en la interfaz

Formulario público → `create_public_order()`, con honeypot, rate limiting e
idempotency key. Bandeja con estados, botón `wa.me`, exportación CSV. Dashboard
con vistas, pedidos, ingresos y conversión desde `site_metrics_daily`.

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
pnpm test                    # 68 pruebas
pnpm typecheck               # paquetes, apps y scripts/
pnpm db:seed-template        # siembra coffee-maker desde packages/templates (R4)
pnpm db:seed-site -- --price=490000   # crea sitio, borrador y oferta
./scripts/validate-sql.sh    # Postgres efímero + migraciones + aislamiento

tmux attach -t nitro_web     # sesión de trabajo persistente
```

## 7. Riesgos abiertos

| Riesgo                                   | Estado                                                    |
| ---------------------------------------- | --------------------------------------------------------- |
| Sitio sin imágenes                       | Bloquea publicar; requiere definir Storage (§25.11)       |
| `coffee-maker` 1.0.0 en `development`    | Deliberado: se publica tras verla en preview (R4 pasos 3-4) |
| Dominio operativo sin definir            | `nitrolanding.co` es un placeholder — ver DECISIONES       |
| Owner del piloto sin contraseña          | Usuario creado y confirmado; se define al existir el dashboard |
| Modelo de Gemini                         | La spec nombra `gemini-3.6-flash`; verificar disponibilidad |
| Proveedor de correo y de pagos sin elegir | Bloquea la v1, no el piloto                               |
