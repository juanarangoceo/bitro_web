# ADR 0004 — Publicación por snapshot inmutable

- **Fecha:** 2026-07-28
- **Estado:** Aceptada

## Contexto

El cliente edita su landing mientras esta recibe tráfico pagado. Si el renderer leyera
el borrador, cada tecla escrita cambiaría la página que está viendo un comprador, y un
guardado a medias rompería la campaña en vivo.

Además se exige rollback (§18, recuperación) y trazabilidad de qué se publicó y cuándo.

## Decisión

Dos tablas separadas:

- `site_content_drafts` — una fila por sitio, mutable, es lo que edita el cliente.
- `site_publications` — append-only. Publicar **copia** el borrador validado a una fila
  nueva. `sites.published_publication_id` apunta a la vigente.

El renderer lee **solo** `site_publications`. Nunca toca el borrador.

Rollback = apuntar `published_publication_id` a una publicación anterior. No se borra
ni se reescribe historial.

`changes_pending` no se almacena: se deriva comparando `site_content_drafts.updated_at`
con `site_publications.published_at` de la publicación vigente.

## Consecuencias

- Editar es seguro por construcción: no hay forma de romper la página pública desde el
  editor.
- El rollback es una operación de un campo, instantánea y reversible.
- Cada publicación consume almacenamiento (el JSON completo). Aceptable: son documentos
  de kilobytes y dan un historial auditable. Si crece, se archivan las publicaciones
  antiguas conservando las últimas N por sitio.
- Los assets referenciados por una publicación activa **no pueden borrarse
  físicamente** (§9), o el rollback dejaría imágenes rotas.
- La invalidación de caché es por `site_id`: publicar un sitio no invalida los demás.

## Alternativas descartadas

- **Un solo registro con bandera `is_published`:** no permite rollback ni historial.
- **Versionar con `updated_at` y leer el último válido:** deja indefinido qué es
  "válido" y no protege contra guardados parciales.
