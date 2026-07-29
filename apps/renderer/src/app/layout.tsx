import type { ReactNode } from 'react';
import './globals.css';

/**
 * Layout raíz del renderer.
 *
 * Deliberadamente vacío de marca: esta aplicación sirve dominios de clientes.
 * Cualquier logotipo, enlace o pie de Nitro Web aquí aparecería en las landings
 * de todos los tenants.
 *
 * El `<title>` y los metadatos los define cada landing desde su sección `seo`.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
