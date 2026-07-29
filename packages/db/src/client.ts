/**
 * Clientes de Supabase.
 *
 * Hay dos, y la diferencia es de seguridad, no de conveniencia:
 *
 *   - **Publishable** — respeta RLS. Es el que ve el navegador. Todo lo que un
 *     usuario haga en su nombre queda acotado a sus tenants.
 *   - **Secret** — OMITE RLS por completo. Solo servidor, solo para operaciones
 *     que deben saltárselo de forma deliberada: resolver un dominio para un
 *     visitante anónimo, crear un tenant, escribir auditoría.
 *
 * Todo uso de la clave secreta pasa por aquí para que sea auditable con un
 * `grep`, en vez de estar disperso en componentes.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Ver docs/ENTORNO.md.`,
    );
  }
  return value;
}

/**
 * Cliente que respeta RLS.
 *
 * Sin sesión de usuario actúa como `anon`, que no tiene acceso a ninguna tabla
 * (ver `0008_grants.sql`): solo puede invocar las funciones públicas.
 */
export function createPublishableClient(): SupabaseClient {
  return createClient(
    readEnv('NEXT_PUBLIC_SUPABASE_URL'),
    readEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    { auth: { persistSession: false } },
  );
}

/**
 * Cliente que omite RLS. **Solo servidor.**
 *
 * Lanza si se invoca en el navegador. La comprobación es barata y evita el peor
 * error posible del sistema: un import mal puesto que arrastre la clave secreta
 * al bundle del cliente.
 */
export function createSecretClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error(
      'createSecretClient() se invocó en el navegador. La clave secreta jamás debe salir del servidor.',
    );
  }

  return createClient(readEnv('NEXT_PUBLIC_SUPABASE_URL'), readEnv('SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
