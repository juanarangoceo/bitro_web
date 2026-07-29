/**
 * Canje del enlace de acceso enviado por correo.
 *
 * Supabase manda al usuario aquí con un `token_hash`. Se verifica y se
 * establece la sesión en cookies; a partir de ahí el middleware la mantiene.
 */

import { redirect } from 'next/navigation';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabaseServidor } from '@/lib/supabase';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const tipo = url.searchParams.get('type') as EmailOtpType | null;
  const destino = url.searchParams.get('destino') ?? '/';

  if (!tokenHash || !tipo) redirect('/login?error=enlace');

  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });

  // Un enlace caducado o ya usado no se distingue de uno inválido: en ambos
  // casos la acción es la misma, pedir otro.
  if (error) redirect('/login?error=enlace');

  redirect(destino);
}
