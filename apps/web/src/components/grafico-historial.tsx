import type { Periodo } from '@/lib/datos';
import type { Oferta } from '@/lib/catalogo';
import { precio } from './ofertas';

const COLORES = ['#0b3d91', '#c2410c', '#0f7a43', '#7c3aed', '#b91c1c', '#0e7490'];

/** Escalones de precio por tienda (SCD2: cada periodo es un tramo horizontal). */
export function GraficoHistorial({ historial, ofertas, ahora }: { historial: Periodo[]; ofertas: Oferta[]; ahora: number }) {
  if (!historial.length) return null;
  const t = (s: string | null) => (s ? new Date(s).getTime() : ahora);
  // "hoy" siempre en el borde derecho; con poco historial se amplía hacia el pasado, no hacia el futuro.
  const hasta = ahora;
  const desde = Math.min(...historial.map(h => t(h.valido_desde)), ahora - 3_600_000);
  const precios = historial.map(h => h.precio);
  const min = Math.min(...precios) * 0.95;
  const max = Math.max(...precios) * 1.05;
  const [an, al, izq, abajo] = [640, 220, 72, 28];
  const x = (ms: number) => izq + ((ms - desde) / (hasta - desde)) * (an - izq - 12);
  const y = (p: number) => 10 + (1 - (p - min) / (max - min || 1)) * (al - abajo - 10);
  const fecha = (ms: number) => new Date(ms).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' });

  const series = ofertas.map((o, i) => {
    const tramos = historial.filter(h => h.oferta_id === o.id);
    const d = tramos.map((h, j) => `${j === 0 ? 'M' : 'L'}${x(t(h.valido_desde))},${y(h.precio)} L${x(t(h.valido_hasta))},${y(h.precio)}`).join(' ');
    return { o, d, color: COLORES[i % COLORES.length]! };
  }).filter(s => s.d);

  return (
    <figure className="rounded-xl border border-borde bg-superficie p-4">
      <figcaption className="mb-2 font-display font-semibold">Historial de precios</figcaption>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${an} ${al}`} className="w-full min-w-[480px]" role="img" aria-label="Historial de precios por tienda">
          {[min, (min + max) / 2, max].map(p => (
            <g key={p}>
              <line x1={izq} x2={an - 12} y1={y(p)} y2={y(p)} stroke="var(--borde)" />
              <text x={izq - 8} y={y(p) + 4} textAnchor="end" fontSize="11" fill="var(--suave)">{precio(Math.round(p))}</text>
            </g>
          ))}
          <text x={izq} y={al - 8} fontSize="11" fill="var(--suave)">{fecha(desde)}</text>
          <text x={an - 12} y={al - 8} fontSize="11" fill="var(--suave)" textAnchor="end">hoy</text>
          {series.map(s => <path key={s.o.id} d={s.d} fill="none" stroke={s.color} strokeWidth="2.5" />)}
        </svg>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {series.map(s => (
          <li key={s.o.id} className="flex items-center gap-1.5">
            <span className="inline-block h-1 w-4 rounded" style={{ background: s.color }} /> {s.o.tienda}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-suave">Solo se guarda un tramo nuevo cuando el precio o la disponibilidad cambian.</p>
    </figure>
  );
}
