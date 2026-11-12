import Link from 'next/link';
import type { Oferta, Producto } from '@/lib/catalogo';
import { leido } from '@/lib/fechas';

const usd = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
export const precio = (n: number | null) => (n === null ? '—' : usd.format(n));

/** La oferta que da el «precio desde»: la más barata con stock; si ninguna tiene, la más barata. */
export function ofertaMasBarata(ofertas: Oferta[]): Oferta | null {
  const porPrecio = (a: Oferta, b: Oferta) => a.precio - b.precio;
  return ofertas.filter(o => o.disponible).sort(porPrecio)[0] ?? [...ofertas].sort(porPrecio)[0] ?? null;
}

/** Disponibilidad con icono y texto: el significado no depende del color. */
export function Stock({ disponible }: { disponible: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold ${disponible ? 'text-texto' : 'text-suave'}`}>
      <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5 fill-none stroke-current stroke-2">
        {disponible
          ? <path d="M3 8.5l3.2 3L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
          : <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />}
      </svg>
      {disponible ? 'Disponible' : 'Agotado'}
    </span>
  );
}

export type DatosTarjeta = {
  id: string; titulo: string; imagen: string | null;
  desde: number | null; numTiendas: number; nota?: string;
};

/** Datos de tarjeta a partir de un producto con ofertas (búsqueda). */
export function tarjetaDeProducto(p: Producto): DatosTarjeta {
  const barata = ofertaMasBarata(p.ofertas);
  const hayStock = p.ofertas.some(o => o.disponible);
  return {
    id: p.id, titulo: p.titulo, imagen: p.imagen, desde: p.desde, numTiendas: p.numTiendas,
    nota: !barata ? undefined
      : !hayStock ? 'agotado'
      : p.numTiendas > 1 ? `más barato en ${barata.tienda}` : `en ${barata.tienda}`,
  };
}

/** Tarjeta de producto: imagen, título, precio y tiendas. Toda la tarjeta lleva a la ficha. */
export function TarjetaProducto({ datos: p, nivel = 'h2' }: { datos: DatosTarjeta; nivel?: 'h2' | 'h3' }) {
  const Titulo = nivel;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-borde bg-superficie transition-colors hover:border-borde-control">
      <div className="relative aspect-square bg-white p-4">
        {p.imagen && <img src={p.imagen} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-contain" />}
      </div>
      <div className="flex flex-1 flex-col gap-2 border-t border-borde p-3 sm:p-4">
        <Titulo className="line-clamp-4 text-sm font-semibold leading-snug sm:line-clamp-3">
          <Link href={`/p/${p.id}`} className="enlace-tarjeta group-hover:underline">{p.titulo}</Link>
        </Titulo>
        <p className="mt-auto flex items-baseline gap-1 pt-1">
          {p.numTiendas > 1 && <span className="text-xs text-suave">desde</span>}
          <strong className="text-xl font-extrabold tabular-nums">{precio(p.desde)}</strong>
        </p>
        <p className="-mt-1 text-xs text-suave">
          {p.numTiendas > 1 ? `${p.numTiendas} tiendas${p.nota ? ` · ${p.nota}` : ''}` : p.nota ? p.nota.charAt(0).toUpperCase() + p.nota.slice(1) : '1 tienda'}
        </p>
      </div>
    </article>
  );
}

const REJILLA = 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5';

export function RejillaProductos({ productos, nivel }: { productos: DatosTarjeta[]; nivel?: 'h2' | 'h3' }) {
  return (
    <ul className={REJILLA}>
      {productos.map(p => <li key={p.id}><TarjetaProducto datos={p} nivel={nivel} /></li>)}
    </ul>
  );
}

/** Esqueleto con la forma de la rejilla, para el estado de carga. */
export function EsqueletoRejilla({ cuantas = 10 }: { cuantas?: number }) {
  return (
    <div role="status" aria-label="Buscando en las tiendas">
      <div className="esqueleto mb-5 h-8 w-64 max-w-full" />
      <ul className={REJILLA} aria-hidden="true">
        {Array.from({ length: cuantas }, (_, i) => (
          <li key={i} className="overflow-hidden rounded-lg border border-borde bg-superficie">
            <div className="esqueleto aspect-square rounded-none" />
            <div className="flex flex-col gap-2 p-3">
              <div className="esqueleto h-4" />
              <div className="esqueleto h-4 w-2/3" />
              <div className="esqueleto mt-2 h-14 w-28" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Ofertas de un producto, una fila por tienda. La más barata disponible va destacada.
 * La fecha de actualización solo aparece en la fila cuando va atrasada respecto de las demás.
 */
export function ListaOfertas({ ofertas, comparar, ahora }: { ofertas: Oferta[]; comparar: boolean; ahora: number }) {
  const desde = ofertaMasBarata(ofertas);
  const masReciente = Math.max(...ofertas.map(o => new Date(o.vistoUltimaVez).getTime()));
  // Una oferta actualizada más de un día antes que la más reciente se avisa: su precio puede haber cambiado.
  const atrasada = (o: Oferta) => masReciente - new Date(o.vistoUltimaVez).getTime() > 86_400_000;
  return (
    <>
      <ul className="flex flex-col gap-2">
        {ofertas.map(o => {
          const esDesde = comparar && o.disponible && o.id === desde?.id;
          return (
            <li
              key={o.id}
              className={`grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 rounded-lg px-4 py-4 sm:grid-cols-[10rem_1fr_auto_10rem] ${
                esDesde ? 'border-2 border-cian bg-resalte' : 'border border-borde bg-superficie'}`}
            >
              <div>
                <p className="text-lg font-bold leading-tight">{o.tienda}</p>
                <Stock disponible={o.disponible} />
              </div>
              <p className="order-3 col-span-2 text-sm text-suave sm:order-none sm:col-span-1">{o.titulo}</p>
              <div className="text-right">
                <p className="flex flex-col items-end gap-1 sm:flex-row sm:items-baseline sm:justify-end sm:gap-2">
                  {esDesde && <span className="whitespace-nowrap rounded-full bg-cian px-2 py-0.5 text-xs font-semibold text-en-cian">Mejor precio</span>}
                  <span className={`font-extrabold tabular-nums ${esDesde ? 'text-3xl' : 'text-2xl'}`}>{precio(o.precio)}</span>
                </p>
                {atrasada(o) && (
                  <p className="text-xs font-semibold text-texto">Actualizado {leido(o.vistoUltimaVez, ahora)} · puede haber cambiado</p>
                )}
                {o.precioLista !== null && o.precioLista > o.precio && (
                  <p className="mt-1 text-xs text-suave">Antes <s className="tabular-nums">{precio(o.precioLista)}</s></p>
                )}
              </div>
              <a
                href={o.ir} target="_blank" rel="noopener nofollow"
                className={`order-4 col-span-2 flex min-h-11 items-center justify-center rounded-lg border px-4 font-semibold transition-colors sm:order-none sm:col-span-1 ${
                  !o.disponible
                    ? 'border-borde-control text-texto hover:bg-seccion'
                    : esDesde || !comparar
                      ? 'border-borde-accion bg-accion text-en-accion hover:bg-accion-fuerte'
                      : 'border-borde-accion bg-superficie text-enlace hover:bg-seccion'
                }`}
              >
                Ver oferta
                <span className="sr-only"> en {o.tienda} (se abre en otra pestaña)</span>
              </a>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-suave">
        Los precios pueden cambiar; verifique el precio final en la tienda.
      </p>
    </>
  );
}
