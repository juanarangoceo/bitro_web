type Verificacion = { type?: string; domain?: string; value?: string; reason?: string };
type DominioProyecto = { name: string; verified: boolean; verification?: Verificacion[] };
type ConfiguracionDominio = {
  misconfigured?: boolean;
  configuredBy?: string | null;
  recommendedIPv4?: { rank: number; value: string[] }[];
  recommendedCNAME?: { rank: number; value: string }[];
};

function configuracion() {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_RENDERER_PROJECT_ID;
  if (!token || !projectId) throw new Error('Faltan VERCEL_TOKEN o VERCEL_RENDERER_PROJECT_ID.');
  return { token, projectId, teamId: process.env.VERCEL_TEAM_ID };
}

async function vercel<T>(ruta: string, init?: RequestInit): Promise<T> {
  const { token, teamId } = configuracion();
  const url = new URL(`https://api.vercel.com${ruta}`);
  if (teamId) url.searchParams.set('teamId', teamId);
  const respuesta = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  });
  const body = await respuesta.json() as T & { error?: { code?: string; message?: string } };
  if (!respuesta.ok) throw new Error(body.error?.message ?? `Vercel respondió HTTP ${respuesta.status}.`);
  return body;
}

export async function agregarDominioAlRenderer(hostname: string) {
  const { projectId } = configuracion();
  let dominio: DominioProyecto;
  try {
    dominio = await vercel<DominioProyecto>(`/v10/projects/${projectId}/domains`, {
      method: 'POST',
      body: JSON.stringify({ name: hostname }),
    });
  } catch (error) {
    // Si ya estaba en el proyecto se consulta su estado; no se fuerza el
    // movimiento desde otro proyecto porque podría tumbar un sitio ajeno.
    dominio = await vercel<DominioProyecto>(`/v9/projects/${projectId}/domains/${encodeURIComponent(hostname)}`);
  }
  const config = await vercel<ConfiguracionDominio>(`/v6/domains/${encodeURIComponent(hostname)}/config`);
  return {
    verified: dominio.verified && !config.misconfigured,
    verification: dominio.verification ?? [],
    config,
  };
}

export async function verificarDominioDelRenderer(hostname: string) {
  const { projectId } = configuracion();
  const dominio = await vercel<DominioProyecto>(
    `/v9/projects/${projectId}/domains/${encodeURIComponent(hostname)}/verify`,
    { method: 'POST' },
  );
  const config = await vercel<ConfiguracionDominio>(`/v6/domains/${encodeURIComponent(hostname)}/config`);
  return {
    verified: dominio.verified && !config.misconfigured,
    verification: dominio.verification ?? [],
    config,
  };
}

export async function retirarDominioDelRenderer(hostname: string) {
  const { projectId } = configuracion();
  await vercel<{ uid?: string }>(
    `/v9/projects/${projectId}/domains/${encodeURIComponent(hostname)}`,
    { method: 'DELETE' },
  );
}
