import type { Metadata } from 'next';
import { Archivo, Source_Sans_3 } from 'next/font/google';
import Link from 'next/link';
import { Suspense } from 'react';
import { Buscador, FormularioBusqueda } from '@/components/buscador';
import './globals.css';

const titulos = Archivo({ variable: '--fuente-titulos', subsets: ['latin'], weight: ['600', '800'] });
const texto = Source_Sans_3({ variable: '--fuente-texto', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'DecideAqui', template: '%s · DecideAqui' },
  description: 'Compara precios entre tiendas online de Ecuador y ve directo a la tienda más conveniente.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es-EC" className={`${titulos.variable} ${texto.variable} antialiased`}>
      <body className="min-h-dvh flex flex-col font-sans">
        <header className="sticky top-0 z-10 bg-cabecera text-en-cabecera shadow-md">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-display text-xl font-extrabold whitespace-nowrap">
              <span className="grid size-8 place-items-center rounded-lg bg-amarillo text-en-amarillo">$</span>
              <span>Decide<span className="text-amarillo">Aqui</span></span>
            </Link>
            <Suspense fallback={<FormularioBusqueda />}>
              <Buscador />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
        <footer className="mx-auto w-full max-w-5xl border-t border-borde px-4 py-6 text-sm text-suave">
          <p>
            Precios en dólares tomados de los catálogos públicos de cada tienda una vez al día. Pueden cambiar:
            confirma siempre en la tienda. Al pulsar &quot;Ver oferta&quot; registramos la visita de forma anónima.
          </p>
          <p className="mt-2"><Link href="/tiendas" className="underline">Tiendas y última actualización</Link></p>
        </footer>
      </body>
    </html>
  );
}
