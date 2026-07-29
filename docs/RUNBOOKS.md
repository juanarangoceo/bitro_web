# Runbooks

Procedimientos operativos. Cada uno debe poder ejecutarse bajo presión, sin
reconstruir contexto.

---

## Infraestructura provisionada

| Recurso            | Valor                                                       |
| ------------------ | ----------------------------------------------------------- |
| Supabase (proyecto) | `nitro_web` — ref `zdhdhlqnwubckdnqonxp`, región `us-east-1` |
| Supabase (URL)     | `https://zdhdhlqnwubckdnqonxp.supabase.co`                   |
| Tenant del piloto  | `Coffee Maker Pro` — slug `coffee-maker-pro`, plan `piloto`, id `0e0a8c41-6c10-4ae0-89a3-04f74355931c` |
| Owner del piloto   | `juanarangopm@gmail.com` — user id `6cac3932-847a-49f5-b1a1-f67c918fb0eb` |
| Organización       | `juanarangoecommerce` (`gwrdzmsgcxlobkbtrcdh`)               |
| Equipo Vercel      | `seller360grados-projects` (`team_CmYLrlLBZUveo9wuFhaJ2rOy`) |
| Repo de referencia | `github.com/juanarangoceo/cafetera_espresso` (público)       |

> El proyecto Supabase de **Nitro Bot** (`snbxdzytpwibctepuiwq`) es intocable.
> Nitro Web no reutiliza sus tablas ni comparte credenciales con él (§13.1).

---

## R1 — Validar migraciones antes de aplicarlas

Levanta un Postgres desechable, aplica el stub de Supabase, corre las
migraciones en orden y ejecuta las pruebas negativas de aislamiento.

```bash
./scripts/validate-sql.sh
```

Debe terminar con `AISLAMIENTO MULTI-TENANT: OK` y `Migraciones válidas.`
Si falla, **no** aplicar nada en Supabase.

Esto no despliega nada: el contenedor se destruye al terminar.

## R2 — Aplicar el esquema en Supabase

Solo después de que R1 pase en verde.

1. Aplicar `packages/db/migrations/*.sql` **en orden numérico**. Cada archivo es
   una migración independiente; no reordenar (0002 define los helpers de RLS de
   los que dependen todas las políticas posteriores).
2. Verificar que no queden avisos de seguridad:
   `get_advisors(project_id, type="security")`. Cualquier tabla sin RLS o vista
   sin `security_invoker` es un bloqueante, no una advertencia.

   Seis avisos son esperados y están justificados en
   [`HANDOFF.md`](HANDOFF.md) → "Esquema en Supabase". Si aparece uno distinto,
   es un hallazgo real.
3. Regenerar tipos TypeScript en `packages/db/src/types.generated.ts`
   (`generate_typescript_types` del MCP de Supabase, o
   `supabase gen types typescript --project-id zdhdhlqnwubckdnqonxp`). El archivo
   es **generado**: no editarlo a mano, porque la siguiente regeneración lo pisa.
4. `pnpm typecheck`. Los tipos generados son la red que detecta que el código y
   el esquema se separaron; si compilaba antes y ahora no, el error es real.

Estado actual: aplicado hasta `0009_search_path.sql`.

## R3 — Crear el tenant inicial (§2.1)

El piloto necesita un tenant creado por procedimiento reproducible, con
`tenant_id` desde el día uno. Se hace con la clave secreta (omite RLS), nunca
desde el navegador:

1. Crear el usuario en Supabase Auth (invitación por correo).
2. `insert into tenants (name, slug, plan_id) values (..., 'piloto')`.
3. `insert into tenant_members (tenant_id, user_id, role) values (..., 'owner')`.
4. `insert into profiles (user_id, display_name)`.
5. Registrar la acción en `audit_log`.

Los pasos 2 a 5 van en **una sola sentencia** con CTEs que modifican datos: si
falla cualquiera, no queda un tenant sin owner ni un owner sin perfil.

Mientras no exista `apps/dashboard`, el paso 1 se hace con
`POST /auth/v1/admin/users` y `email_confirm: true`, **sin enviar invitación**: el
correo llevaría a una pantalla de acceso que todavía no existe. La contraseña se
define cuando esa pantalla exista. Para clientes reales, ya con dashboard, vale la
invitación por correo tal cual dice el paso 1.

Ejecutado una vez: ver "Infraestructura provisionada" para el tenant del piloto.

## R4 — Publicar una versión de plantilla

```bash
pnpm db:seed-template                 # siembra en development
pnpm db:seed-template -- --publish    # además la pasa a published
```

1. Verificar el manifest y el `content_schema` contra el contrato
   (`packages/contracts`).
