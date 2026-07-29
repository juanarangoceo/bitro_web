/**
 * Clientes de Supabase para el dashboard.
 *
 * Todos usan la clave **publicable** y la sesión del usuario: RLS decide qué ve
 * y qué puede escribir. El dashboard no toca `SUPABASE_SECRET_KEY` salvo en las
 * dos operaciones que lo exigen (ver `admin.ts`), y esas están aisladas a
 * propósito para que un `grep` las encuentre.
 */

import { createBrowserClient, createServerClient } from '@supabase/ssr';
import type { Database } from '@nitro-web/db';
import { cookies } from 'next/headers';

function leerEnv(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}. Ver docs/ENTORNO.md.`);
  return valor;
}

/** Cliente de servidor, ligado a las cookies de la petición. */
export async function supabaseServidor() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    leerEnv('NEXT_PUBLIC_SUPABASE_URL'),
    leerEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesNuevas) => {
          try {
            for (const { name, value, options } of cookiesNuevas) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Un Server Component no puede escribir cookies. No es un error:
            // el middleware ya refrescó la sesión antes de llegar aquí.
          }
        },
      },
    },
  );
}

/** Cliente de navegador, para los componentes que necesitan interactividad. */
export function supabaseNavegador() {
  return createBrowserClient<Database>(
    leerEnv('NEXT_PUBLIC_SUPABASE_URL'),
    leerEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  );
}
