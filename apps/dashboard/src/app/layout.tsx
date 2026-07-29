import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nitro Web',
  description: 'Panel de administración de landings',
  // El dashboard es privado. También va por cabecera en next.config.ts.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
