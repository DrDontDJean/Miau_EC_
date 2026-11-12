'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { RAPIDAS, rutaBusqueda } from '@/lib/rapidas';

/** Formulario GET normal: funciona aunque el JavaScript no haya cargado. Sin hooks: sirve de fallback. */
export function FormularioBusqueda({ q = '' }: { q?: string }) {
  return (
    <form action="/buscar" role="search" className="flex min-w-0 flex-1 basis-64">
      <label htmlFor="q" className="sr-only">Producto a buscar</label>
      <input
        id="q" name="q" type="search" defaultValue={q} key={q} required minLength={2} maxLength={80}
        placeholder="¿Qué está buscando?"
        className="buscador-campo h-11 min-w-0 flex-1 rounded-l-full border-0 bg-white pr-4 pl-11 text-base text-[#36364f] placeholder:text-[#5f6070]"
      />
      <button type="submit" className="h-11 rounded-r-full bg-cian px-5 font-semibold text-en-cian transition-[filter] hover:brightness-95">
        Buscar
      </button>
    </form>
  );
}

/** El mismo formulario, con la búsqueda actual de la URL ya escrita. Va dentro de <Suspense>. */
export function Buscador() {
  return <FormularioBusqueda q={useSearchParams().get('q') ?? ''} />;
}

/** Pestañas de búsquedas rápidas. `activa` es la búsqueda en curso; sin ella ninguna queda marcada. */
export function ListaPestanas({ activa = '' }: { activa?: string }) {
  return (
    <nav aria-label="Búsquedas rápidas" className="border-t border-white/15">
      <ul className="sin-barra mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 sm:justify-center sm:px-4">
        {RAPIDAS.map(r => {
          const actual = r.q === activa;
          return (
            <li key={r.q} className="shrink-0">
              <Link
                href={rutaBusqueda(r.q)} aria-current={actual ? 'page' : undefined}
                className={`flex h-11 items-center border-b-[3px] px-3 text-sm font-semibold tracking-[0.08em] uppercase transition-colors ${actual ? 'border-en-cabecera text-en-cabecera' : 'border-transparent text-en-cabecera-suave hover:border-white/40 hover:text-en-cabecera'}`}
              >
                {r.etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Marca la pestaña que coincide con la búsqueda de la URL. Va dentro de <Suspense>. */
function PestanasActivas() {
  const enBuscar = usePathname() === '/buscar';
  const q = (useSearchParams().get('q') ?? '').trim().toLowerCase();
  return <ListaPestanas activa={enBuscar ? q : ''} />;
}

/** Pestañas de la cabecera. En la portada y en /buscar no van: allí las categorías están en el banner. */
export function Pestanas() {
  const ruta = usePathname();
  if (ruta === '/' || ruta === '/buscar') return null;
  return (
    <Suspense fallback={<ListaPestanas />}>
      <PestanasActivas />
    </Suspense>
  );
}
