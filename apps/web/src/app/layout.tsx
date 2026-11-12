import type { Metadata } from 'next';
import { Hanken_Grotesk } from 'next/font/google';
import Link from 'next/link';
import { Suspense } from 'react';
import { Buscador, FormularioBusqueda, Pestanas } from '@/components/buscador';
import { tiendasActivas } from '@/lib/datos';
import { diaCorto, horaCorta } from '@/lib/fechas';
import { RAPIDAS, rutaBusqueda } from '@/lib/rapidas';
import './globals.css';

const fuente = Hanken_Grotesk({ variable: '--fuente', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'DecideAqui · Comparador de precios de tiendas de Ecuador', template: '%s · DecideAqui' },
  description: 'Compare precios entre tiendas online de Ecuador y vaya directo a la tienda más conveniente.',
};

/** Franja de hechos verificables (sin envíos ni reseñas: solo lo que DecideAqui puede comprobar). */
async function FranjaHechos({ claseFondo }: { claseFondo: string }) {
  const tiendas = await tiendasActivas();
  const ultima = tiendas.map(t => t.ultima_corrida_ok).filter((f): f is string => f !== null).sort().at(-1);
  const hechos = [
    { texto: ultima ? `Precios leídos el ${diaCorto(ultima)}, ${horaCorta(ultima)}` : 'Precios leídos una vez al día', d: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0' },
    { texto: 'Mismo producto por EAN o modelo', d: 'M4 6v12M8 6v12M11 6v12M15 6v12M18 6v12M20 6v12' },
    { texto: 'Precio que publica la tienda', d: 'M3 9l2-5h14l2 5M4 9v11h16V9M3 9h18' },
    { texto: 'Sin patrocinios', d: 'M12 3l7 3v6c0 4-3 7-7 9c-4-2-7-5-7-9V6z' },
  ];
  return (
    <div className={claseFondo}>
      <ul className="sin-barra mx-auto flex max-w-6xl gap-x-8 overflow-x-auto px-4 py-2 text-xs font-semibold uppercase tracking-wide sm:justify-center">
        {hechos.map(h => (
          <li key={h.texto} className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-none stroke-current" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d={h.d} /></svg>
            {h.texto}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es-EC" className={`${fuente.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col font-sans">
        <header className="en-cabecera top-0 z-10 bg-cabecera text-en-cabecera sm:sticky">
          <FranjaHechos claseFondo="bg-cabecera-fuerte text-en-cabecera-suave" />
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3">
            <Link href="/" className="flex h-11 items-center text-2xl font-extrabold tracking-tight whitespace-nowrap">
              Decide<span className="ml-0.5 rounded-md bg-cian px-1.5 text-en-cian">Aqui</span>
            </Link>
            <div className="flex min-w-0 flex-1 basis-64 justify-center">
              <div className="flex w-full max-w-2xl">
                <Suspense fallback={<FormularioBusqueda />}><Buscador /></Suspense>
              </div>
            </div>
            <Link href="/tiendas" className="hidden min-h-11 items-center gap-2 font-semibold hover:underline md:flex">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-none stroke-current" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l2-5h14l2 5M4 9v11h16V9M3 9h18M9 20v-6h6v6" /></svg>
              Tiendas
            </Link>
          </div>
          <Pestanas />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>

        <footer className="en-cabecera bg-pie text-en-pie">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[2fr_1fr_1fr]">
            <div>
              <p className="text-xl font-extrabold tracking-tight">
                Decide<span className="ml-0.5 rounded-md bg-cian px-1.5 text-en-cian">Aqui</span>
              </p>
              <p className="mt-3 max-w-[52ch] text-sm leading-relaxed">
                Los precios se toman una vez al día de los catálogos públicos de cada tienda y pueden cambiar;
                confírmelos en la tienda antes de comprar. Al pulsar «Ver oferta» se registra la visita de forma anónima.
              </p>
              <p className="mt-2 max-w-[52ch] text-sm leading-relaxed">
                Solo se agrupan ofertas del mismo producto (por código de barras o modelo) y ninguna tienda paga por aparecer primero.
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
                <li><Link href="/tiendas" className="flex min-h-11 items-center underline-offset-4 hover:underline sm:min-h-8">Tiendas y última lectura</Link></li>              </ul>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
