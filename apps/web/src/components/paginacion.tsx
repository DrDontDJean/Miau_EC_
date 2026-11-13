import Link from 'next/link';

/**
 * Qué números de página mostrar: la primera, la última y las vecinas de la actual, con "…" donde se salta.
 * Con 20 páginas y la 9 actual: 1 … 7 8 9 10 11 … 20. Con pocas páginas se muestran todas.
 */
export function numerosVisibles(actual: number, paginas: number, vecinas = 2): (number | '…')[] {
  if (paginas <= 2 * vecinas + 5) return Array.from({ length: paginas }, (_, i) => i + 1);
  const desde = Math.max(2, actual - vecinas);
  const hasta = Math.min(paginas - 1, actual + vecinas);
  const salida: (number | '…')[] = [1];
  // Un "…" que esconde una sola página es peor que mostrarla.
  if (desde > 3) salida.push('…'); else if (desde === 3) salida.push(2);
  for (let n = desde; n <= hasta; n++) salida.push(n);
  if (hasta < paginas - 2) salida.push('…'); else if (hasta === paginas - 2) salida.push(paginas - 1);
  salida.push(paginas);
  return salida;
}

const base = 'flex min-h-11 min-w-11 items-center justify-center rounded-lg border px-3 text-sm font-semibold';

/** Paginación con enlaces normales (funciona sin JavaScript). La página actual lleva marca, no solo color. */
export function Paginacion({ actual, paginas, href }: { actual: number; paginas: number; href: (n: number) => string }) {
  if (paginas <= 1) return null;
  const numeros = numerosVisibles(actual, paginas);
  return (
    <nav aria-label="Páginas de resultados" className="mt-2">
      <ul className="flex flex-wrap items-center justify-center gap-2">
        <li>
          {actual > 1
            ? <Link href={href(actual - 1)} rel="prev" className={`${base} border-borde-control text-texto hover:bg-seccion`}>Anterior</Link>
            : <span aria-disabled="true" className={`${base} border-borde text-suave`}>Anterior</span>}
        </li>
        {numeros.map((n, i) => (
          <li key={`${n}-${i}`}>
            {n === '…'
              ? <span aria-hidden="true" className="flex min-h-11 min-w-8 items-center justify-center text-suave">…</span>
              : (
                <Link
                  href={href(n)} aria-current={n === actual ? 'page' : undefined} aria-label={`Página ${n}`}
                  className={`${base} tabular-nums ${n === actual ? 'border-cian bg-cian text-en-cian' : 'border-borde-control text-texto hover:bg-seccion'}`}
                >
                  {n}
                </Link>
              )}
          </li>
        ))}
        <li>
          {actual < paginas
            ? <Link href={href(actual + 1)} rel="next" className={`${base} border-borde-control text-texto hover:bg-seccion`}>Siguiente</Link>
            : <span aria-disabled="true" className={`${base} border-borde text-suave`}>Siguiente</span>}
        </li>
      </ul>
      <p className="mt-2 text-center text-sm text-suave">Página {actual} de {paginas}</p>
    </nav>
  );
}
