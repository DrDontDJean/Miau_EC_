import type { Periodo } from '@/lib/datos';
import type { Oferta } from '@/lib/catalogo';
import { diaCorto, diasEntre, leido } from '@/lib/fechas';
import { precio } from './ofertas';

/** Con menos días que esto no hay evolución que dibujar: se dice con palabras. */
const DIAS_MINIMOS = 7;

// El color repite paleta; el trazo es lo que distingue cada tienda.
const TRAZOS = ['', '8 5', '2 4', '12 4 2 4', '1 5'];

type Cambio = { tienda: string; de: number; a: number; cuando: string };

/** Escalones de precio por tienda (SCD2: cada periodo es un tramo horizontal). */
export function GraficoHistorial({ historial, ofertas, ahora, desde: precioHoy }: { historial: Periodo[]; ofertas: Oferta[]; ahora: number; desde: number | null }) {
  const titulo = <h2 className="text-xl font-bold">Historial de precios</h2>;
  if (!historial.length) {
    return (
      <section>
        {titulo}
        <p className="mt-2 max-w-[65ch] text-suave">Todavía no guardamos historial de este producto. Aparecerá aquí cuando lo leamos varios días seguidos.</p>
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

  if (diasEntre(inicio, ahora) < DIAS_MINIMOS) {
    return (
      <section>
        {titulo}
        <p className="mt-2 max-w-[65ch]">
          Guardamos el precio de este producto desde el {diaCorto(inicio)}. Con una semana de datos verás aquí cómo cambia en cada tienda.
        </p>
        {cambios.length === 0
          ? <p className="mt-1 text-suave">Desde entonces no ha cambiado en ninguna tienda.</p>
          : <ListaCambios cambios={cambios} />}
      </section>
    );
  }

  const minimo = historial.reduce((a, b) => (b.precio < a.precio ? b : a));
  const resumen = precioHoy !== null && precioHoy <= minimo.precio
    ? `Hoy está en su precio más bajo desde el ${diaCorto(inicio)}.`
    : `El más bajo fue ${precio(minimo.precio)} en ${tienda(minimo.oferta_id)}, el ${diaCorto(minimo.valido_desde)}.${
        precioHoy !== null ? ` Hoy está ${precio(precioHoy - minimo.precio)} por encima.` : ''}`;

  const precios = historial.map(h => h.precio);
  const min = Math.min(...precios) * 0.97;
  const max = Math.max(...precios) * 1.03;
  // Lienzo estrecho: se lee sin desplazarse en un teléfono. Las etiquetas viven en la leyenda, no en el SVG.
  const [an, al, izq, der, abajo] = [480, 230, 82, 14, 30];
  const x = (ms: number) => izq + ((ms - inicio) / (ahora - inicio)) * (an - izq - der);
  const y = (p: number) => 10 + (1 - (p - min) / (max - min || 1)) * (al - abajo - 10);

  const series = ofertas.map((o, i) => {
    const tramos = historial.filter(h => h.oferta_id === o.id);
    const d = tramos.map((h, j) => `${j === 0 ? 'M' : 'L'}${x(t(h.valido_desde))},${y(h.precio)} L${x(t(h.valido_hasta))},${y(h.precio)}`).join(' ');
    return { o, d, ultimo: tramos.at(-1), color: `var(--serie-${(i % 5) + 1})`, trazo: TRAZOS[i % TRAZOS.length]! };
  }).filter(s => s.d && s.ultimo);

  return (
    <section>
      {titulo}
      <p className="mt-2 max-w-[65ch] font-semibold">{resumen}</p>
      <figure className="mt-4 rounded-xl border border-borde bg-superficie p-3 sm:p-4">
        <svg viewBox={`0 0 ${an} ${al}`} className="w-full max-w-xl" role="img" aria-label={`Historial de precios por tienda. ${resumen}`}>
          {[min, (min + max) / 2, max].map(p => (
            <g key={p}>
              <line x1={izq} x2={an - der} y1={y(p)} y2={y(p)} stroke="var(--borde)" />
              <text x={izq - 6} y={y(p) + 4} textAnchor="end" className="eje" fill="var(--suave)">{precio(Math.round(p))}</text>
            </g>
          ))}
          <text x={izq} y={al - 6} className="eje" fill="var(--suave)">{diaCorto(inicio)}</text>
          <text x={an - der} y={al - 6} className="eje" fill="var(--suave)" textAnchor="end">hoy</text>
          {series.map(s => (
            <g key={s.o.id}>
              <path d={s.d} fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.trazo} />
              <circle cx={x(ahora)} cy={y(s.ultimo!.precio)} r="5" fill="var(--cian)" stroke="var(--en-cian)" strokeWidth="1.5" />
            </g>
          ))}
        </svg>
        <figcaption className="mt-3">
          <span className="sr-only">Precio de hoy por tienda:</span>
          <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {series.map(s => (
              <li key={s.o.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <svg viewBox="0 0 28 6" aria-hidden="true" className="h-1.5 w-7 shrink-0">
                  <line x1="0" x2="28" y1="3" y2="3" stroke={s.color} strokeWidth="3" strokeDasharray={s.trazo} />
                </svg>
                <span className="font-semibold">{s.o.tienda}</span>
                <span className="inline-flex overflow-hidden rounded text-sm">
                  <strong className="bg-cian px-1.5 text-en-cian tabular-nums">{precio(s.o.precio)}</strong>
                  <span className="bg-arena-fondo px-1.5">leído {leido(s.o.vistoUltimaVez, ahora)}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-suave">El punto cian marca el precio de hoy. Solo guardamos un tramo nuevo cuando el precio o el stock cambian.</p>
        </figcaption>
      </figure>
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
