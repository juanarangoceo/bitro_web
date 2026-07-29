import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { createSecretClient, resolveSiteByPreviewToken } from '@nitro-web/db';
import { renderTemplate } from '@/templates/registry';

/**
 * Preview de un borrador.
 *
 * Muestra `site_content_drafts`, no el snapshot: su razón de ser es ver los
 * cambios **antes** de que sean públicos (§4.5). El token de la URL es la
 * credencial; se rota desde el dashboard si se filtra.
 *
 * `noindex` se aplica por cabecera en `next.config.ts` y también aquí: si un
 * buscador indexara un borrador, competiría con la landing real del cliente.
 */

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PreviewPage(props: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<PreviewLoading />}>
      <PreviewContent {...props} />
    </Suspense>
  );
}

async function PreviewContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const resolution = await resolveSiteByPreviewToken(createSecretClient(), token);
  if (resolution.kind !== 'render') notFound();

  return (
    <>
      <PreviewBanner />
      {renderTemplate(resolution.site, { isPreview: true })}
    </>
  );
}

function PreviewLoading() {
  return <main className="grid min-h-screen place-items-center bg-coffee-50 text-coffee-600">Cargando vista previa…</main>;
}

/**
 * Aviso permanente de que esto no es la página pública.
 *
 * Sin él, un cliente puede confundir el preview con lo publicado y creer que ya
 * lanzó cuando en realidad su landing sigue en borrador.
 */
function PreviewBanner() {
  return (
    <div className="sticky top-0 z-50 bg-coffee-900 px-4 py-2 text-center text-sm font-medium text-white">
      Vista previa — estos cambios aún no son públicos
    </div>
  );
}
