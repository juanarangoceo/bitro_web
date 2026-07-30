import { redirect } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { auditar, requerirOperador } from '@/lib/admin';
import { supabaseSesion } from '@/lib/supabase';

type Props = {
  searchParams: Promise<{ error?: string; guardada?: string }>;
};

export default async function Contrasena({ searchParams }: Props) {
  const operador = await requerirOperador();
  const params = await searchParams;

  async function guardar(formData: FormData) {
    'use server';
    const operadorActual = await requerirOperador();
    const password = String(formData.get('password') ?? '');
    const confirmacion = String(formData.get('confirmacion') ?? '');

    if (password.length < 12) redirect('/contrasena?error=longitud');
    if (password !== confirmacion) redirect('/contrasena?error=confirmacion');

    const supabase = await supabaseSesion();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) redirect('/contrasena?error=actualizacion');

    await auditar({
      operador: operadorActual,
      accion: 'platform_admin.password_updated',
      entidad: 'auth_user',
      entidadId: operadorActual.userId,
    });
    redirect('/contrasena?guardada=1');
  }

  return (
    <Shell operador={operador} titulo="Contraseña">
      <div className="tarjeta max-w-lg p-6">
        <p className="mb-5 text-sm text-ink-600">
          Define una contraseña para entrar también sin enlace mágico.
        </p>
        {params.guardada && (
          <p className="mb-4 rounded bg-green-50 p-3 text-sm text-green-800">
            Contraseña actualizada correctamente.
          </p>
        )}
        {params.error === 'longitud' && (
          <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-800">
            Usa al menos 12 caracteres.
          </p>
        )}
        {params.error === 'confirmacion' && (
          <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-800">
            Las contraseñas no coinciden.
          </p>
        )}
        {params.error === 'actualizacion' && (
          <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-800">
            Supabase rechazó la contraseña. Prueba una distinta.
          </p>
        )}
        <form action={guardar} className="space-y-4">
          <div>
            <label className="etiqueta" htmlFor="password">Nueva contraseña</label>
            <input
              className="campo mt-1"
              id="password"
              name="password"
              type="password"
              minLength={12}
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <label className="etiqueta" htmlFor="confirmacion">Confirmar contraseña</label>
            <input
              className="campo mt-1"
              id="confirmacion"
              name="confirmacion"
              type="password"
              minLength={12}
              autoComplete="new-password"
              required
            />
          </div>
          <button className="boton-primario">Guardar contraseña</button>
        </form>
      </div>
    </Shell>
  );
}
