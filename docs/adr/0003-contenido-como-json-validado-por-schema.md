# ADR 0003 — Contenido como JSON validado por schema, con columnas relacionales para lo transaccional

- **Fecha:** 2026-07-28
- **Estado:** Aceptada

## Contexto

Cada plantilla declara sus propias secciones y campos. Modelar eso con tablas
relacionales exigiría una migración por cada plantilla nueva, lo que contradice el
objetivo de incorporar plantillas sin tocar el núcleo (§7.4).

Pero el extremo contrario —guardar todo como JSON— es peor para precio, inventario,
dominios, pedidos y métricas: son datos que se consultan, agregan, ordenan y auditan.

## Decisión

Frontera explícita (§13.1):

- **JSON validado por `content_schema`:** textos, listas, FAQ, testimonios,
  referencias a assets. Vive en `site_content_drafts.content_json` y, congelado, en
  `site_publications.content_json`.
- **Columnas relacionales:** precio, inventario, moneda y estado de la oferta
  (`offers`); hostname y estado (`domains`); todo lo de `orders`, `order_items`,
  `contacts` y `site_metrics_daily`.

El precio **nunca** vive en el JSON de contenido. La landing lo lee desde `offers`, y
el cálculo del total de un pedido lo toma del snapshot de la oferta publicada, no del
contenido editable.

## Consecuencias

- Agregar una plantilla no requiere migración de base de datos.
- Un cliente que edita textos no puede alterar el precio que cobra el servidor: son
  superficies distintas con validaciones distintas.
- El contenido JSON debe validarse contra `content_schema` **al guardar** y **al
  publicar**. Un JSON inválido nunca llega a un snapshot.
- Las consultas sobre contenido (buscar landings que mencionen X) son más caras. Se
  acepta: no es un caso de uso del piloto.

## Alternativas descartadas

- **Tabla `site_sections` con filas por sección:** parece más relacional, pero los
  campos siguen siendo heterogéneos y termina siendo un JSON con pasos extra.
- **Todo en JSON, incluido el precio:** haría imposible calcular ingresos sin
  recorrer documentos, y expondría el precio a la misma ruta de edición que los textos.
