/** Invalida únicamente el sitio publicado; un fallo no revierte el snapshot. */
export async function invalidarRenderer(siteId: string): Promise<void> {
  const base = process.env.NEXT_PUBLIC_RENDERER_URL;
  const secret = process.env.CACHE_REVALIDATION_SECRET;
  if (!base || !secret) {
    console.error('No se invalidó el renderer: falta su URL o CACHE_REVALIDATION_SECRET.');
    return;
  }

  try {
    const respuesta = await fetch(`${base}/api/revalidate`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
      body: JSON.stringify({ siteId }),
      cache: 'no-store',
    });
    if (!respuesta.ok) console.error(`No se invalidó el renderer: HTTP ${respuesta.status}.`);
  } catch (error) {
    console.error('No se invalidó el renderer.', error);
  }
}
