// Resultados de /buscar y de /categoria/[slug]: misma consulta (buscar_catalogo), mismo lateral y misma paginación.
// Con categoría, el lateral suma sus filtros propios con la cuenta de cada valor y el filtro de precio.
// Todo es enlace o formulario GET: funciona sin JavaScript.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buscarCacheado, quizasCacheado } from '@/lib/datos';
import { POR_PAGINA, TOPE_RESULTADOS, leerPagina } from '@/lib/catalogo';
import { leerOrden } from '@/lib/rutas';
import { Paginacion } from '@/components/paginacion';
import { RejillaProductos, tarjetaDeProducto } from '@/components/ofertas';
import { RAPIDAS, rutaBusqueda } from '@/lib/rapidas';
import { SalidasRapidas } from '@/components/salidas';
import { leerFiltros, leerPrecio, rutaCatalogo, type Categoria, type EstadoCatalogo, type Filtros } from '@/lib/categorias';

type Params = Record<string, string | string[] | undefined>;

const ETIQUETAS = { relevancia: 'Más relevantes', precio_asc: 'Precio: menor a mayor', precio_desc: 'Precio: mayor a menor' } as const;
const texto = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');
const dolares = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
/** Las marcas del lateral: las que tienen al menos 5 productos (y las ya elegidas). */
const MINIMO_MARCA = 5;

const Marca = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 fill-none stroke-current stroke-2">
    <path d="M3 8.5l3.2 3L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Opción de orden o filtro (teléfono): un enlace normal. La activa lleva marca, no solo color. */
function Opcion({ href, activa, children }: { href: string; activa: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href} aria-current={activa ? 'true' : undefined}
      className={`flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm font-semibold transition-colors ${
        activa ? 'border-cian bg-cian text-en-cian' : 'border-borde-control text-texto hover:bg-seccion'}`}
    >
      {activa && <Marca />}
      {children}
    </Link>
  );
}

type Item = { etiqueta: string; n: number; activa: boolean; href: string };
type Grupo = { titulo: string; items: Item[] };

