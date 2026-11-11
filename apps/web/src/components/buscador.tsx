'use client';
import { useSearchParams } from 'next/navigation';

/** Formulario GET normal: funciona aunque el JavaScript no haya cargado. Sin hooks: sirve de fallback. */
export function FormularioBusqueda({ q = '' }: { q?: string }) {
  return (
    <form action="/buscar" role="search" className="flex min-w-64 flex-1">
      <label htmlFor="q" className="sr-only">Producto a buscar</label>
      <input
        id="q" name="q" type="search" defaultValue={q} key={q} required minLength={2} maxLength={80}
        placeholder="Busca un producto: televisor 55, refrigeradora, laptop…"
        className="min-w-0 flex-1 rounded-l-lg border-0 bg-white px-4 py-2.5 text-base text-[#1a2033] placeholder:text-[#59627a]"
      />
      <button type="submit" className="rounded-r-lg bg-amarillo px-5 font-display font-semibold text-en-amarillo hover:brightness-95">
        Comparar
      </button>
    </form>
  );
}

/** El mismo formulario, con la búsqueda actual de la URL ya escrita. Va dentro de <Suspense>. */
export function Buscador() {
  return <FormularioBusqueda q={useSearchParams().get('q') ?? ''} />;
}
