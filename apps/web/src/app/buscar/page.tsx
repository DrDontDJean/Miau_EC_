import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { buscarCacheado, facetasCacheadas } from '@/lib/datos';
import { POR_PAGINA, leerPagina } from '@/lib/catalogo';
import { leerOrden } from '@/lib/rutas';
import { Paginacion } from '@/components/paginacion';
import { EsqueletoRejilla, RejillaProductos, tarjetaDeProducto } from '@/components/ofertas';
import { RAPIDAS, rutaBusqueda } from '@/lib/rapidas';
import { SalidasRapidas } from '@/components/salidas';

export const metadata: Metadata = { title: 'Buscar', robots: { index: false } };

const ETIQUETAS = { relevancia: 'Más relevantes', precio_asc: 'Precio: menor a mayor', precio_desc: 'Precio: mayor a menor' } as const;

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
  const pagina = leerPagina(texto(sp.pagina));

  if (q.length < 2) {
    return (
      <section>
        <h1 className="text-2xl font-extrabold tracking-tight">¿Qué producto busca?</h1>
        <p className="mt-2 text-suave">Escriba al menos 2 letras: un producto, una marca o un modelo.</p>
        <SalidasRapidas />
      </section>
    );
  }

  const facetas = await facetasCacheadas(q);

  if (facetas.total === 0) {
    return (
      <section>
        <h1 className="text-2xl font-extrabold tracking-tight">Sin resultados para <q>{q}</q></h1>
        <p className="mt-2 max-w-[60ch] text-suave">
          Ninguna tienda incluida lo tiene con ese nombre. Pruebe con menos palabras, la marca o el modelo.
        </p>
        <SalidasRapidas />
      </section>
    );
  }

  // Los filtros se aplican en la base antes de paginar; el lateral cuenta cuántos productos cumple cada uno.
  const tiendas = facetas.tiendas.map(t => [t.id, t.nombre] as const);
  const filtros = { stock: texto(sp.stock) === '1', varias: texto(sp.varias) === '1', tienda: texto(sp.tienda) };
  if (!tiendas.some(([id]) => id === filtros.tienda)) filtros.tienda = '';

  const { productos, total } = await buscarCacheado(q, orden, {
    pagina, soloDisponibles: filtros.stock, soloVarias: filtros.varias, tienda: filtros.tienda,
  });
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  // Cambiar el orden o un filtro vuelve a la primera página; los enlaces de página conservan todo lo demás.
  const ruta = (cambio: Partial<typeof filtros> & { orden?: string; pagina?: number }) => {
    const f = { ...filtros, orden, pagina: 1, ...cambio };
    const p = new URLSearchParams({ q });
    if (f.orden !== 'relevancia') p.set('orden', f.orden);
    if (f.stock) p.set('stock', '1');
    if (f.varias) p.set('varias', '1');
    if (f.tienda) p.set('tienda', f.tienda);
    if (f.pagina > 1) p.set('pagina', String(f.pagina));
    return `/buscar?${p}`;
  };
  const hayFiltros = filtros.stock || filtros.varias || filtros.tienda !== '';
  const cantidad = (n: number) => `${n} ${n === 1 ? 'producto' : 'productos'}`;
  const resumen = [
    hayFiltros && total < facetas.total ? `${total} de ${cantidad(facetas.total)}` : cantidad(total),
    paginas > 1 && `página ${pagina} de ${paginas}`,
  ].filter(Boolean).join(' · ');
  // Cuántos de los resultados cumple cada filtro, para mostrarlo junto a él.
  const conteo = {
    stock: facetas.disponibles,
    varias: facetas.varias,
    tienda: (id: string) => facetas.tiendas.find(t => t.id === id)?.n ?? 0,
  };
  const categoria = RAPIDAS.find(r => r.q === q.toLowerCase())?.q ?? '';

  const controles = (
    <div className="flex flex-col gap-3 py-4">
      <nav aria-label="Ordenar resultados" className="flex flex-wrap items-center gap-2">
        <span className="w-16 shrink-0 text-sm text-suave">Ordenar</span>
        {(Object.keys(ETIQUETAS) as (keyof typeof ETIQUETAS)[]).map(o => (
          <Opcion key={o} href={ruta({ orden: o })} activa={o === orden}>{ETIQUETAS[o]}</Opcion>
        ))}
      </nav>
      <nav aria-label="Filtrar resultados" className="flex flex-wrap items-center gap-2">
        <span className="w-16 shrink-0 text-sm text-suave">Filtrar</span>
        <Opcion href={ruta({ stock: !filtros.stock })} activa={filtros.stock}>Disponibles</Opcion>
        <Opcion href={ruta({ varias: !filtros.varias })} activa={filtros.varias}>Disponible en varias tiendas</Opcion>
      </nav>
      {tiendas.length > 1 && (
        <nav aria-label="Filtrar por tienda" className="flex flex-wrap items-center gap-2">
          <span className="w-16 shrink-0 text-sm text-suave">Tienda</span>
          {tiendas.map(([id, nombre]) => (
            <Opcion key={id} href={ruta({ tienda: filtros.tienda === id ? '' : id })} activa={filtros.tienda === id}>{nombre}</Opcion>
          ))}
        </nav>
      )}
    </div>
  );

  // Filtros de la columna lateral: cada uno con cuántos resultados lo cumplen.
  const gruposFiltro = [
    { titulo: 'Filtrar', items: [
      { etiqueta: 'Disponibles', n: conteo.stock, activa: filtros.stock, href: ruta({ stock: !filtros.stock }) },
      { etiqueta: 'Disponible en varias tiendas', n: conteo.varias, activa: filtros.varias, href: ruta({ varias: !filtros.varias }) },
    ] },
    { titulo: 'Tienda', items: tiendas.map(([id, nombre]) => ({ etiqueta: nombre, n: conteo.tienda(id), activa: filtros.tienda === id, href: ruta({ tienda: filtros.tienda === id ? '' : id }) })) },
  ].filter(g => g.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <section className="en-cabecera rounded-2xl bg-cabecera px-6 py-8 text-en-cabecera sm:px-10">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">Resultados para <q>{q}</q></h1>
        <p className="mt-1 text-sm text-en-cabecera-suave">{resumen}</p>
        <ul className="sin-barra -mx-6 mt-5 flex gap-2 overflow-x-auto px-6 sm:mx-0 sm:flex-wrap sm:px-0">
          {RAPIDAS.map(r => (
            <li key={r.q} className="shrink-0">
              <Link
                href={rutaBusqueda(r.q)} aria-current={r.q === categoria ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center rounded-full px-4 font-semibold transition-colors ${r.q === categoria ? 'bg-white text-[#1f1f33]' : 'border border-white/60 hover:bg-white/10'}`}
              >
                {r.etiqueta}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[15rem_1fr]">
        <div className="rounded-2xl border border-borde bg-superficie px-5 lg:border-0 lg:bg-transparent lg:px-0">
          {/* En el teléfono los controles van plegados para que los productos entren en la primera pantalla. */}
          <details className="group lg:hidden">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2 font-bold [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block whitespace-nowrap">Ordenar y filtrar</span>
                <span className="block text-sm font-normal text-suave">
                  {[ETIQUETAS[orden], filtros.stock && 'disponibles', filtros.varias && 'en varias tiendas', filtros.tienda && tiendas.find(([id]) => id === filtros.tienda)?.[1]].filter(Boolean).join(' · ')}
                </span>
              </span>
              <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 shrink-0 fill-none stroke-current stroke-2 transition-transform group-open:rotate-180"><path d="M3.5 6l4.5 4.5L12.5 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </summary>
            {controles}
          </details>
          <aside aria-label="Ordenar y filtrar" className="hidden flex-col gap-5 lg:flex">
            <div>
              <h2 className="mb-2 font-bold">Ordenar por</h2>
              <ul className="flex flex-col gap-1">
                {(Object.keys(ETIQUETAS) as (keyof typeof ETIQUETAS)[]).map(o => (
                  <li key={o}>
                    <Link
                      href={ruta({ orden: o })} aria-current={o === orden ? 'true' : undefined}
                      className={`flex min-h-11 items-center rounded-lg px-3 font-semibold ${o === orden ? 'bg-superficie text-texto shadow-[inset_3px_0_0_var(--cian)]' : 'text-suave hover:bg-superficie hover:text-texto'}`}
                    >
                      {ETIQUETAS[o]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            {gruposFiltro.map(g => (
              <div key={g.titulo}>
                <h2 className="mb-2 font-bold">{g.titulo}</h2>
                <ul className="flex flex-col gap-1">
                  {g.items.map(it => (
                    <li key={it.etiqueta}>
                      <Link href={it.href} aria-current={it.activa ? 'true' : undefined} className="flex min-h-11 items-center gap-3 rounded-lg px-3 hover:bg-superficie">
                        <span className={`grid size-5 shrink-0 place-items-center rounded border-2 ${it.activa ? 'border-accion bg-accion text-white' : 'border-borde-control bg-superficie'}`}>
                          {it.activa && <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5 fill-none stroke-current stroke-[2.5]"><path d="M3 8.5l3.2 3L13 4.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </span>
                        <span className="flex-1">{it.etiqueta}</span>
                        <span className="text-sm text-suave tabular-nums">{it.n}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {hayFiltros && <Link href={ruta({ stock: false, varias: false, tienda: '' })} className="mt-2 inline-flex min-h-11 items-center px-3 text-sm font-semibold text-enlace underline">Quitar filtros</Link>}
          </aside>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {productos.length === 0 ? (
            <section className="rounded-2xl bg-superficie p-6">
              {pagina > 1 && !hayFiltros ? (
                <>
                  <p className="font-semibold">Esa página no existe.</p>
                  <Link href={ruta({ pagina: 1 })} className="mt-2 inline-flex min-h-11 items-center font-semibold text-enlace underline">Volver a los primeros resultados</Link>
                </>
              ) : (
                <>
                  <p className="font-semibold">Ningún resultado cumple esos filtros.</p>
                  <Link href={ruta({ stock: false, varias: false, tienda: '' })} className="mt-2 inline-flex min-h-11 items-center font-semibold text-enlace underline">Quitar filtros y ver los {facetas.total}</Link>
                </>
              )}
            </section>
          ) : (
            <>
              <div className="catalogo-rejilla"><RejillaProductos productos={productos.map(tarjetaDeProducto)} /></div>
              <Paginacion actual={pagina} paginas={paginas} href={n => ruta({ pagina: n })} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Buscar(props: PageProps<'/buscar'>) {
  return (
    <Suspense fallback={<EsqueletoRejilla />}>
      <Resultados searchParams={props.searchParams} />
    </Suspense>
  );
}