/** Formulario de precio: GET a la misma página, conserva los demás filtros y vuelve a la página 1. */
function FormularioPrecio({ base, estado, min, max, sufijo }: {
  base: string; estado: EstadoCatalogo; min: number | null; max: number | null; sufijo: string;
}) {
  // Los demás parámetros viajan ocultos, con la misma forma que rutaCatalogo (precio fuera, página 1).
  const ocultos = new URLSearchParams(rutaCatalogo('/', { ...estado, precioMin: null, precioMax: null, pagina: 1 }).split('?')[1] ?? '');
  return (
    <form action={base} method="get" className="flex flex-col gap-2">
      {[...ocultos].map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="flex items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          <span className="text-suave">Desde ($)</span>
          <input
            name="precio_min" type="number" min={0} step="any" inputMode="decimal" defaultValue={estado.precioMin ?? undefined}
            placeholder={min !== null ? String(Math.floor(min)) : undefined} id={`precio-min-${sufijo}`}
            className="h-11 w-full rounded-lg border border-borde-control bg-superficie px-3 text-base text-texto"
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          <span className="text-suave">Hasta ($)</span>
          <input
            name="precio_max" type="number" min={0} step="any" inputMode="decimal" defaultValue={estado.precioMax ?? undefined}
            placeholder={max !== null ? String(Math.ceil(max)) : undefined} id={`precio-max-${sufijo}`}
            className="h-11 w-full rounded-lg border border-borde-control bg-superficie px-3 text-base text-texto"
          />
        </label>
      </div>
      <button type="submit" className="h-11 rounded-lg border border-borde-control px-4 font-semibold transition-colors hover:bg-seccion">
        Aplicar precio
      </button>
    </form>
  );
}

export async function VistaCatalogo({ base, cat, sp }: { base: string; cat: Categoria | null; sp: Params }) {
  const q = texto(sp.q).trim().slice(0, 80);
  const orden = leerOrden(texto(sp.orden) || null);
  const pagina = leerPagina(texto(sp.pagina));

  if (!cat && q.length < 2) {
    return (
      <section>
        <h1 className="text-2xl font-extrabold tracking-tight">¿Qué producto busca?</h1>
        <p className="mt-2 text-suave">Escriba al menos 2 letras: un producto, una marca o un modelo.</p>
        <SalidasRapidas />
      </section>
    );
  }

  const qBusqueda = q.length >= 2 ? q : '';
  const filtros: Filtros = cat ? leerFiltros(cat, sp) : {};
  let precioMin = leerPrecio(texto(sp.precio_min));
  let precioMax = leerPrecio(texto(sp.precio_max));
  if (precioMin !== null && precioMax !== null && precioMin > precioMax) [precioMin, precioMax] = [precioMax, precioMin];
  const comunes = { stock: texto(sp.stock) === '1', varias: texto(sp.varias) === '1', tienda: texto(sp.tienda).slice(0, 40) };
  const estado: EstadoCatalogo = { q: qBusqueda, orden, filtros, precioMin, precioMax, ...comunes, pagina };

  // Una sola llamada a la base: la página, el total con filtros y los conteos del lateral. Las opciones van siempre
  // con las mismas claves y los filtros ya ordenados: una entrada de caché por combinación, no por cómo llegó la URL.
  const { productos, total, limitado, facetas } = await buscarCacheado(qBusqueda, orden, {
    pagina, soloDisponibles: comunes.stock, soloVarias: comunes.varias, tienda: comunes.tienda,
    categoria: cat?.slug ?? '', filtros, precioMin, precioMax,
  });

  if (facetas.total === 0) {
    if (cat) {
      return (
        <section>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {qBusqueda ? <>Sin resultados para <q>{qBusqueda}</q> en {cat.nombre}</> : <>{cat.nombre}</>}
          </h1>
          <p className="mt-2 max-w-[60ch] text-suave">
            {qBusqueda ? 'Ninguna tienda incluida lo tiene en esta categoría.' : 'Todavía no hay productos en esta categoría. Vuelva más tarde.'}
          </p>
          {qBusqueda && (
            <Link href={rutaBusqueda(qBusqueda)} className="mt-4 inline-flex min-h-11 items-center font-semibold text-enlace underline">
              Buscar <q className="mx-1">{qBusqueda}</q> en todas las categorías
            </Link>
          )}
          <SalidasRapidas />
        </section>
      );
    }
    // Sin coincidencias de verdad: se ofrecen términos parecidos que sí existen, nunca productos que no coinciden.
    const quizas = await quizasCacheado(qBusqueda);
    return (
      <section>
        <h1 className="text-2xl font-extrabold tracking-tight">Sin resultados para <q>{qBusqueda}</q></h1>
        <p className="mt-2 max-w-[60ch] text-suave">
          Ninguna tienda incluida lo tiene con ese nombre. Pruebe con menos palabras, la marca o el modelo.
        </p>
        {quizas.length > 0 && (
          <div className="mt-6">
            <p className="font-semibold">Quizás buscaba</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {quizas.map(t => (
                <li key={t}>
                  <Link href={rutaBusqueda(t)} className="flex min-h-11 items-center rounded-lg border border-borde-control px-4 font-semibold transition-colors hover:bg-seccion">
                    {t}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <SalidasRapidas />
      </section>
    );
  }

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  // Cambiar el orden o un filtro vuelve a la primera página; los enlaces de página conservan todo lo demás.
  const ruta = (cambio: Partial<EstadoCatalogo>) => rutaCatalogo(base, { ...estado, pagina: 1, ...cambio });
  // Una página que no existe (pagina=999 con 33 páginas) lleva a la última que sí existe. Dentro de <Suspense> la
  // respuesta ya empezó: Next lo hace con una redirección en el navegador (también sin JavaScript).
  if (total > 0 && pagina > paginas) redirect(ruta({ pagina: paginas }));

  const hayFiltros = comunes.stock || comunes.varias || comunes.tienda !== '' || precioMin !== null || precioMax !== null || Object.keys(filtros).length > 0;
  const sinFiltros: Partial<EstadoCatalogo> = { stock: false, varias: false, tienda: '', filtros: {}, precioMin: null, precioMax: null };
  const cantidad = (n: number) => `${n} ${n === 1 ? 'producto' : 'productos'}`;
  // Con más de 2.000 coincidencias solo se muestran las mejores: se dice, en vez de dar un total que no es.
  const totalSinFiltros = limitado ? `más de ${TOPE_RESULTADOS.toLocaleString('es-EC')} productos` : cantidad(facetas.total);
  const resumen = [
    hayFiltros && total < facetas.total ? `${total} de ${totalSinFiltros}` : limitado ? totalSinFiltros : cantidad(total),
    limitado && 'se muestran los más relevantes',
    paginas > 1 && `página ${pagina} de ${paginas}`,
  ].filter(Boolean).join(' · ');

  const tiendas = facetas.tiendas.map(t => [t.id, t.nombre] as const);
  const conTienda = (id: string) => facetas.tiendas.find(t => t.id === id)?.n ?? 0;
  // En /buscar, si la mayoría de los resultados es de una categoría, se ofrece ver solo esa.
  const dominante = !cat ? facetas.categorias[0] : undefined;
  const verSolo = dominante && dominante.n >= 5 && dominante.n / facetas.total >= 0.5 ? dominante : undefined;

  // Filtros propios de la categoría: cada valor con cuántos productos lo tienen (con los demás filtros aplicados).
  const alternar = (clave: string, valor: string): Filtros => {
    const actuales = filtros[clave] ?? [];
    const nuevos = actuales.includes(valor) ? actuales.filter(v => v !== valor) : [...actuales, valor];
    const f = { ...filtros };
    if (nuevos.length) f[clave] = nuevos; else delete f[clave];
    return f;
  };
  const gruposCategoria: Grupo[] = (cat?.atributos ?? []).map(a => {
    const cuentas = new Map((facetas.atributos[a.clave] ?? []).map(x => [x.valor, x.n]));
    const elegidos = filtros[a.clave] ?? [];
    const valores = a.clave === 'marca'
      ? [...cuentas].filter(([v, n]) => v !== 'no-indicado' && (n >= MINIMO_MARCA || elegidos.includes(v))).map(([v]) => v)
      : a.valores.filter(v => (cuentas.get(v) ?? 0) > 0 || elegidos.includes(v));
    if ((cuentas.get('no-indicado') ?? 0) > 0 && a.clave !== 'marca') valores.push('no-indicado');
    return {
      titulo: a.nombre,
      items: valores.map(v => ({ etiqueta: a.etiqueta(v), n: cuentas.get(v) ?? 0, activa: elegidos.includes(v), href: ruta({ filtros: alternar(a.clave, v) }) })),
    };
  }).filter(g => g.items.length > 0);

  const gruposComunes: Grupo[] = [
    { titulo: 'Filtrar', items: [
      { etiqueta: 'Disponibles', n: facetas.disponibles, activa: comunes.stock, href: ruta({ stock: !comunes.stock }) },
      { etiqueta: 'Disponible en varias tiendas', n: facetas.varias, activa: comunes.varias, href: ruta({ varias: !comunes.varias }) },
    ] },
    { titulo: 'Tienda', items: tiendas.map(([id, nombre]) => ({ etiqueta: nombre, n: conTienda(id), activa: comunes.tienda === id, href: ruta({ tienda: comunes.tienda === id ? '' : id }) })) },
  ].filter(g => g.items.length > 0);

  const precio = cat ? (sufijo: string) => (
    <FormularioPrecio base={base} estado={estado} min={facetas.precio?.min ?? null} max={facetas.precio?.max ?? null} sufijo={sufijo} />
  ) : null;

  const controles = (
    <div className="flex flex-col gap-3 py-4">
      <nav aria-label="Ordenar resultados" className="flex flex-wrap items-center gap-2">
        <span className="w-16 shrink-0 text-sm text-suave">Ordenar</span>
        {(Object.keys(ETIQUETAS) as (keyof typeof ETIQUETAS)[]).map(o => (
          <Opcion key={o} href={ruta({ orden: o })} activa={o === orden}>{ETIQUETAS[o]}</Opcion>
        ))}
      </nav>
      {[...gruposCategoria, ...gruposComunes].map(g => (
        <nav key={g.titulo} aria-label={`Filtrar por ${g.titulo.toLowerCase()}`} className="flex flex-wrap items-center gap-2">
          <span className="w-full text-sm text-suave">{g.titulo}</span>
          {g.items.map(it => <Opcion key={it.etiqueta} href={it.href} activa={it.activa}>{it.etiqueta} <span className="font-normal tabular-nums">({it.n})</span></Opcion>)}
        </nav>
      ))}
      {precio && <div><p className="mb-1 text-sm text-suave">Precio</p>{precio('movil')}</div>}
      {hayFiltros && <Link href={ruta(sinFiltros)} className="inline-flex min-h-11 items-center text-sm font-semibold text-enlace underline">Quitar filtros</Link>}
    </div>
  );

  const resumenFiltros = [
    ETIQUETAS[orden],
    ...Object.entries(filtros).map(([k, vs]) => { const a = cat?.atributos.find(x => x.clave === k); return vs.map(v => a?.etiqueta(v) ?? v).join(' o '); }),
    precioMin !== null && `desde ${dolares.format(precioMin)}`, precioMax !== null && `hasta ${dolares.format(precioMax)}`,
    comunes.stock && 'disponibles', comunes.varias && 'en varias tiendas', comunes.tienda && tiendas.find(([id]) => id === comunes.tienda)?.[1],
  ].filter(Boolean).join(' · ');

  return (
    <div className="flex flex-col gap-6">
      <section className="en-cabecera rounded-2xl bg-cabecera px-6 py-8 text-en-cabecera sm:px-10">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          {cat ? (qBusqueda ? <>{cat.nombre} con <q>{qBusqueda}</q></> : cat.nombre) : <>Resultados para <q>{qBusqueda}</q></>}
        </h1>
        <p className="mt-1 text-sm text-en-cabecera-suave">{resumen}</p>
        {verSolo && (
          <Link href={rutaCatalogo(`/categoria/${verSolo.slug}`, { q: qBusqueda })} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 font-semibold text-[#1f1f33] transition-colors hover:bg-white/90">
            Ver solo {verSolo.nombre} <span className="font-normal tabular-nums">({verSolo.n})</span>
          </Link>
        )}
        {cat && (
          <form action={base} method="get" role="search" className="mt-4 flex max-w-xl">
            <label htmlFor="q-categoria" className="sr-only">Buscar en {cat.nombre}</label>
            <input
              id="q-categoria" name="q" type="search" defaultValue={qBusqueda} minLength={2} maxLength={80}
              placeholder={`Buscar en ${cat.nombre.toLowerCase()}: marca o modelo`}
              className="h-11 min-w-0 flex-1 rounded-l-full border-0 bg-white px-4 text-base text-[#36364f] placeholder:text-[#5f6070]"
            />
            <button type="submit" className="h-11 rounded-r-full bg-cian px-5 font-semibold text-en-cian transition-[filter] hover:brightness-95">Buscar</button>
          </form>
        )}
        <ul className="sin-barra -mx-6 mt-5 flex gap-2 overflow-x-auto px-6 sm:mx-0 sm:flex-wrap sm:px-0">
          {RAPIDAS.map(r => (
            <li key={r.slug} className="shrink-0">
              <Link
                href={r.href} aria-current={r.slug === cat?.slug ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center rounded-full px-4 font-semibold transition-colors ${r.slug === cat?.slug ? 'bg-white text-[#1f1f33]' : 'border border-white/60 hover:bg-white/10'}`}
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
                <span className="block text-sm font-normal text-suave">{resumenFiltros}</span>
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
            {gruposCategoria.map(g => <GrupoLateral key={g.titulo} grupo={g} />)}
            {precio && (
              <div>
                <h2 className="mb-2 font-bold">Precio</h2>
                {precio('lateral')}
              </div>
            )}
            {gruposComunes.map(g => <GrupoLateral key={g.titulo} grupo={g} />)}
            {hayFiltros && <Link href={ruta(sinFiltros)} className="mt-2 inline-flex min-h-11 items-center px-3 text-sm font-semibold text-enlace underline">Quitar filtros</Link>}
          </aside>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {productos.length === 0 ? (
            <section className="rounded-2xl bg-superficie p-6">
              <p className="font-semibold">Ningún resultado cumple esos filtros.</p>
              <Link href={ruta(sinFiltros)} className="mt-2 inline-flex min-h-11 items-center font-semibold text-enlace underline">Quitar filtros y ver todos</Link>
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

/** Grupo del lateral: casillas (enlaces) con la cuenta de cada opción. */
function GrupoLateral({ grupo }: { grupo: Grupo }) {
  return (
    <div>
      <h2 className="mb-2 font-bold">{grupo.titulo}</h2>
      <ul className="flex flex-col gap-1">
        {grupo.items.map(it => (
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
  );
}
