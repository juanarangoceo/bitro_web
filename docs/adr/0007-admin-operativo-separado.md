# ADR 0007: admin operativo separado y acceso transversal auditado

- **Estado:** aceptada
- **Fecha:** 2026-07-30

## Contexto

El dashboard del cliente se autoriza mediante membresías y RLS. El equipo de Nitro
Web necesita crear tenants, usuarios, sitios, dominios y versiones de plantillas
antes de que exista autoservicio. Esas operaciones cruzan fronteras de tenant y no
pueden fingirse agregando al operador como miembro de cada cliente.

## Decisión

Crear `apps/admin` como aplicación y despliegue separados. La sesión se autentica con
la clave publicable y `auth.getUser()`. Después, un cliente secreto comprueba que el
`user_id` exista y esté activo en `platform_admins`.

Solo las Server Actions posteriores a esa doble comprobación pueden usar la clave
secreta. Cada mutación escribe `audit_log` con el operador, tenant, acción y datos
mínimos del cambio. La clave secreta nunca se entrega a componentes cliente.

Las versiones publicadas de plantillas siguen siendo inmutables. El admin crea una
versión nueva para cambiar su contrato y las migraciones de sitios son explícitas.

## Consecuencias

- El dashboard del cliente conserva su modelo de sesión + RLS sin excepciones.
- Un usuario autenticado no se convierte en operador por conocer la URL del admin.
- Dar o retirar acceso operativo exige modificar `platform_admins` mediante el
  runbook interno.
- El admin es una superficie de alto privilegio y se despliega con variables
  separadas y acceso restringido.

