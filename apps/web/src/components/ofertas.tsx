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

/**
 * Sello de precio: el precio y cuándo se leyó, como una sola pieza.
 * `leidoEn` ya viene formateado en hora de Ecuador; sin él solo queda el precio.
 */
export function Sello({ valor, desde, leidoEn, grande = false }: { valor: number | null; desde: boolean; leidoEn?: string | null; grande?: boolean }) {
  return (
    <p className={`inline-flex max-w-full overflow-hidden rounded-lg align-top ${grande ? 'flex-col sm:flex-row' : 'flex-col'}`}>
      <span className={`flex items-baseline gap-1.5 bg-cian text-en-cian ${grande ? 'px-4 py-2' : 'px-2.5 py-1'}`}>
        {desde && <span className={`font-semibold ${grande ? 'text-base' : 'text-xs'}`}>desde</span>}
        <strong className={`font-extrabold tabular-nums ${grande ? 'text-4xl' : 'text-xl'}`}>{precio(valor)}</strong>
      </span>
      {leidoEn && (
        <span className={`flex items-center bg-arena-fondo text-texto ${grande ? 'px-4 py-2 text-sm' : 'px-2.5 py-1 text-xs'}`}>
          leído {leidoEn}
        </span>
      )}
    </p>
  );
}

/** Stock con icono y texto: el significado no depende del color. */
export function Stock({ disponible }: { disponible: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold ${disponible ? 'text-texto' : 'text-suave'}`}>
      <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5 fill-none stroke-current stroke-2">
        {disponible
          ? <path d="M3 8.5l3.2 3L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
          : <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />}
      </svg>
      {disponible ? 'En stock' : 'Sin stock'}
    </span>
  );
}

export type DatosTarjeta = {
  id: string; titulo: string; imagen: string | null;
  desde: number | null; numTiendas: number; leidoEn?: string | null; nota?: string;
};

/** Datos de tarjeta a partir de un producto con ofertas (búsqueda). */
export function tarjetaDeProducto(p: Producto): DatosTarjeta {
  const barata = ofertaMasBarata(p.ofertas);
  const hayStock = p.ofertas.some(o => o.disponible);
  const tiendas = p.numTiendas > 1 ? `${p.numTiendas} tiendas` : '1 tienda';
  return {
    id: p.id, titulo: p.titulo, imagen: p.imagen, desde: p.desde, numTiendas: p.numTiendas,
    leidoEn: barata ? leido(barata.vistoUltimaVez) : null,
    nota: !barata ? tiendas
      : !hayStock ? `${tiendas} · sin stock`
      : p.numTiendas > 1 ? `${tiendas} · más barato en ${barata.tienda}` : `Solo en ${barata.tienda}`,
  };
}

/** Tarjeta compacta: imagen, título y sello. Toda la tarjeta lleva a la ficha. */
export function TarjetaProducto({ datos: p, nivel = 'h2' }: { datos: DatosTarjeta; nivel?: 'h2' | 'h3' }) {
  const Titulo = nivel;
  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-xl border border-borde bg-superficie transition-shadow duration-200 hover:shadow-[0_8px_20px_-10px_rgb(31_31_51/0.45)]">
      <div className="aspect-[4/3] border-b border-borde bg-white p-3">
        {p.imagen && <img src={p.imagen} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-contain" />}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <Titulo className="line-clamp-4 font-semibold leading-snug sm:line-clamp-3">
          <Link href={`/p/${p.id}`} className="enlace-tarjeta hover:underline">{p.titulo}</Link>
        </Titulo>
        <div className="mt-auto pt-2">
          <Sello valor={p.desde} desde={p.numTiendas > 1} leidoEn={p.leidoEn} />
          <p className="mt-1.5 text-sm text-suave">{p.nota ?? (p.numTiendas > 1 ? `${p.numTiendas} tiendas` : '1 tienda')}</p>
        </div>
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
          <li key={i} className="overflow-hidden rounded-xl border border-borde">
            <div className="esqueleto aspect-[4/3] rounded-none" />
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
 * Ofertas de un producto, una fila por tienda. Cada precio lleva su hora de lectura;
 * el de la oferta que da el «precio desde» va en el sello.
 */
export function ListaOfertas({ ofertas, comparar, ahora }: { ofertas: Oferta[]; comparar: boolean; ahora: number }) {
  const desde = ofertaMasBarata(ofertas);
  const masReciente = Math.max(...ofertas.map(o => new Date(o.vistoUltimaVez).getTime()));
  // Una oferta leída más de un día antes que la más reciente se avisa: su precio puede haber cambiado.
  const atrasada = (o: Oferta) => masReciente - new Date(o.vistoUltimaVez).getTime() > 86_400_000;
  return (
    <>
      <ul className="divide-y divide-borde border-y border-borde">
        {ofertas.map(o => {
          const esDesde = comparar && o.disponible && o.id === desde?.id;
          return (
            <li key={o.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-4 sm:grid-cols-[10rem_1fr_auto_10rem]">
              <div>
                <p className="text-lg font-bold leading-tight">{o.tienda}</p>
                <Stock disponible={o.disponible} />
              </div>
              <p className="order-3 col-span-2 text-sm text-suave sm:order-none sm:col-span-1">{o.titulo}</p>
              <div className="text-right">
                {esDesde ? (
                  <Sello valor={o.precio} desde={false} leidoEn={leido(o.vistoUltimaVez, ahora)} />
                ) : (
                  <>
                    <p className="text-2xl font-extrabold tabular-nums">{precio(o.precio)}</p>
                    {!atrasada(o) && <p className="text-xs text-suave">leído {leido(o.vistoUltimaVez, ahora)}</p>}
                  </>
                )}
                {atrasada(o) && (
                  <p className="mt-1 text-xs font-semibold text-texto">
                    {esDesde ? 'Puede haber cambiado' : `leído ${leido(o.vistoUltimaVez, ahora)} · puede haber cambiado`}
                  </p>
                )}
                {o.precioLista !== null && o.precioLista > o.precio && (
                  <p className="mt-1 text-xs text-suave">La tienda lo lista en <s className="tabular-nums">{precio(o.precioLista)}</s></p>
                )}
              </div>
              <a
                href={o.ir} target="_blank" rel="noopener nofollow"
                className={`order-4 col-span-2 flex min-h-11 items-center justify-center rounded-lg border px-4 font-semibold transition-colors sm:order-none sm:col-span-1 ${
                  o.disponible
                    ? 'border-borde-accion bg-accion text-en-accion hover:bg-accion-fuerte'
                    : 'border-borde-control text-texto hover:bg-seccion'
                }`}
              >
                {o.disponible ? 'Ver oferta' : 'Ver en la tienda'}
                <span className="sr-only"> en {o.tienda} (se abre en otra pestaña)</span>
              </a>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-suave">
        Cada botón abre la tienda en otra pestaña. Confirma allí el precio y el stock antes de pagar.
      </p>
    </>
  );
}
