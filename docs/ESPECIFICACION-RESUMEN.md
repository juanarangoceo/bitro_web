# Especificación Nitro Web — restricciones vinculantes

Resumen operativo de `Nitro_Web_Especificacion_Integral.docx` v1.1 (28 jul 2026).
Fuente completa en Google Drive, carpeta `openclaw`, file id
`1MfdvL0mdiHVRMS-MILxGxza7FRShfRvr`.

Este documento recoge **lo que un implementador no puede violar**. Para contexto
comercial, personas, precios y backlog, consultar el documento original.

---

## 1. Decisión central

Modelo **multi-tenant**. Dashboard y renderer se despliegan como aplicaciones
centrales. Cada landing es una instancia de una plantilla configurada por `site_id`
— **no** un repositorio ni un proyecto Vercel por cliente.

## 2. Principios no negociables (§1.2)

| Principio             | Aplicación                                                              |
| --------------------- | ----------------------------------------------------------------------- |
| Una sola oferta       | Cada landing vende un producto, combo, kit o promoción delimitada        |
| Centralización        | El cliente ve métricas globales sin entrar a cada landing                |
| Plantillas versionadas| Una versión nueva no cambia sitios ya publicados                         |
| Autoservicio controlado | El cliente edita contenido e imágenes, pero no rompe el diseño         |
| Costo predecible      | Planes con límites de landings, visitas e IA; nada ilimitado             |
| Seguridad multiempresa| Toda fila de negocio lleva `tenant_id` y está protegida por RLS          |
| Nitro Bot futuro      | La arquitectura reserva la integración, pero no la implementa            |

## 3. Alcance del piloto (§2.1)

Dentro:

- Un tenant inicial creado por procedimiento reproducible; `tenant_id` desde el día uno
- Autenticación del propietario
- Primera plantilla: **Coffee Maker Pro** adaptada al contrato
- Creación de landings desde plantilla; editor estructurado por secciones
- Generación global y por sección con Gemini
- Carga manual y optimización de imágenes (sin generación por IA)
- Borrador, preview, snapshot publicado y rollback básico
- Publicación en subdominio del dominio operativo compartido
- Formulario de pedido con **total calculado en servidor** y captura de atribución
- Bandeja de pedidos con estados, notas y forma de pago
- Botón `wa.me` con mensaje prellenado (sin API de WhatsApp ni Twilio)
- Exportación CSV general de pedidos
- Métricas por agregados diarios: vistas, pedidos, ingresos, conversión
- Checklist de primera publicación

**Fuera del piloto y de la v1** (§2.3): Nitro Bot, chatbot web, sincronización con
Shopify, generación de imágenes con IA, editor drag-and-drop, ecommerce multiproducto,
un proyecto Vercel por cliente, exportación de código, ERP/facturación/logística,
pipeline de eventos y sesiones, Meta CAPI, pruebas A/B, marketplace de plantillas.

## 4. Orden de trabajo obligatorio (§20)

> **No comenzar adaptando Coffee Maker directamente.** Primero crear los contratos,
> esquema, renderer y flujo de publicación. Adaptar la plantilla cuando exista un
> destino técnico estable.

1. Inspeccionar repositorio y configuración
2. Proponer plan y ADRs sin mutaciones externas
3. Crear monorepo y pruebas base
4. Migraciones en local o rama de desarrollo; **no tocar producción de Nitro Bot**
5. Aislamiento multi-tenant y tests de autorización
6. Renderer y publicación mínima con plantilla ficticia
7. Adaptar Coffee Maker al contrato
8. Editor, assets, pedidos, agregados mínimos e IA por fases
9. Verificar cada fase con tests y criterios de aceptación
10. Documentar variables, runbooks y rollback

## 5. Contrato de plantilla (§7.1)

Campos del manifest: `template_key`, `version`, `display_name`, `category`,
`component_key`, `content_schema`, `default_content`, `asset_slots`, `ai_sections`,
`compatibility`, `visibility`, `owner_tenant_id`, `origin`.

