import { NextResponse, type NextRequest } from 'next/server';
import { supabaseSesion } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const codigo = request.nextUrl.searchParams.get('code');
  if (codigo) {
    const supabase = await supabaseSesion();
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.redirect(new URL('/login?error=enlace', request.url));
}

