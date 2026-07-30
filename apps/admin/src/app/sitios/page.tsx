import Link from 'next/link';
import { createSecretClient } from '@nitro-web/db';
import { Shell } from '@/components/Shell';
import { requerirOperador } from '@/lib/admin';

export default async function Sitios() {
  const operador = await requerirOperador();
  const db = createSecretClient();
  const { data: sitios } = await db.from('sites').select(
    'id, name, status, created_at, tenants ( id, name ), template_versions ( version, templates ( display_name ) ), domains ( hostname, status, is_canonical )',
  ).order('created_at', { ascending: false });
  return <Shell operador={operador} titulo="Sitios">
    <div className="space-y-3">{(sitios ?? []).map(s => {
      const tenant = uno(s.tenants); const version = uno(s.template_versions); const plantilla = uno(version?.templates);
      const dominio = s.domains?.find(d => d.is_canonical && d.status !== 'removed');
      return <Link key={s.id} href={`/sitios/${s.id}`} className="tarjeta block p-4 hover:border-brand-500">
        <div className="flex flex-wrap justify-between gap-3"><div><p className="font-medium">{s.name}</p><p className="text-xs text-ink-500">{tenant?.name} · {plantilla?.display_name} {version?.version}</p></div>
          <div className="text-right text-xs"><p>{s.status}</p><p className="text-ink-500">{dominio?.hostname ?? 'sin dominio'}</p></div></div>
      </Link>;
    })}</div>
  </Shell>;
}
function uno<T>(valor: T | T[] | null | undefined): T | undefined { return Array.isArray(valor) ? valor[0] : valor ?? undefined; }

