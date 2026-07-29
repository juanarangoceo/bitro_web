import { timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';

const entradaSchema = z.object({ siteId: z.string().uuid() }).strict();

export async function POST(request: Request) {
  const esperado = process.env.CACHE_REVALIDATION_SECRET;
  const recibido = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!esperado || !recibido || !iguales(recibido, esperado)) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  const entrada = entradaSchema.safeParse(await request.json().catch(() => null));
  if (!entrada.success) return Response.json({ error: 'Solicitud inválida' }, { status: 400 });

  revalidateTag(`nitro-site-${entrada.data.siteId}`, 'max');
  return Response.json({ ok: true });
}

function iguales(a: string, b: string): boolean {
  const primero = Buffer.from(a);
  const segundo = Buffer.from(b);
  return primero.length === segundo.length && timingSafeEqual(primero, segundo);
}
