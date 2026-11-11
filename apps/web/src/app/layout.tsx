import type { Metadata } from 'next';
import { Hanken_Grotesk } from 'next/font/google';
import Link from 'next/link';
import { Suspense } from 'react';
import { Buscador, FormularioBusqueda, ListaPestanas, Pestanas } from '@/components/buscador';
import { tiendasActivas } from '@/lib/datos';
import { diaCorto, horaCorta } from '@/lib/fechas';
import { RAPIDAS, rutaBusqueda } from '@/lib/rapidas';
import './globals.css';

const fuente = Hanken_Grotesk({ variable: '--fuente', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'DecideAqui · Compara precios entre tiendas de Ecuador', template: '%s · DecideAqui' },
  description: 'Compara precios entre tiendas online de Ecuador y ve directo a la tienda más conveniente.',
};

/** Frescura global: la lectura completa más reciente entre las tiendas incluidas. */
async function BarraFrescura() {
  const tiendas = await tiendasActivas();
  const ultima = tiendas.map(t => t.ultima_corrida_ok).filter((f): f is string => f !== null).sort().at(-1);
  return (
    <p className="truncate bg-cian px-4 py-1.5 text-center text-sm font-semibold text-en-cian">
      {ultima
        ? <><span className="hidden sm:inline">Precios leídos el </span><span className="sm:hidden">Leídos el </span>{diaCorto(ultima)}, {horaCorta(ultima)}</>
        : 'Precios leídos una vez al día'}
      <span className="font-normal"> · confirma <span className="hidden sm:inline">siempre </span>en la tienda</span>
    </p>
  );
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es-EC" className={`${fuente.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col font-sans">
        <BarraFrescura />
        <header className="top-0 z-10 border-b border-borde bg-superficie sm:sticky">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="flex h-11 items-center text-2xl font-extrabold tracking-tight whitespace-nowrap">
              Decide<span className="ml-0.5 rounded-md bg-cian px-1.5 text-en-cian">Aqui</span>
            </Link>
            <Suspense fallback={<FormularioBusqueda />}>
              <Buscador />
            </Suspense>
          </div>
          <Suspense fallback={<ListaPestanas />}>
            <Pestanas />
          </Suspense>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>

        <footer className="sobre-oscuro bg-pie text-en-pie">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[2fr_1fr_1fr]">
            <div>
              <p className="text-xl font-extrabold tracking-tight">
                Decide<span className="ml-0.5 rounded-md bg-cian px-1.5 text-en-cian">Aqui</span>
              </p>
              <p className="mt-3 max-w-[52ch] text-sm leading-relaxed">
                Leemos los catálogos públicos de cada tienda una vez al día. Los precios están en dólares y pueden cambiar:
                confirma siempre en la tienda. Al pulsar «Ver oferta» registramos la visita de forma anónima.
              </p>
            </div>
            <nav aria-label="Buscar por tipo de producto">
              <h2 className="font-semibold">Buscar</h2>
              <ul className="mt-2 text-sm">
                {RAPIDAS.map(r => (
                  <li key={r.q}><Link href={rutaBusqueda(r.q)} className="flex min-h-11 items-center underline-offset-4 hover:underline sm:min-h-8">{r.etiqueta}</Link></li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Sobre los datos">
              <h2 className="font-semibold">Los datos</h2>
              <ul className="mt-2 text-sm">
                <li><Link href="/tiendas" className="flex min-h-11 items-center underline-offset-4 hover:underline sm:min-h-8">Tiendas y última lectura</Link></li>
                <li><Link href="/#como-comparamos" className="flex min-h-11 items-center underline-offset-4 hover:underline sm:min-h-8">Cómo comparamos</Link></li>
              </ul>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
