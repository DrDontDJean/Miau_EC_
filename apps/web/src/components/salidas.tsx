import Link from 'next/link';
import { RAPIDAS, rutaBusqueda } from '@/lib/rapidas';

/** Salidas para estados vacíos y de error: las mismas búsquedas rápidas de la cabecera. */
export function SalidasRapidas({ titulo = 'Prueba con una de estas búsquedas' }: { titulo?: string }) {
  return (
    <div className="mt-6">
      <p className="font-semibold">{titulo}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {RAPIDAS.map(r => (
          <li key={r.q}>
            <Link href={rutaBusqueda(r.q)} className="flex min-h-11 items-center rounded-lg border border-arena px-4 font-semibold transition-colors hover:bg-seccion">
              {r.etiqueta}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
