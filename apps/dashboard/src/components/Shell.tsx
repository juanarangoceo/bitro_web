import Link from 'next/link';
import type { Sesion } from '@/lib/session';

/** Marco común de las pantallas autenticadas. */
export function Shell({
  sesion,
  children,
  titulo,
  volverA,
  acciones,
}: {
  sesion: Sesion;
  children: React.ReactNode;
  titulo: string;
  volverA?: { href: string; texto: string };
  acciones?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Nitro Web
          </Link>
          <div className="flex items-center gap-3 text-xs text-ink-500">
            <span>
              {sesion.tenantNombre} · {sesion.email}
            </span>
            <form action="/auth/signout" method="post">
              <button type="submit" className="text-ink-600 underline hover:text-ink-900">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {volverA && (
          <Link href={volverA.href} className="text-sm text-ink-500 hover:text-ink-800">
            ← {volverA.texto}
          </Link>
        )}

        <div className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
          {acciones}
        </div>

        {children}
      </main>
    </div>
  );
}

/** Aviso de que el rol actual no permite escribir (§3.2). */
export function AvisoSoloLectura() {
  return (
    <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
      Tu rol es de solo lectura: puedes ver todo, pero no guardar cambios.
    </p>
  );
}
