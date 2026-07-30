/** Invalida solo el sitio afectado después de publicar o restaurar. */
export async function invalidarRenderer(siteId: string): Promise<void> {
  const base = process.env.NEXT_PUBLIC_RENDERER_URL;
  const secret = process.env.CACHE_REVALIDATION_SECRET;
  if (!base || !secret) throw new Error('Faltan NEXT_PUBLIC_RENDERER_URL o CACHE_REVALIDATION_SECRET.');
  const respuesta = await fetch(`${base}/api/revalidate`, {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
    body: JSON.stringify({ siteId }),
    cache: 'no-store',
  });
  if (!respuesta.ok) throw new Error(`El renderer rechazó la invalidación: HTTP ${respuesta.status}.`);
}
