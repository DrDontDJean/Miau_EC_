import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { buscarCacheado } from '@/lib/datos';
import { leerOrden } from '@/lib/rutas';
import { EsqueletoRejilla, RejillaProductos, tarjetaDeProducto } from '@/components/ofertas';
import { SalidasRapidas } from '@/components/salidas';

export const metadata: Metadata = { title: 'Buscar', robots: { index: false } };

const ETIQUETAS = { relevancia: 'Relevancia', precio_asc: 'Menor precio', precio_desc: 'Mayor precio' } as const;

const texto = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');

/** Opción de orden o filtro: un enlace normal que funciona sin JavaScript. La activa lleva marca, no solo color. */
function Opcion({ href, activa, children }: { href: string; activa: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href} aria-current={activa ? 'true' : undefined}
      className={`flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm font-semibold transition-colors ${
        activa ? 'border-cian bg-cian text-en-cian' : 'border-borde-control text-texto hover:bg-seccion'}`}
    >
      {activa && (
        <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 fill-none stroke-current stroke-2">
          <path d="M3 8.5l3.2 3L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {children}
    </Link>
  );
}

async function Resultados({ searchParams }: { searchParams: PageProps<'/buscar'>['searchParams'] }) {
  const sp = await searchParams;
  const q = texto(sp.q).trim().slice(0, 80);
  const orden = leerOrden(texto(sp.orden) || null);

  if (q.length < 2) {
    return (
      <section>
        <h1 className="text-2xl font-extrabold tracking-tight">¿Qué quieres comparar?</h1>
        <p className="mt-2 text-suave">Escribe al menos 2 letras en el buscador: un producto, una marca o un modelo.</p>
        <SalidasRapidas titulo="O empieza por aquí" />
      </section>
    );
  }

  const todos = await buscarCacheado(q, orden);

  if (todos.length === 0) {
    return (
      <section>
        <h1 className="text-2xl font-extrabold tracking-tight">No encontramos <q>{q}</q></h1>
        <p className="mt-2 max-w-[60ch] text-suave">
          Ninguna de las tiendas incluidas lo tiene con ese nombre. Prueba con menos palabras, con la marca o con el modelo.
        </p>
        <SalidasRapidas />
      </section>
    );
  }

  // Filtros sobre lo que ya llegó de la búsqueda: no cambian la consulta.
  const filtros = { stock: texto(sp.stock) === '1', varias: texto(sp.varias) === '1', tienda: texto(sp.tienda) };
  const tiendas = [...new Map(todos.flatMap(p => p.ofertas).map(o => [o.tiendaId, o.tienda])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]));
  if (!tiendas.some(([id]) => id === filtros.tienda)) filtros.tienda = '';

  const productos = todos.filter(p =>
    (!filtros.stock || p.ofertas.some(o => o.disponible)) &&
    (!filtros.varias || p.numTiendas > 1) &&
    (!filtros.tienda || p.ofertas.some(o => o.tiendaId === filtros.tienda)));

  const ruta = (cambio: Partial<typeof filtros> & { orden?: string }) => {
    const f = { ...filtros, orden, ...cambio };
    const p = new URLSearchParams({ q });
    if (f.orden !== 'relevancia') p.set('orden', f.orden);
    if (f.stock) p.set('stock', '1');
    if (f.varias) p.set('varias', '1');
    if (f.tienda) p.set('tienda', f.tienda);
    return `/buscar?${p}`;
  };
  const hayFiltros = filtros.stock || filtros.varias || filtros.tienda !== '';
  const limitado = todos.length >= 24; // buscar_productos devuelve como mucho 24

  const controles = (
    <div className="flex flex-col gap-3 py-4">
      <nav aria-label="Ordenar resultados" className="flex flex-wrap items-center gap-2">
        <span className="w-16 shrink-0 text-sm text-suave">Ordenar</span>
        {(Object.keys(ETIQUETAS) as (keyof typeof ETIQUETAS)[]).map(o => (
          <Opcion key={o} href={ruta({ orden: o })} activa={o === orden}>{ETIQUETAS[o]}</Opcion>
        ))}
      </nav>
      <nav aria-label="Filtrar resultados" className="flex flex-wrap items-center gap-2">
        <span className="w-16 shrink-0 text-sm text-suave">Mostrar</span>
        <Opcion href={ruta({ stock: !filtros.stock })} activa={filtros.stock}>Solo en stock</Opcion>
        <Opcion href={ruta({ varias: !filtros.varias })} activa={filtros.varias}>En varias tiendas</Opcion>
        {tiendas.length > 1 && tiendas.map(([id, nombre]) => (
          <Opcion key={id} href={ruta({ tienda: filtros.tienda === id ? '' : id })} activa={filtros.tienda === id}>{nombre}</Opcion>
        ))}
      </nav>
    </div>
  );

  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">
        {hayFiltros
          ? `${productos.length} de los ${limitado ? 'primeros ' : ''}${todos.length} productos`
          : limitado ? `Primeros ${todos.length} productos` : `${todos.length} ${todos.length === 1 ? 'producto' : 'productos'}`}
        {' '}para <q>{q}</q>
      </h1>

      {/* En el teléfono los controles van plegados para que los precios entren en la primera pantalla. */}
      <details className="group mt-3 mb-5 border-y border-borde sm:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 font-semibold [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="block whitespace-nowrap">Ordenar y filtrar</span>
            <span className="block text-sm font-normal text-suave">
              {[ETIQUETAS[orden], filtros.stock && 'en stock', filtros.varias && 'en varias tiendas', filtros.tienda && tiendas.find(([id]) => id === filtros.tienda)?.[1]].filter(Boolean).join(' · ')}
            </span>
          </span>
          <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 shrink-0 fill-none stroke-current stroke-2 transition-transform group-open:rotate-180">
            <path d="M3.5 6l4.5 4.5L12.5 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        {controles}
      </details>
      <div className="mt-4 mb-6 hidden border-y border-borde sm:block">
        {controles}
      </div>

      {productos.length === 0 ? (
        <section>
          <p className="font-semibold">Ningún resultado cumple esos filtros.</p>
          <p className="mt-2">
            <Link href={ruta({ stock: false, varias: false, tienda: '' })} className="inline-flex min-h-11 items-center font-semibold text-enlace underline">
              Quitar filtros y ver los {todos.length}
            </Link>
          </p>
        </section>
      ) : (
        <>
          <RejillaProductos productos={productos.map(tarjetaDeProducto)} />
          {limitado && (
            <p className="mt-6 text-sm text-suave">Solo mostramos los primeros {todos.length} resultados. Si no ves lo que buscas, añade la marca o el modelo.</p>
          )}
        </>
      )}
    </>
  );
}

export default function Buscar(props: PageProps<'/buscar'>) {
  return (
    <Suspense fallback={<EsqueletoRejilla />}>
      <Resultados searchParams={props.searchParams} />
    </Suspense>
  );
}