Reglas de versionado (§7.3):

- Un sitio queda fijado a `template_version_id`
- Las versiones publicadas son **inmutables**
- Las migraciones de contenido son explícitas, reversibles y auditables
- Ocultar una plantilla impide nuevas instalaciones, no elimina instancias

## 6. Estados

**Sitio** (§4.5): `draft`, `preview`, `published`, `changes_pending`, `paused`, `archived`.

**Pedido** (§10.1): `new`, `pending_confirmation`, `confirmed`, `preparing`, `shipped`,
`delivered`, `cancelled`, `returned`.

**Contacto** (§10.4): `new`, `contacted`, `converted`, `discarded`, `unsubscribed`.

**Plantilla** (§5.4): `development`, `preview`, `approved`, `published`, `hidden`, `deprecated`.

## 7. Seguridad (§14)

- RLS activo en **todas** las tablas expuestas
- Políticas basadas en `tenant_members`; `TO authenticated` **no** es autorización suficiente
- No usar `user_metadata` para decisiones de acceso; usar `app_metadata`
- Nunca exponer `service_role` al frontend
- Las vistas públicas usan `security_invoker` o quedan fuera de schemas expuestos
- Formularios públicos: validación en servidor, rate limiting, honeypot,
  **idempotency key**, y cálculo del total en servidor desde la oferta publicada
- Buckets privados para borradores; rutas con `tenant_id/site_id`

## 8. Dominios (§12)

- Wildcard sobre un dominio operativo **distinto del corporativo** (`*.nitrolanding.co`)
- Slugs validados globalmente y contra reservados
- Un hostname activo pertenece a **un solo** `site_id`
- Un site puede tener varios dominios; uno es `canonical`, los demás redirigen
- No eliminar un dominio de Vercel antes de desvincularlo localmente
- Revisión humana obligatoria de la primera publicación de una cuenta nueva
  (la reputación del dominio raíz es compartida entre todos los tenants)

## 9. IA (§8)

- Gemini vía capa de servicio **server-side**; la clave nunca llega al navegador
- Modelo configurable por variable (`GEMINI_MODEL`) para migrar sin tocar el editor
- Salida estructurada validable contra JSON Schema
- El modelo no puede cambiar nombres de campos ni inventar secciones
- Guardar `prompt_version`, modelo, tokens, latencia, costo y resultado
- Cuotas y rate limiting por tenant; al agotar la cuota se pausa la IA,
  **nunca se apaga la landing**

## 10. Métricas (§11)

Piloto: atribución guardada en cada pedido + agregados diarios por `tenant_id` y
`site_id` (`page_views`, `orders`, `revenue`, `subscribers`). La tabla `events` y el
pipeline de sesiones son fase posterior.

Las métricas no coincidirán con Meta Ads ni GA4; el dashboard debe explicar la
metodología y no presentar visitantes únicos como personas identificadas.

## 11. Criterios de aceptación del piloto (§22.1)

1. Coffee Maker se instala como site `draft` ligado al tenant y a una versión inmutable
2. El cliente edita campos, genera JSON válido con IA y carga imágenes
3. Preview no altera producción; publicar crea snapshot y el rollback funciona
4. El subdominio operativo resuelve el site correcto
5. El total del pedido se calcula en servidor y conserva snapshot de oferta
6. UTMs y click IDs disponibles quedan guardados en el pedido
7. El pedido se confirma con `wa.me`, cambia de estado y se exporta a CSV
8. Los agregados diarios muestran vistas, pedidos, ingresos y conversión
9. **Dos tenants de prueba no pueden consultar datos cruzados**

## 12. Gate de decisión antes de la v1 (§19.2)

No continuar por haber terminado el código. Se requiere: tres vendedores publican una
landing, al menos dos publican una segunda, la mayoría lo logra sin intervención
técnica, se reciben pedidos reales con atribución correcta, y existe disposición real
a pagar entre $99.000 y $189.000 COP.
