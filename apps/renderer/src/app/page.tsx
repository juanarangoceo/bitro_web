import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { recordPageView, createSecretClient } from '@nitro-web/db';
import { resolveCurrentSite } from '@/lib/resolve-request';
import { renderTemplate } from '@/templates/registry';
import { PausedNotice } from '@/components/PausedNotice';

/**
 * Página pública de una landing.
 *
 * Toda la aplicación vive en esta ruta: el hostname decide qué se muestra, no el
 * path (§6.2). Una landing de oferta única no tiene navegación interna.
 */

/**
 * Los metadatos salen del snapshot publicado, igual que el contenido. Next
 * ejecuta esta función y el componente por separado, así que la resolución
 * ocurre dos veces por petición; ambas van contra la misma consulta indexada y
 * la caché de la petición las colapsa.
 */
export async function generateMetadata(): Promise<Metadata> {
  const resolution = await resolveCurrentSite();
  if (resolution.kind !== 'render') return { title: 'Página no encontrada' };

  const seo = (resolution.site.content.seo ?? {}) as Record<string, unknown>;
  const title = typeof seo.title === 'string' ? seo.title : resolution.site.siteName;
  const description = typeof seo.description === 'string' ? seo.description : undefined;

  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    // Una landing de campaña sí debe indexarse; el que no debe es el preview.
    robots: { index: true, follow: true },
  };
}

export default async function LandingPage() {
  const resolution = await resolveCurrentSite();

  switch (resolution.kind) {
    case 'not_found':
      // 404 y no un mensaje distinto: revelar que un subdominio está tomado
      // ayudaría a mapear qué clientes tiene la plataforma.
      notFound();

    case 'redirect':
      // El dominio alterno redirige al canónico para no dividir el SEO (§12.3).
      redirect(`https://${resolution.toHostname}`);

    case 'paused':
      return <PausedNotice />;

    case 'render': {
      const { site } = resolution;

      // Registro de la vista sin bloquear el render: no se espera la promesa.
      // Si la métrica falla, la landing igual se sirve (§6.1).
      void recordPageView(createSecretClient(), site.siteId);

      return renderTemplate(site);
    }
  }
}
