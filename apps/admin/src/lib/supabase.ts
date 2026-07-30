import { createServerClient } from '@supabase/ssr';
import type { Database } from '@nitro-web/db';
import { cookies } from 'next/headers';

function env(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta ${nombre}. Ver docs/ENTORNO.md.`);
  return valor;
}

export async function supabaseSesion() {
  const almacen = await cookies();
  return createServerClient<Database>(
    env('NEXT_PUBLIC_SUPABASE_URL'),
    env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    {
      cookies: {
        getAll: () => almacen.getAll(),
        setAll: (nuevas) => {
          try {
            for (const cookie of nuevas) almacen.set(cookie.name, cookie.value, cookie.options);
          } catch {
            // `proxy.ts` ya refresca la sesión cuando el Server Component no
            // puede escribir cookies.
          }
        },
      },
    },
  );
}

