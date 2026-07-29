#!/usr/bin/env bash
#
# Valida las migraciones aplicándolas sobre un Postgres efímero.
#
# Esto NO despliega nada: levanta un contenedor desechable, corre el stub de
# Supabase, aplica las migraciones en orden y borra el contenedor. Sirve para
# detectar errores de sintaxis y de constraints antes de tocar una base real.
#
# Uso: ./scripts/validate-sql.sh
set -euo pipefail

CONTAINER="nitro-web-sql-check"
PGPASSWORD="postgres"
DB="nitro_web_check"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Levantando Postgres efímero"
cleanup
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD="$PGPASSWORD" \
  -e POSTGRES_DB="$DB" \
  postgres:16-alpine >/dev/null

echo "==> Esperando a que la base esté lista"
# `pg_isready` no sirve aquí: durante la inicialización Postgres acepta
# conexiones antes de haber creado POSTGRES_DB, y además se reinicia a mitad del
# proceso. La única señal fiable es que una consulta real contra la base destino
# tenga éxito.
ready=0
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" psql -U postgres -d "$DB" -c 'select 1' >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done

if [ "$ready" -ne 1 ]; then
  echo "ERROR: la base no estuvo lista a tiempo" >&2
  docker logs "$CONTAINER" | tail -20 >&2
  exit 1
fi

run_sql_file() {
  local file="$1"
  echo "==> $(basename "$file")"
  docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d "$DB" -q < "$file"
}

run_sql_file "$ROOT/packages/db/tests/00_supabase_stub.sql"

for migration in "$ROOT"/packages/db/migrations/*.sql; do
  run_sql_file "$migration"
done

echo "==> Verificando que RLS esté activo en todas las tablas de negocio"
docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d "$DB" -q <<'SQL'
do $$
declare
  sin_rls text;
begin
  select string_agg(c.relname, ', ')
  into sin_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if sin_rls is not null then
    raise exception 'Tablas sin RLS: %', sin_rls;
  end if;

  raise notice 'OK: todas las tablas de public tienen RLS activo';
end $$;
SQL

echo "==> Pruebas negativas de aislamiento multi-tenant (§22.1.9)"
run_sql_file "$ROOT/packages/db/tests/01_rls_isolation.sql"

echo "==> Resumen"
docker exec -i "$CONTAINER" psql -U postgres -d "$DB" -c "
  select c.relname as tabla,
         c.relrowsecurity as rls,
         count(p.polname) as politicas
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_policy p on p.polrelid = c.oid
  where n.nspname = 'public' and c.relkind = 'r'
  group by c.relname, c.relrowsecurity
  order by c.relname;
"

echo ""
echo "Migraciones válidas."
