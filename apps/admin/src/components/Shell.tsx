import Link from 'next/link';
import type { Operador } from '@/lib/admin';

export function Shell({ operador, titulo, children }: {
  operador: Operador;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-200 bg-ink-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/" className="font-semibold">Nitro Web Admin</Link>
            <Link href="/clientes" className="text-ink-200 hover:text-white">Clientes</Link>
            <Link href="/plantillas" className="text-ink-200 hover:text-white">Plantillas</Link>
            <Link href="/sitios" className="text-ink-200 hover:text-white">Sitios</Link>
          </nav>
          <div className="flex items-center gap-3 text-xs text-ink-200">
            <span>{operador.nombre}</span>
            <form action="/auth/signout" method="post"><button className="underline">Salir</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">{titulo}</h1>
        {children}
      </main>
    </div>
  );
}