2. Confirmar que `component_key` está registrado en el renderer. Un
   `component_key` sin componente produce un error de publicación.
3. Probar en preview con datos demo: móvil y escritorio, formularios, CTAs.
4. Revisar presupuesto de peso y que no haya errores de consola ni assets
   faltantes (§21.4).
5. Pasar la versión a `published` desde el admin.

`scripts/seed-template.ts` automatiza los pasos 1 y 2, y añade la comprobación
de `min_renderer_version` contra `RENDERER_VERSION`. **Los pasos 3 y 4 siguen
siendo humanos**: ningún script mira la landing en un teléfono. El paso 5 es
`--publish`.

Es idempotente: correrlo dos veces no duplica filas. Sobre una versión ya
publicada **no escribe** y lo dice, porque §7.3 la declara inmutable — corregir
algo publicado exige subir la versión en el manifest y volver a sembrar.

El orden correcto es sembrar en `development`, crear el sitio contra esa versión,
verlo en `/preview/<token>` y solo entonces publicar. Ni `resolveSiteByHostname`
ni `resolveSiteByPreviewToken` filtran por estado de la versión, así que un sitio
puede previsualizarse contra una versión en desarrollo: es justo lo que permite
cumplir el paso 3 antes del 5.

Sembrada: `coffee-maker` 1.0.0 en `development`.

**No altera sitios existentes.** Un sitio queda fijado a su
`template_version_id` (§7.3). Publicar 1.1 no migra los sitios en 1.0.

## R5 — Revertir una publicación (rollback)

Síntoma: el cliente publicó algo roto y hay tráfico pagado entrando.

1. Buscar la publicación anterior:
   `select id, publication_number, published_at from site_publications
    where site_id = :site order by published_at desc limit 5;`
2. Apuntar el sitio a ella:
   `update sites set published_publication_id = :publication_id where id = :site;`
3. Invalidar la caché del renderer para ese `site_id` (solo ese).
4. Registrar en `audit_log` con actor y motivo.

No se borra ni se edita ninguna publicación: el historial es la garantía de que
el rollback siempre es posible.

## R6 — Dominio que no verifica

1. Confirmar que el hostname en `domains` está normalizado
   (`normalizeHostname`): un espacio o una mayúscula rompen el lookup.
2. Revisar `verification_json` con los registros DNS que espera Vercel.
3. Verificar en el registrador del cliente que el registro existe y propagó
   (`dig +short <hostname>`).
4. Si el dominio quedó huérfano en Vercel, **no** eliminarlo allá antes de
   desvincularlo localmente (§12.3): primero `status = 'removed'` en `domains`.
5. Mientras tanto la landing sigue accesible por su subdominio de Nitro Web.

## R7 — Cuenta morosa (`past_due`)

Bloquear de forma progresiva, **nunca** apagando campañas activas (§16.4):

1. `billing_status = 'past_due'` y fijar `grace_until`.
2. Bloquear IA, creación de sitios y nuevas publicaciones. Conservar lectura.
3. Las landings publicadas **siguen activas** durante el periodo de gracia.
4. Solo al vencer `grace_until` y según contrato se pausan los sitios.

## R8 — Rotar credenciales

Ante sospecha de exposición, o de forma programada:

1. Generar la clave nueva en el proveedor (Supabase / Google AI / Vercel).
2. Actualizarla en las variables del proyecto de Vercel correspondiente.
3. Redesplegar (las variables se leen en build/runtime según el caso).
4. Revocar la clave anterior.
5. Registrar la rotación en `audit_log`.

Si una clave secreta apareció alguna vez en una variable `NEXT_PUBLIC_`, la
rotación **no es opcional**: ya se sirvió en el bundle a todos los visitantes.

## R9 — Primera publicación de una cuenta nueva

Revisión humana obligatoria (§12.4). La reputación del dominio raíz es
compartida: una oferta fraudulenta en un subdominio afecta a todos los tenants.

Verificar: que el producto existe y es legal, que las afirmaciones de
salud/ingresos/garantías están sustentadas, que los datos de contacto son
reales, y que la política de datos está publicada.

Ante incumplimiento: suspender ese `site` (no el tenant completo salvo
reincidencia), registrar en `audit_log` y notificar.

## R10 — Despliegue

Producción se despliega **solo vía Vercel**, nunca por Docker ni CLI local.

Dos proyectos separados, cada uno con sus propias variables (ver
[`ENTORNO.md`](ENTORNO.md)):

- `nitro-web-renderer` → raíz `apps/renderer`
- `nitro-web-dashboard` → raíz `apps/dashboard`

El wildcard `*.nitrolanding.co` se configura **solo** en el proyecto del
renderer. El dominio corporativo nunca apunta al renderer.
