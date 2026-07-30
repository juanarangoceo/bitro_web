/**
 * Concede acceso al admin operativo a un usuario existente de Supabase Auth.
 *
 * Es deliberadamente un comando interno: el propio admin no puede fabricar
 * nuevos administradores. Así, comprometer una sesión operativa no permite
 * persistir acceso creando otra cuenta privilegiada.
 *
 * Uso: pnpm db:grant-admin -- --email=operador@nitro.com --name="Juan"
 */
import { parseArgs } from 'node:util';
import { createSecretClient } from '@nitro-web/db';

try { process.loadEnvFile('.env.local'); } catch {
  // En CI y entornos operativos las variables pueden llegar por el proceso.
}

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
  },
});

const email = values.email?.trim().toLowerCase();
if (!email) throw new Error('Falta --email=<correo>.');

const supabase = createSecretClient();
let pagina = 1;
let userId: string | undefined;

while (!userId) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: pagina, perPage: 100 });
  if (error) throw error;
  userId = data.users.find((user) => user.email?.toLowerCase() === email)?.id;
  if (data.users.length < 100) break;
  pagina += 1;
}

if (!userId) throw new Error(`No existe un usuario Auth con el correo ${email}.`);

const { error } = await supabase.from('platform_admins').upsert({
  user_id: userId,
  display_name: values.name?.trim() || email,
  is_active: true,
});
if (error) throw error;

console.log(`✓ ${email} quedó habilitado como administrador de plataforma.`);
