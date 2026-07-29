import { redirect } from 'next/navigation';
import { supabaseServidor } from '@/lib/supabase';

/**
 * Pantalla de acceso.
 *
 * Dos vías, y ambas hacen falta hoy:
 *
 *   - **Contraseña**, para quien ya la tiene.
 *   - **Enlace por correo**, porque las cuentas del piloto se crearon por
 *     procedimiento (R3) y nacen sin contraseña. Sin esta vía, el owner del
 *     piloto no podría entrar a su propio panel.
 *
 * El envío del enlace depende del SMTP del proyecto de Supabase. Si no está
 * configurado, la vía que funciona es la contraseña.
 */

type Props = { searchParams: Promise<{ destino?: string; error?: string; enviado?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const destino = params.destino ?? '/';

  async function entrarConContrasena(formData: FormData) {
    'use server';

    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const volverA = String(formData.get('destino') ?? '/');

    const supabase = await supabaseServidor();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    // El mensaje no distingue "no existe" de "contraseña incorrecta": hacerlo
    // convertiría esta pantalla en un verificador de qué correos tienen cuenta.
    if (error) redirect(`/login?error=credenciales&destino=${encodeURIComponent(volverA)}`);

    redirect(volverA);
  }

  async function enviarEnlace(formData: FormData) {
    'use server';

    const email = String(formData.get('email') ?? '').trim();
    if (!email) redirect('/login?error=correo');

    const supabase = await supabaseServidor();
    const origen = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3001';

    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origen}/auth/confirm` },
    });

    // Se responde igual exista o no la cuenta, por el mismo motivo de arriba.
    redirect('/login?enviado=1');
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Nitro Web</h1>
          <p className="mt-1 text-sm text-ink-500">Entra para administrar tus landings</p>
        </div>

        {params.error === 'credenciales' && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            Correo o contraseña incorrectos.
          </p>
        )}
        {params.error === 'correo' && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            Escribe tu correo.
          </p>
        )}
        {params.enviado && (
          <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
            Si esa cuenta existe, te llegó un enlace de acceso.
          </p>
        )}

        <form action={entrarConContrasena} className="tarjeta space-y-4 p-6">
          <input type="hidden" name="destino" value={destino} />

          <div>
            <label className="etiqueta" htmlFor="email">
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="campo mt-1"
            />
          </div>

          <div>
            <label className="etiqueta" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="campo mt-1"
            />
          </div>

          <button type="submit" className="boton-primario w-full">
            Entrar
          </button>

          {/* Mismo formulario a propósito: así el enlace por correo reutiliza el
              campo de arriba en vez de pedir el correo dos veces. */}
          <p className="text-center text-xs text-ink-500">
            ¿Aún sin contraseña?{' '}
            <button
              type="submit"
              formAction={enviarEnlace}
              className="font-medium text-brand-700 underline"
            >
              Recibe un enlace de acceso
            </button>
          </p>
        </form>
      </div>
    </main>
  );
}
