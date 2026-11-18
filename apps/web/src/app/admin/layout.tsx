import type { Metadata } from 'next';

// Zona de administración: fuera de los buscadores.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LayoutAdmin({ children }: { children: React.ReactNode }) {
  return children;
}
