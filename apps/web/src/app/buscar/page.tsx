import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { buscarCacheado } from '@/lib/datos';
import { leerOrden } from '@/lib/rutas';
import { TarjetaProducto } from '@/components/ofertas';

export const metadata: Metadata = { title: 'Buscar', robots: { index: false } };

const ETIQUETAS = { relevancia: 'Relevancia', precio_asc: 'Menor precio', precio_desc: 'Mayor precio' } as const;

async function Resultados({ searchParams }: { searchParams: PageProps<'/buscar'>['searchParams'] }) {
  const sp = await searchParams;
  const q = (typeof sp.q === 'string' ? sp.q : '').trim().slice(0, 80);
  const orden = leerOrden(typeof sp.orden === 'string' ? sp.orden : null);
  if (q.length < 2) return <p className="text-suave">Escribe al menos 2 caracteres para buscar.</p>;

  const productos = await buscarCacheado(q, orden);
  const ahora = Date.now(); // después de leer la URL: esta parte ya es dinámica
  const enVarias = productos.filter(p => p.numTiendas > 1).length;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-xl">
          {productos.length} productos para <q>{q}</q>
          <span className="ml-2 text-base font-normal text-suave">({enVarias} en varias tiendas)</span>
        </h1>
        <nav aria-label="Ordenar" className="flex gap-1 text-sm">
          {(Object.keys(ETIQUETAS) as (keyof typeof ETIQUETAS)[]).map(o => (
            <Link
              key={o} href={`/buscar?q=${encodeURIComponent(q)}&orden=${o}`} aria-current={o === orden ? 'page' : undefined}
              className={`rounded-full px-3 py-1 ${o === orden ? 'bg-acento text-superficie' : 'bg-acento-suave text-acento'}`}
            >
              {ETIQUETAS[o]}
            </Link>
          ))}
        </nav>
      </div>
      {productos.length === 0
        ? <p className="text-suave">No encontramos <q>{q}</q> en las tiendas incluidas. Prueba con otra palabra o con la marca.</p>
        : <div className="grid gap-3">{productos.map(p => <TarjetaProducto key={p.id} producto={p} ahora={ahora} />)}</div>}
    </>
  );
}

export default function Buscar(props: PageProps<'/buscar'>) {
  return (
    <Suspense fallback={<p className="animate-pulse text-suave">Buscando en las tiendas…</p>}>
      <Resultados searchParams={props.searchParams} />
    </Suspense>
  );
}
