import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { fichaProducto, productosDestacados } from '@/lib/datos';
import Link from 'next/link';
import { ListaOfertas, Stock, ofertaMasBarata, precio } from '@/components/ofertas';
import { leido } from '@/lib/fechas';
import { GraficoHistorial } from '@/components/grafico-historial';

// Con Cache Components hay que prerenderizar al menos un producto; el resto se genera
// en la primera visita y queda en caché (ISR).
export async function generateStaticParams() {
  const destacados = await productosDestacados(20);
  return destacados.length ? destacados.map(p => ({ id: p.id })) : [{ id: '00000000-0000-0000-0000-000000000000' }];
}

export async function generateMetadata({ params }: PageProps<'/p/[id]'>): Promise<Metadata> {
  const ficha = await fichaProducto((await params).id);
  if (!ficha) return { title: 'Producto no encontrado' };
  const p = ficha.producto;
  return {
    title: p.titulo,
    description: `${p.titulo}: desde ${precio(p.desde)} en ${p.numTiendas} tienda(s) de Ecuador.`,
  };
}

async function Ficha({ params }: { params: PageProps<'/p/[id]'>['params'] }) {
  const ficha = await fichaProducto((await params).id);
  if (!ficha || ficha.producto.ofertas.length === 0) notFound();
  const { producto: p, historial, generadaEn } = ficha;
  const varias = p.numTiendas > 1;
  const barata = ofertaMasBarata(p.ofertas);
  const hayStock = p.ofertas.some(o => o.disponible);
  const rebaja = barata && barata.precioLista !== null && barata.precioLista > barata.precio ? barata.precioLista : null;
  return (
    <article className="grid items-start gap-6 lg:grid-cols-[1fr_21rem]">
      <section className="grid gap-6 rounded-2xl bg-superficie p-5 sm:grid-cols-[13rem_1fr] sm:p-6 lg:col-start-1">
        <div className="aspect-square rounded-lg bg-white p-2">
          {p.imagen && <img src={p.imagen} alt={p.titulo} referrerPolicy="no-referrer" className="size-full object-contain" />}
        </div>
        <div className="flex flex-col gap-2">
          {p.marca && <Link href={`/buscar?q=${encodeURIComponent(p.marca)}`} className="w-fit text-sm font-semibold text-enlace hover:underline">{p.marca}</Link>}
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{p.titulo}</h1>
          <ul className="mt-2 flex flex-wrap gap-2 text-sm font-semibold">
            <li className="rounded-full bg-seccion px-3 py-1">{varias ? `En ${p.numTiendas} tiendas` : 'En 1 tienda'}</li>
            <li className="rounded-full bg-seccion px-3 py-1">{hayStock ? 'Con stock' : 'Sin stock'}</li>
          </ul>
        </div>
      </section>

      <div className="lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:self-stretch">
        <aside aria-label="Mejor precio" className="rounded-2xl bg-superficie p-5 sm:p-6 lg:sticky lg:top-40">
          <p className="w-fit rounded-full bg-cian px-2.5 py-0.5 text-sm font-semibold text-en-cian">{varias ? 'Precio más bajo' : 'Precio'}</p>
          <p className="mt-1 text-5xl font-extrabold tabular-nums">{precio(p.desde)}</p>
          {rebaja !== null && <p className="mt-1 text-sm text-suave">La tienda lo lista en <s className="tabular-nums">{precio(rebaja)}</s></p>}
          {barata && (
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-suave">Tienda</dt><dd className="font-semibold">{barata.tienda}</dd>
              <dt className="text-suave">Leído</dt><dd>{leido(barata.vistoUltimaVez, generadaEn)}</dd>
              <dt className="text-suave">Stock</dt><dd><Stock disponible={barata.disponible} /></dd>
            </dl>
          )}
          {barata && (
            <a href={barata.ir} target="_blank" rel="noopener nofollow" className="mt-5 flex min-h-12 items-center justify-center rounded-lg bg-accion px-4 font-bold text-en-accion transition-colors hover:bg-accion-fuerte">
              Ver oferta en {barata.tienda}<span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
          )}
        </aside>
      </div>

      <section id="ofertas" className="rounded-2xl bg-superficie p-5 sm:p-6 lg:col-start-1">
        <h2 className="mb-4 text-xl font-bold">{varias ? `Ofertas en ${p.numTiendas} tiendas` : 'Oferta'}</h2>
        <ListaOfertas ofertas={p.ofertas} comparar={varias} ahora={generadaEn} />
      </section>

      <section className="rounded-2xl bg-superficie p-5 sm:p-6 lg:col-start-1">
        <GraficoHistorial historial={historial} ofertas={p.ofertas} ahora={generadaEn} desde={p.desde} />
      </section>
    </article>
  );
}

function EsqueletoFicha() {
  return (
    <div role="status" aria-label="Cargando ofertas" className="grid gap-5 sm:grid-cols-[240px_1fr] sm:gap-8">
      <div className="esqueleto aspect-[4/3] sm:aspect-square" />
      <div className="flex flex-col gap-3">
        <div className="esqueleto h-5 w-24" />
        <div className="esqueleto h-9 w-full max-w-xl" />
        <div className="esqueleto h-14 w-64 max-w-full" />
        <div className="esqueleto h-5 w-72 max-w-full" />
      </div>
    </div>
  );
}

export default function PaginaProducto(props: PageProps<'/p/[id]'>) {
  return (
    <Suspense fallback={<EsqueletoFicha />}>
      <Ficha params={props.params} />
    </Suspense>
  );
}
