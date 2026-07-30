import Link from 'next/link';
import { createSecretClient } from '@nitro-web/db';
import { Shell } from '@/components/Shell';
import { requerirOperador } from '@/lib/admin';

export default async function Inicio() {
  const operador = await requerirOperador();
  const db = createSecretClient();
  const [clientes, sitios, plantillas, pedidos] = await Promise.all([
    db.from('tenants').select('*', { count: 'exact', head: true }),
    db.from('sites').select('*', { count: 'exact', head: true }),
    db.from('template_versions').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    db.from('orders').select('*', { count: 'exact', head: true }),
  ]);
  const datos = [
    ['Clientes', clientes.count ?? 0, '/clientes'],
    ['Sitios', sitios.count ?? 0, '/sitios'],
    ['Versiones publicadas', plantillas.count ?? 0, '/plantillas'],
    ['Pedidos', pedidos.count ?? 0, '/sitios'],
  ] as const;

  return <Shell operador={operador} titulo="Operación">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {datos.map(([nombre, valor, href]) => <Link key={nombre} href={href} className="tarjeta p-5 hover:border-brand-500">
        <p className="text-sm text-ink-500">{nombre}</p><p className="mt-2 text-3xl font-semibold">{valor}</p>
      </Link>)}
    </div>
    <div className="tarjeta mt-8 p-6">
      <h2 className="font-medium">Flujo operativo</h2>
      <p className="mt-2 text-sm text-ink-600">Crea el cliente, invita al propietario, instala una plantilla en un sitio y conecta su dominio. Toda mutación queda auditada.</p>
    </div>
  </Shell>;
}

