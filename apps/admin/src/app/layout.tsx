import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nitro Web Admin',
  description: 'Operación interna de Nitro Web',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body className="min-h-screen">{children}</body></html>;
}

