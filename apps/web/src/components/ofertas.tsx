import type { Oferta, Producto } from '@/lib/catalogo';

const usd = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
export const precio = (n: number | null) => (n === null ? '—' : usd.format(n));

const haceCuanto = (iso: string, ahora: number) => {
  const horas = Math.round((ahora - new Date(iso).getTime()) / 3_600_000);
  return horas < 1 ? 'hace menos de 1 h' : horas < 48 ? `hace ${horas} h` : `hace ${Math.round(horas / 24)} días`;
};

export function ListaOfertas({ ofertas, comparar, ahora }: { ofertas: Oferta[]; comparar: boolean; ahora: number }) {
  return (
    <ul className="divide-y divide-borde border-t border-borde">
      {ofertas.map((o, i) => (
        <li key={o.id} className={`grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[9rem_1fr_9rem_8rem] ${i === 0 && comparar ? 'bg-amarillo/10' : ''}`}>
          <div className="flex flex-col">
            <strong className="font-display">{o.tienda}</strong>
            <span className={`text-xs ${o.disponible ? 'text-verde' : 'text-rojo'}`}>{o.disponible ? 'En stock' : 'Sin stock'}</span>
          </div>
          <p className="order-3 col-span-2 text-sm text-suave sm:order-none sm:col-span-1">
            {o.titulo} <span className="whitespace-nowrap text-xs">· visto {haceCuanto(o.vistoUltimaVez, ahora)}</span>
          </p>
          <div className="flex flex-wrap items-baseline gap-x-2 text-right sm:text-left">
            <span className="font-display text-lg font-semibold tabular-nums">{precio(o.precio)}</span>
            {o.precioLista && <s className="text-sm text-suave tabular-nums">{precio(o.precioLista)}</s>}
            {i === 0 && comparar && <span className="rounded bg-amarillo px-1.5 text-xs font-semibold text-en-amarillo">Mejor precio</span>}
          </div>
          <a
            href={o.ir} target="_blank" rel="noopener nofollow"
            className="order-4 col-span-2 rounded-lg bg-verde px-3 py-2 text-center font-semibold text-white hover:brightness-110 sm:order-none sm:col-span-1"
          >
            Ver oferta
          </a>
        </li>
      ))}
    </ul>
  );
}

export function TarjetaProducto({ producto: p, ahora }: { producto: Producto; ahora: number }) {
  const varias = p.numTiendas > 1;
  const hasta = Math.max(...p.ofertas.map(o => o.precio));
  return (
    <article className="grid grid-cols-[72px_1fr] gap-4 rounded-xl border border-borde bg-superficie p-4 sm:grid-cols-[112px_1fr]">
      <div className="grid size-[72px] place-items-center sm:size-28">
        {p.imagen && <img src={p.imagen} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-contain" />}
      </div>
      <div className="min-w-0">
        {p.marca && <p className="text-xs uppercase tracking-wider text-suave">{p.marca}</p>}
        <h2 className="font-display text-lg leading-snug">
          <a href={`/p/${p.id}`} className="hover:underline">{p.titulo}</a>
        </h2>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
          <span className="font-display text-2xl font-extrabold text-acento tabular-nums">{varias ? 'desde ' : ''}{precio(p.desde)}</span>
          <span className="text-sm text-suave">{varias ? `${p.numTiendas} tiendas · hasta ${precio(hasta)}` : '1 tienda'}</span>
        </p>
        <details open={varias} className="mt-2">
          <summary className="cursor-pointer text-sm font-semibold text-acento">{varias ? 'Comparar ofertas' : 'Ver oferta'}</summary>
          <ListaOfertas ofertas={p.ofertas} comparar={varias} ahora={ahora} />
        </details>
      </div>
    </article>
  );
}
