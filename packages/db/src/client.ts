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

import type { Database } from './types.generated';

/**
 * Cliente tipado contra el esquema real. `types.generated.ts` se regenera desde
 * Supabase al aplicar migraciones (RUNBOOKS R2), así que una columna renombrada
 * rompe la compilación en vez de devolver `undefined` en producción.
 */
export type NitroWebClient = SupabaseClient<Database>;

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
export function createPublishableClient(): NitroWebClient {
  return createClient<Database>(
    readEnv('NEXT_PUBLIC_SUPABASE_URL'),
    readEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    { auth: { persistSession: false } },
  );
}

/**
 * Cliente que actúa **en nombre de un usuario**, con RLS aplicada.
 *
 * Es el que exigen las operaciones cuya autorización no debe saltarse: publicar
 * un sitio, por ejemplo. Con el cliente secreto la operación siempre
 * funcionaría, y eso es justo lo que no se quiere — que RLS verifique que el
 * usuario pertenece al tenant y tiene rol de escritura ES la comprobación.
 *
 * La clave sigue siendo la publicable: lo que identifica al usuario es el JWT
 * de su sesión, no una credencial con más poder.
 */
export function createUserClient(accessToken: string): NitroWebClient {
  return createClient<Database>(
    readEnv('NEXT_PUBLIC_SUPABASE_URL'),
    readEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    },
  );
}

/**
 * Cliente que omite RLS. **Solo servidor.**
 *
 * Lanza si se invoca en el navegador. La comprobación es barata y evita el peor
 * error posible del sistema: un import mal puesto que arrastre la clave secreta
 * al bundle del cliente.
 */
export function createSecretClient(): NitroWebClient {
  if (typeof window !== 'undefined') {
    throw new Error(
      'createSecretClient() se invocó en el navegador. La clave secreta jamás debe salir del servidor.',
    );
  }

  return createClient<Database>(
    readEnv('NEXT_PUBLIC_SUPABASE_URL'),
    readEnv('SUPABASE_SECRET_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
