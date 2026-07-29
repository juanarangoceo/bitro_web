# ADR 0006 — Stack y versiones

- **Fecha:** 2026-07-28
- **Estado:** Aceptada

## Contexto

Nitro Web debe adaptar la landing existente **Coffee Maker Pro**
(`github.com/juanarangoceo/cafetera_espresso`, desplegada como el proyecto Vercel
`coffee-maker-pro`) como su primera plantilla, conservando la calidad visual y la
estructura de conversión (§7.5).

## Decisión

Se adopta el stack del proyecto de referencia, para que portar la plantilla sea una
reestructuración de contenido y no una reescritura visual:

| Pieza      | Versión | Motivo                                                        |
| ---------- | ------- | ------------------------------------------------------------- |
| Next.js    | 16      | Igual que la referencia; App Router                            |
| React      | 19      | Requerido por Next 16                                          |
| TypeScript | 5.7     | `strict` + `noUncheckedIndexedAccess`                          |
| Tailwind   | 3.4     | La referencia define su paleta (`coffee-*`, `gold-*`) en config JS |
| Zod        | 4       | Validación de `content_schema` y de formularios                |
| Supabase   | `@supabase/ssr` 0.8 | Auth con cookies en Server Components               |
| Vitest     | 2       | Pruebas unitarias sin configuración adicional                  |

**Tailwind 3, no 4:** la referencia declara su sistema de diseño en
`tailwind.config.ts` (escalas `coffee` y `gold`, fuentes, animaciones). Tailwind 4
mueve esa configuración a CSS, y migrarla mientras además se reestructura el contenido
mezcla dos fuentes de error visual. Migrar a v4 queda en el backlog, después del gate
del piloto.

## Consecuencias

- El código de la plantilla se puede portar sección por sección, comparando contra la
  landing en producción.
- Se hereda el riesgo de quedarse atrás en Tailwind. Mitigado: es una decisión con
  fecha de revisión (post-piloto), no permanente.
- Los paquetes compartidos se consumen como fuente TypeScript vía `transpilePackages`;
  no hay paso de build entre editar un paquete y verlo en la app.

## Nota sobre el modelo de IA

La especificación nombra `Gemini 3.6 Flash`. El nombre del modelo se lee de
`GEMINI_MODEL` y la integración pasa por una capa propia (`packages/ai`), de modo que
cambiar de modelo o de proveedor no toca el editor (§8.1 y §23, dependencia de
proveedor).
