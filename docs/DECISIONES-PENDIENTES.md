# Decisiones pendientes

Lo que la especificación (§25) deja abierto y **debe decidirse antes de producción**.
Cada punto indica qué bloquea, para poder priorizar en vez de tratarlas todas como
igual de urgentes.

---

## Bloquean el piloto

### 1. Dominio operativo para tenants

`nitrolanding.co` está puesto como **placeholder** en `.env.example` y en la
configuración. Hay que registrar un dominio real y configurar el wildcard
`*.dominio` en el proyecto Vercel del renderer.

Requisito no negociable (§12.4): **debe ser distinto del dominio corporativo**. La
reputación es compartida — una oferta fraudulenta en un subdominio afecta a todos los
tenants. Si las landings de clientes vivieran bajo el dominio de la empresa, un solo
abuso podría arrastrar el correo y la marca del negocio.

*Bloquea:* publicar cualquier landing.

### 2. ~~`SUPABASE_SECRET_KEY`~~ — resuelta

Configurada. Va en el dashboard y en el renderer (este la necesita para resolver
dominios de visitantes anónimos), nunca con prefijo `NEXT_PUBLIC_`. El reparto está
en [`ENTORNO.md`](ENTORNO.md).

### 3. Disponibilidad del modelo de Gemini

La especificación nombra `gemini-3.6-flash`. Hay que verificar que ese identificador
existe y está disponible para la cuenta, y medir su costo real por generación antes de
prometer cuotas por plan (§16.1 dice explícitamente que las cifras son hipótesis).

El nombre se lee de `GEMINI_MODEL` y la integración pasa por `packages/ai`, así que
cambiarlo no toca el editor.

*Bloquea:* la generación de contenido. No bloquea publicar ni vender.

---

## Bloquean la v1 comercial

### 4. Proveedor de correo transaccional

Se necesita para invitaciones, recuperación de acceso, confirmación de pedidos y
alertas de consumo. La landing de referencia usaba Resend; conviene evaluarlo junto a
alternativas por costo y entregabilidad en Colombia.

### 5. Proveedor de pagos de la suscripción SaaS

El piloto cobra manualmente. La v1 necesita cobro recurrente. Debe soportar COP y los
medios de pago locales.

### 6. Precio con IVA incluido o discriminado

§16.4 exige mostrar de forma inequívoca si el precio incluye IVA. **Requiere validación
con contador**, no es una decisión de producto. Afecta a la interfaz de planes, a las
cuentas de cobro y a lo que se promete comercialmente.

### 7. Política de retención de datos

Cuánto tiempo se conservan pedidos, contactos, eventos y assets, y qué se hace al
terminar la relación con un tenant. Es requisito de protección de datos (§14.4), no una
optimización de almacenamiento.

### 8. Límites reales por plan

Los valores en `plans.limits_json` son estimaciones. Se ajustan después de medir en el
piloto: transferencia, invocaciones, almacenamiento, tokens y minutos de soporte por
cliente.

---

## Decisiones técnicas abiertas

### 9. Rate limiting compartido

El límite de `/api/orders` es **en memoria por instancia**. En Vercel cada instancia
tiene su propio contador, así que no es un límite global. Para el piloto basta —frena
un script, y la idempotencia cubre los duplicados legítimos—, pero un límite real
necesita almacenamiento externo (Upstash Redis del Marketplace, o Vercel Edge Config).

### 10. Migración a Tailwind 4

Se eligió Tailwind 3 para poder portar el sistema de diseño de la landing de referencia
sin reescribirlo (ADR 0006). Revisar después del gate del piloto.

### 11. Optimización de imágenes — *bucket resuelto, pipeline pendiente*

**Resuelto:** bucket `site-assets` y sus políticas por `tenant_id/site_id`
(`0010_storage.sql`, `0011_storage_listing.sql`). Público en lectura, con escritura
restringida al tenant dueño de la carpeta, techo de 5 MB por archivo y lista blanca de
MIME sin SVG.

**Pendiente:** el pipeline de conversión a WebP/AVIF y las variantes responsivas (§9).
Hoy se sube el archivo tal cual llega. Next optimiza al servir —`formats` está
configurado en `next.config.ts`— pero eso no reduce lo que se almacena ni lo que se
transfiere en la primera carga de cada variante.

El peso de las imágenes es parte del modelo financiero, no solo del rendimiento: una
landing de 10 MB consume cinco veces más transferencia que una de 2 MB. El límite de
5 MB por archivo acota el daño, no lo resuelve.

### 12. Estrategia de caché del renderer

Está decidido el *qué* (caché por `site_id`, invalidada solo al publicar ese sitio) pero
no el *cómo*. Opciones: `revalidateTag` de Next con una etiqueta por `site_id`, o la
Runtime Cache API de Vercel.

---

## Ya decididas en esta fase

Para no reabrirlas por olvido:

| Pregunta                           | Decisión                                              |
| ---------------------------------- | ----------------------------------------------------- |
| ¿Repositorio único o monorepo?     | Monorepo pnpm, dos apps, dos despliegues (ADR 0001)   |
| ¿Proyecto Supabase?                | Uno propio: `nitro_web` (`zdhdhlqnwubckdnqonxp`)       |
| ¿Se reutiliza el Supabase de Nitro Bot? | **No.** Prohibido por §13.1                      |
| ¿Un proyecto Vercel por cliente?   | **No.** Un renderer, muchos dominios (§6.2)           |
| ¿Dónde vive el precio?             | En `offers`, no en el contenido editable (ADR 0003)   |
| ¿Cómo se despliega producción?     | Solo vía Vercel; nunca Docker ni CLI local            |
