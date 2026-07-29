/**
 * Puente entre la petición HTTP y la resolución de landing.
 *
 * Aísla dos cosas incómodas: de dónde sale el hostname real detrás de un proxy,
 * y cómo se trabaja en local, donde no hay dominios de clientes.
 */

import { headers } from 'next/headers';
import { createSecretClient, resolveSiteByHostname, type SiteResolution } from '@nitro-web/db';

/**
 * Hostname de la petición actual.
 *
 * Detrás del proxy de Vercel, `host` ya trae el dominio que escribió el
 * visitante. `x-forwarded-host` se consulta primero porque algunos proxies
 * intermedios reescriben `host`.
 */
export async function getRequestHostname(): Promise<string | null> {
  const headerList = await headers();
  return headerList.get('x-forwarded-host') ?? headerList.get('host');
}

/**
 * Resuelve la landing que corresponde a esta petición.
 *
 * En desarrollo no hay dominios reales apuntando a la máquina local, así que
 * `NITRO_WEB_DEV_SITE_ID` permite fijar qué sitio se sirve en `localhost`. La
 * vía está cerrada en producción: si estuviera abierta, bastaría una cabecera
 * `Host` falsificada para pedir la landing de cualquier cliente.
 */
export async function resolveCurrentSite(): Promise<SiteResolution> {
  const hostname = await getRequestHostname();
  const supabase = createSecretClient();

  const isLocal =
    process.env.NODE_ENV !== 'production' &&
    (!hostname || hostname.startsWith('localhost') || hostname.startsWith('127.0.0.1'));

  if (isLocal) {
    const devSiteId = process.env.NITRO_WEB_DEV_SITE_ID;
    if (!devSiteId) return { kind: 'not_found' };
    return resolveDevSite(supabase, devSiteId);
  }

  if (!hostname) return { kind: 'not_found' };
  return resolveSiteByHostname(supabase, hostname);
}

/**
 * Atajo de desarrollo: sirve un sitio por su id, sin pasar por `domains`.
 *
 * Reutiliza la resolución real buscando el dominio canónico del sitio, de modo
 * que lo que se ve en local es lo mismo que se verá en producción.
 */
async function resolveDevSite(
  supabase: ReturnType<typeof createSecretClient>,
  siteId: string,
): Promise<SiteResolution> {
  const { data } = await supabase
    .from('domains')
    .select('hostname')
    .eq('site_id', siteId)
    .eq('status', 'active')
    .eq('is_canonical', true)
    .maybeSingle();

  if (!data?.hostname) return { kind: 'not_found' };
  return resolveSiteByHostname(supabase, data.hostname);
}
