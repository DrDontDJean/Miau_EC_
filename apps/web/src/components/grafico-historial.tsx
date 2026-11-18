import type { Periodo } from '@/lib/datos';
import type { Oferta } from '@/lib/catalogo';
import { diaCorto } from '@/lib/fechas';
import { precio } from './ofertas';

type Cambio = { tienda: string; de: number; a: number; cuando: string };

/** Escalones de precio por tienda (SCD2: cada periodo es un tramo horizontal), con un área suave bajo cada línea. */
export function GraficoHistorial({ historial, ofertas, ahora, desde: precioHoy }: { historial: Periodo[]; ofertas: Oferta[]; ahora: number; desde: number | null }) {
  const titulo = <h2 className="text-xl font-bold">Historial de precios</h2>;
  if (!historial.length) {
    return (
      <section>
        {titulo}
        <p className="mt-2 max-w-[65ch] text-suave">Aún no hay historial de este producto.</p>
      </section>
    );
  }

  const t = (s: string | null) => (s ? new Date(s).getTime() : ahora);
  const inicio = Math.min(...historial.map(h => t(h.valido_desde)));
  const tienda = (id: number) => ofertas.find(o => o.id === id)?.tienda ?? 'una tienda';

  const cambios: Cambio[] = ofertas.flatMap(o => {
    const tramos = historial.filter(h => h.oferta_id === o.id);
    return tramos.slice(1).flatMap((h, i) => {
      const previo = tramos[i]!;
      return previo.precio === h.precio ? [] : [{ tienda: o.tienda, de: previo.precio, a: h.precio, cuando: h.valido_desde }];
    });
  }).sort((a, b) => t(b.cuando) - t(a.cuando));

  const minimo = historial.reduce((a, b) => (b.precio < a.precio ? b : a));
  const resumen = precioHoy !== null && precioHoy <= minimo.precio
    ? `Hoy está en su precio más bajo desde el ${diaCorto(inicio)}.`
    : `El más bajo fue ${precio(minimo.precio)} en ${tienda(minimo.oferta_id)}, el ${diaCorto(minimo.valido_desde)}.${
        precioHoy !== null ? ` Hoy está ${precio(precioHoy - minimo.precio)} por encima.` : ''}`;

  const precios = historial.map(h => h.precio);
  const plano = Math.min(...precios) === Math.max(...precios);
  // Con un precio que no cambió basta una línea de referencia; el eje no repite el mismo importe tres veces.
  const min = Math.min(...precios) * (plano ? 0.9 : 0.97);
  const max = Math.max(...precios) * (plano ? 1.1 : 1.03);
  const marcas = plano ? [precios[0]!] : [min, (min + max) / 2, max];
  const etiqueta = (p: number) => precio(max < 20 ? p : Math.round(p));
  // Lienzo de 480 × 230 que se encoge con la tarjeta. Los nombres de tienda van en la leyenda (a la derecha desde 1024 px), no dentro del SVG.
  const [an, al, izq, der, abajo] = [480, 230, 82, 14, 30];
  const x = (ms: number) => izq + ((ms - inicio) / (ahora - inicio || 1)) * (an - izq - der);
  const y = (p: number) => 10 + (1 - (p - min) / (max - min || 1)) * (al - abajo - 10);

  const series = ofertas.map((o, i) => {
    const tramos = historial.filter(h => h.oferta_id === o.id);
    const d = tramos.map((h, j) => `${j === 0 ? 'M' : 'L'}${x(t(h.valido_desde))},${y(h.precio)} L${x(t(h.valido_hasta))},${y(h.precio)}`).join(' ');
    return { o, d, ultimo: tramos.at(-1), color: `var(--serie-${(i % 6) + 1})` };
  }).filter(s => s.d && s.ultimo);

  return (
    <section className="historial-precios">
      {titulo}
      {(() => {
        const ty = plano ? marcas : [0, 1 / 3, 2 / 3, 1].map(f => min + (max - min) * f);
        const dias = Math.round((ahora - inicio) / 86_400_000);
        const tx = dias >= 2 ? [0, 1 / 3, 2 / 3, 1].map(f => inicio + (ahora - inicio) * f) : [inicio, ahora];
        const base = al - abajo;
        const atras = [...series].sort((a, b) => b.ultimo!.precio - a.ultimo!.precio);
        const leyenda = [...series].sort((a, b) => a.ultimo!.precio - b.ultimo!.precio);
        return (
          <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_15rem] lg:items-start">
            <figure>
              <svg viewBox={`0 0 ${an} ${al}`} className="block w-full" role="img" aria-label={`Historial de precios por tienda. ${resumen}`}>
                {ty.map(p => (
                  <g key={p}>
                    <line x1={izq} x2={an - der} y1={y(p)} y2={y(p)} stroke="var(--borde)" />
                    <text x={izq - 6} y={y(p) + 4} textAnchor="end" className="eje" fill="var(--suave)">{etiqueta(p)}</text>
                  </g>
                ))}
                <line x1={izq} x2={an - der} y1={base} y2={base} stroke="var(--borde-control)" />
                {tx.map((ms, i) => (
                  <text key={ms} x={x(ms)} y={al - 6} className="eje" fill="var(--suave)" textAnchor={i === 0 ? 'start' : i === tx.length - 1 ? 'end' : 'middle'}>
                    {i === tx.length - 1 ? 'hoy' : diaCorto(ms)}
                  </text>
                ))}
                {atras.map(s => {
                  const desde = Math.min(...historial.filter(h => h.oferta_id === s.o.id).map(h => t(h.valido_desde)));
                  return (
                    <g key={s.o.id}>
                      <path d={`${s.d} L${x(ahora)},${base} L${x(desde)},${base} Z`} fill={s.color} fillOpacity="0.14" stroke="none" />
                      <path d={s.d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
                    </g>
                  );
                })}
              </svg>
            </figure>
            <ul className="flex flex-col gap-2.5 lg:pt-2">
              <li className="sr-only">Precio de hoy por tienda:</li>
              {leyenda.map(s => (
                <li key={s.o.id} className="flex items-center gap-2.5">
                  <span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{ background: s.color }} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{s.o.tienda}</span>
                  <span className="tabular-nums text-suave">{precio(s.ultimo!.precio)}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}
      <p className="mt-4 text-sm text-suave">Solo se guarda un tramo nuevo cuando el precio o la disponibilidad cambian.</p>
      {cambios.length > 0 && <ListaCambios cambios={cambios.slice(0, 6)} />}
    </section>
  );
}

function ListaCambios({ cambios }: { cambios: Cambio[] }) {
  return (
    <>
      <h3 className="mt-5 font-bold">Cambios registrados</h3>
      <ul className="mt-1 divide-y divide-borde border-y border-borde text-sm">
        {cambios.map((c, i) => (
          <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2">
            <span><strong>{c.tienda}</strong> {c.a < c.de ? 'bajó' : 'subió'} de <span className="tabular-nums">{precio(c.de)}</span> a <strong className="tabular-nums">{precio(c.a)}</strong></span>
            <span className="text-suave">{diaCorto(c.cuando)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
