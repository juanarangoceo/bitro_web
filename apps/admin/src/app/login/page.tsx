import { redirect } from 'next/navigation';
import { supabaseSesion } from '@/lib/supabase';

export default async function Login({ searchParams }: {
  searchParams: Promise<{ error?: string; enviado?: string; recuperacion?: string }>;
}) {
  const params = await searchParams;

  async function entrar(formData: FormData) {
    'use server';
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const password = String(formData.get('password') ?? '');
    const supabase = await supabaseSesion();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) redirect('/login?error=credenciales');
    redirect('/');
  }

  async function enlace(formData: FormData) {
    'use server';
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const supabase = await supabaseSesion();
    const origen = process.env.NITRO_WEB_ADMIN_URL;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: origen ? { emailRedirectTo: `${origen}/auth/confirm` } : undefined,
    });
    if (error) redirect('/login?error=enlace');
    redirect('/login?enviado=1');
  }

  async function recuperar(formData: FormData) {
    'use server';
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const supabase = await supabaseSesion();
    const origen = process.env.NITRO_WEB_ADMIN_URL;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: origen ? `${origen}/auth/recovery` : undefined,
    });
    if (error?.status === 429) redirect('/login?error=limite');
    if (error) redirect('/login?error=recuperacion');
    redirect('/login?recuperacion=1');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center px-4">
      <div className="tarjeta w-full space-y-5 p-6">
        <div><h1 className="text-xl font-semibold">Admin Nitro Web</h1>
          <p className="mt-1 text-sm text-ink-500">Acceso exclusivo para operadores autorizados.</p></div>
        {params.error === 'limite' && <p className="rounded bg-red-50 p-3 text-sm text-red-800">Se alcanzó temporalmente el límite de correos. Espera antes de solicitar otro.</p>}
        {params.error && params.error !== 'limite' && <p className="rounded bg-red-50 p-3 text-sm text-red-800">No fue posible completar la solicitud.</p>}
        {params.enviado && <p className="rounded bg-green-50 p-3 text-sm text-green-800">Revisa tu correo.</p>}
        {params.recuperacion && <p className="rounded bg-green-50 p-3 text-sm text-green-800">Si la cuenta existe, recibirás instrucciones para crear una contraseña.</p>}
        <form action={entrar} className="space-y-4">
          <div><label className="etiqueta" htmlFor="email">Correo</label><input className="campo mt-1" id="email" name="email" type="email" required /></div>
          <div><label className="etiqueta" htmlFor="password">Contraseña</label><input className="campo mt-1" id="password" name="password" type="password" required /></div>
          <button className="boton-primario w-full">Entrar</button>
        </form>
        <form action={enlace}>
          <input name="email" type="email" required className="campo" placeholder="correo para enlace mágico" />
          <button className="boton-secundario mt-2 w-full">Enviar enlace mágico</button>
        </form>
        <form action={recuperar}>
          <input name="email" type="email" required className="campo" placeholder="correo para recuperar contraseña" />
          <button className="mt-2 w-full text-sm underline">Crear o restablecer contraseña</button>
        </form>
      </div>
    </main>
  );
}
