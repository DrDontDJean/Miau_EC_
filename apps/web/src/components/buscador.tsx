'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { RAPIDAS, rutaBusqueda } from '@/lib/rapidas';

/** Formulario GET normal: funciona aunque el JavaScript no haya cargado. Sin hooks: sirve de fallback. */
export function FormularioBusqueda({ q = '' }: { q?: string }) {
  return (
    <form action="/buscar" role="search" className="flex min-w-0 flex-1 basis-64">
      <label htmlFor="q" className="sr-only">Producto a buscar</label>
      <input
        id="q" name="q" type="search" defaultValue={q} key={q} required minLength={2} maxLength={80}
        placeholder="Busca un producto"
        className="h-11 min-w-0 flex-1 rounded-l-lg border border-r-0 border-arena bg-superficie px-4 text-base text-texto placeholder:text-suave"
      />
      <button type="submit" className="h-11 rounded-r-lg border border-borde-accion bg-accion px-5 font-semibold text-en-accion transition-colors hover:bg-accion-fuerte">
        Comparar
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
    <nav aria-label="Búsquedas rápidas" className="border-t border-borde">
      <ul className="sin-barra mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 sm:px-4">
        {RAPIDAS.map(r => {
          const actual = r.q === activa;
          return (
            <li key={r.q} className="shrink-0">
              <Link
                href={rutaBusqueda(r.q)} aria-current={actual ? 'page' : undefined}
                className={`flex h-11 items-center border-b-[3px] px-3 font-semibold transition-colors ${actual ? 'border-cian text-texto' : 'border-transparent text-suave hover:border-arena hover:text-texto'}`}
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
export function Pestanas() {
  const enBuscar = usePathname() === '/buscar';
  const q = (useSearchParams().get('q') ?? '').trim().toLowerCase();
  return <ListaPestanas activa={enBuscar ? q : ''} />;
}
