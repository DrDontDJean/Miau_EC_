import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { fichaProducto, productosDestacados } from '@/lib/datos';
import { leido } from '@/lib/fechas';
import { ListaOfertas, Sello, ofertaMasBarata, precio } from '@/components/ofertas';
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
  return (
    <article className="flex flex-col gap-10">
      <header className="grid gap-5 sm:grid-cols-[240px_1fr] sm:gap-8">
        <div className="aspect-[4/3] rounded-xl border border-borde bg-white p-4 sm:aspect-square">
          {p.imagen && <img src={p.imagen} alt={p.titulo} referrerPolicy="no-referrer" className="size-full object-contain" />}
        </div>
        <div>
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">{p.titulo}</h1>
          <div className="mt-4">
            <Sello valor={p.desde} desde={varias} leidoEn={barata ? leido(barata.vistoUltimaVez, generadaEn) : null} grande />
          </div>
          <p className="mt-3 max-w-[60ch]">
            {!hayStock
              ? 'Ahora mismo ninguna tienda lo tiene en stock.'
              : varias
                ? <>En {p.numTiendas} tiendas. El más barato está en <strong>{barata!.tienda}</strong>.</>
                : <>Solo lo encontramos en <strong>{barata!.tienda}</strong>.</>}
            {' '}<span className="text-suave">El precio puede haber cambiado desde que lo leímos.</span>
          </p>
        </div>
      </header>

      <section>
        <h2 className="mb-3 text-xl font-bold">{varias ? 'Ofertas por tienda' : 'Oferta'}</h2>
        <ListaOfertas ofertas={p.ofertas} comparar={varias} ahora={generadaEn} />
      </section>

      <GraficoHistorial historial={historial} ofertas={p.ofertas} ahora={generadaEn} desde={p.desde} />
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
