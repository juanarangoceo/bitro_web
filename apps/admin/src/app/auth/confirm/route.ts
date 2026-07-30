import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabaseSesion } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const codigo = request.nextUrl.searchParams.get('code');
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const tipo = request.nextUrl.searchParams.get('type') as EmailOtpType | null;
  const destinoSolicitado = request.nextUrl.searchParams.get('destino');
  const destino = destinoSolicitado?.startsWith('/') && !destinoSolicitado.startsWith('//')
    ? destinoSolicitado
    : tipo === 'recovery' ? '/contrasena' : '/';
  const supabase = await supabaseSesion();

  if (codigo) {
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(new URL(destino, request.url));
  }

  // La plantilla de correo puede usar token_hash aunque signInWithOtp negocie
  // PKCE. Aceptar ambos formatos evita acoplar el callback a esa plantilla.
  if (tokenHash && tipo) {
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(destino, request.url));
  }

  return NextResponse.redirect(new URL('/login?error=enlace', request.url));
}
