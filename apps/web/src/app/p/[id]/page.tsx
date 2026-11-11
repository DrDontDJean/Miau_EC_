import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { fichaProducto, productosDestacados } from '@/lib/datos';
import { ListaOfertas, precio } from '@/components/ofertas';
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
  return (
    <article className="flex flex-col gap-6">
      <header className="grid gap-4 sm:grid-cols-[180px_1fr]">
        <div className="h-44 overflow-hidden rounded-xl border border-borde bg-white p-3">
          {p.imagen && <img src={p.imagen} alt={p.titulo} referrerPolicy="no-referrer" className="size-full object-contain" />}
        </div>
        <div>
          {p.marca && <p className="text-xs uppercase tracking-wider text-suave">{p.marca}</p>}
          <h1 className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">{p.titulo}</h1>
          <p className="mt-2 font-display text-3xl font-extrabold text-acento tabular-nums">{varias ? 'desde ' : ''}{precio(p.desde)}</p>
          <p className="text-suave">{varias ? `en ${p.numTiendas} tiendas` : 'en 1 tienda'}</p>
        </div>
      </header>
      <section className="rounded-xl border border-borde bg-superficie p-4">
        <h2 className="mb-2 font-display font-semibold">Ofertas</h2>
        <ListaOfertas ofertas={p.ofertas} comparar={varias} ahora={generadaEn} />
      </section>
      <GraficoHistorial historial={historial} ofertas={p.ofertas} ahora={generadaEn} />
    </article>
  );
}

export default function PaginaProducto(props: PageProps<'/p/[id]'>) {
  return (
    <Suspense fallback={<p className="animate-pulse text-suave">Cargando ofertas…</p>}>
      <Ficha params={props.params} />
    </Suspense>
  );
}
