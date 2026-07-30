-- =============================================================================
-- 0014_template_versions_instaladas.sql — leer la versión que usa mi propio sitio
--
-- `template_versions_select_published` (0003) responde a "¿qué puedo instalar?":
-- solo versiones `published` del catálogo visible. Se estaba usando también para
-- responder "¿de qué está hecho mi sitio?", y son preguntas distintas.
--
-- Un sitio queda fijado a una `template_version_id` (§7.3) y esa fila deja de
-- estar en el catálogo en cuanto la versión pasa a `hidden` o `deprecated`
-- —estados que existen justamente para frenar instalaciones nuevas **sin tocar
-- las existentes**— o mientras la versión todavía está en `development` y se
-- revisa en preview. En cualquiera de esos casos el join del editor devolvía
-- NULL y el dashboard respondía 404 sobre un sitio que sí existe, publicado
-- incluido.
--
-- Esta política no amplía nada: expone el contrato de la plantilla que el
-- tenant ya tiene instalada, que es exactamente lo que su editor necesita para
-- dibujarse.
-- =============================================================================

create policy template_versions_select_installed on public.template_versions
  for select to authenticated
  using (
    id in (
      select s.template_version_id
      from public.sites s
      where s.tenant_id in (select app.current_tenant_ids())
    )
  );
