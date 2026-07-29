/**
 * Sesión y tenant activo.
 *
 * El piloto asume **un tenant por usuario**: es lo que hay hoy y multiplicar
 * pantallas por un selector que nadie usaría sería trabajo por adelantado. La
 * consulta ya devuelve una lista, así que añadir el selector después no obliga
 * a rehacer nada.
 */

import { redirect } from 'next/navigation';
import { supabaseServidor } from './supabase';

export type Sesion = {
  userId: string;
  email: string;
  tenantId: string;
  tenantNombre: string;
  rol: 'owner' | 'editor' | 'viewer';
};

/**
 * Devuelve la sesión o redirige a la pantalla de acceso.
 *
 * Usa `getUser()` y no `getSession()`: el segundo lee la cookie sin verificarla
 * contra el servidor de auth, así que un token manipulado pasaría.
 */
export async function requerirSesion(): Promise<Sesion> {
  const supabase = await supabaseServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: membresia } = await supabase
    .from('tenant_members')
    .select('tenant_id, role, tenants ( name )')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  // Un usuario autenticado sin membresía no es un error de sesión: es una
  // cuenta a medio provisionar. Se le dice, en lugar de mostrarle un dashboard
  // vacío que parece roto.
  if (!membresia) redirect('/sin-acceso');

  const tenant = Array.isArray(membresia.tenants) ? membresia.tenants[0] : membresia.tenants;

  return {
    userId: user.id,
    email: user.email ?? '',
    tenantId: membresia.tenant_id,
    tenantNombre: tenant?.name ?? 'Tu empresa',
    rol: membresia.role,
  };
}

/** ¿Puede modificar? `viewer` pertenece al tenant pero no escribe (§3.2). */
export function puedeEditar(sesion: Sesion): boolean {
  return sesion.rol === 'owner' || sesion.rol === 'editor';
}
