import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLICAS = ['/login', '/auth/confirm', '/sin-acceso'];

export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return respuesta;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (nuevas) => {
        for (const cookie of nuevas) request.cookies.set(cookie.name, cookie.value);
        respuesta = NextResponse.next({ request });
        for (const cookie of nuevas) respuesta.cookies.set(cookie.name, cookie.value, cookie.options);
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const publica = PUBLICAS.some((ruta) => request.nextUrl.pathname.startsWith(ruta));

  if (!user && !publica) {
    const destino = request.nextUrl.clone();
    destino.pathname = '/login';
    destino.searchParams.set('destino', request.nextUrl.pathname);
    return NextResponse.redirect(destino);
  }
  if (user && request.nextUrl.pathname === '/login') {
    const destino = request.nextUrl.clone();
    destino.pathname = '/';
    destino.search = '';
    return NextResponse.redirect(destino);
  }
  return respuesta;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|avif)$).*)'],
};

