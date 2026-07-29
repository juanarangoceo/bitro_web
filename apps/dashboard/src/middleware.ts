/**
 * Refresco de sesión y puerta de acceso.
 *
 * Los tokens de Supabase caducan; si nadie los refresca, el usuario se
 * encuentra deslogueado a mitad de una edición. El middleware lo hace en cada
 * navegación y reescribe las cookies en la respuesta.
 *
 * La comprobación de acceso se repite en cada página con `requerirSesion()`.
 * No es redundancia inútil: el middleware es una conveniencia de redirección,
 * y confiar solo en él dejaría cualquier ruta nueva desprotegida por olvido.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const RUTAS_PUBLICAS = ['/login', '/auth', '/sin-acceso'];

export async function middleware(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return respuesta;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesNuevas) => {
        for (const { name, value } of cookiesNuevas) request.cookies.set(name, value);
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of cookiesNuevas) {
          respuesta.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ruta = request.nextUrl.pathname;
  const esPublica = RUTAS_PUBLICAS.some((p) => ruta.startsWith(p));

  if (!user && !esPublica) {
    const destino = request.nextUrl.clone();
    destino.pathname = '/login';
    // Volver a donde iba después de entrar, en vez de soltarlo en el inicio.
    destino.searchParams.set('destino', ruta);
    return NextResponse.redirect(destino);
  }

  if (user && ruta === '/login') {
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
