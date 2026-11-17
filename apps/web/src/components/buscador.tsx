'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useId, useRef, useState } from 'react';
import type { Sugerencia } from '@/lib/catalogo';
import { RAPIDAS } from '@/lib/rapidas';

const dolares = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });

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

/**
 * El mismo formulario GET, con la búsqueda de la URL ya escrita y sugerencias mientras se escribe (patrón ARIA
 * combobox con listbox). Desde 2 letras, 200 ms después de la última tecla; cancela la petición anterior y no muestra
 * nada si la respuesta tarda más de 1 s o falla. Flechas para recorrer, Enter para ir a la sugerencia elegida (sin
 * elegir, Enter hace la búsqueda normal) y Escape para cerrar. Va dentro de <Suspense>.
 */
export function Buscador() {
  const q = useSearchParams().get('q') ?? '';
  return <FormularioConSugerencias key={q} q={q} />;
}

function FormularioConSugerencias({ q }: { q: string }) {
  const router = useRouter();
  const idLista = useId();
  const [texto, setTexto] = useState(q);
  const [lista, setLista] = useState<Sugerencia[]>([]);
  const [abierta, setAbierta] = useState(false);
  const [activa, setActiva] = useState(-1);
  const escrito = useRef(false); // no sugerir al cargar la página con la búsqueda ya escrita

  useEffect(() => {
    const t = texto.trim();
    if (!escrito.current || t.length < 2) { setLista([]); return; }
    const control = new AbortController();
    const espera = setTimeout(async () => {
      const limite = setTimeout(() => control.abort(), 1000);
      try {
        const r = await fetch(`/api/sugerencias?q=${encodeURIComponent(t)}`, { signal: control.signal });
        const cuerpo = r.ok ? await r.json() as { sugerencias?: Sugerencia[] } : null;
        setLista(cuerpo?.sugerencias ?? []);
        setActiva(-1);
      } catch {
        setLista([]); // cancelada, lenta o sin red: el usuario siempre puede pulsar "Buscar"
      } finally {
        clearTimeout(limite);
      }
    }, 200);
    return () => { clearTimeout(espera); control.abort(); };
  }, [texto]);

  const visible = abierta && lista.length > 0;
  const ir = (s: Sugerencia) => { setAbierta(false); router.push(s.href); };

  return (
    <form action="/buscar" role="search" className="relative flex min-w-0 flex-1 basis-64">
      <label htmlFor="q" className="sr-only">Producto a buscar</label>
      <input
        id="q" name="q" type="search" value={texto} required minLength={2} maxLength={80} autoComplete="off"
        placeholder="¿Qué está buscando?"
        role="combobox" aria-autocomplete="list" aria-expanded={visible} aria-controls={idLista}
        aria-activedescendant={visible && activa >= 0 ? `${idLista}-${activa}` : undefined}
        onChange={e => { escrito.current = true; setTexto(e.target.value); setAbierta(true); }}
        onFocus={() => setAbierta(true)}
        onBlur={() => setAbierta(false)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown' && lista.length) { e.preventDefault(); setAbierta(true); setActiva(i => (i + 1) % lista.length); }
          else if (e.key === 'ArrowUp' && lista.length) { e.preventDefault(); setAbierta(true); setActiva(i => (i <= 0 ? lista.length - 1 : i - 1)); }
          else if (e.key === 'Escape' && visible) { e.preventDefault(); setAbierta(false); setActiva(-1); }
          else if (e.key === 'Enter' && visible && activa >= 0) { e.preventDefault(); ir(lista[activa]!); }
        }}
        className="buscador-campo h-11 min-w-0 flex-1 rounded-l-full border-0 bg-white pr-4 pl-11 text-base text-[#36364f] placeholder:text-[#5f6070]"
      />
      <button type="submit" className="h-11 rounded-r-full bg-cian px-5 font-semibold text-en-cian transition-[filter] hover:brightness-95">
        Buscar
      </button>
      <ul
        id={idLista} role="listbox" aria-label="Sugerencias" hidden={!visible}
        className="absolute top-12 right-0 left-0 z-50 overflow-hidden rounded-2xl border border-borde bg-white py-1 text-[#36364f] shadow-lg"
      >
        {lista.map((s, i) => (
          <li
            key={s.href} id={`${idLista}-${i}`} role="option" aria-selected={i === activa}
            onMouseDown={e => e.preventDefault() /* que el campo no pierda el foco antes del clic */}
            onClick={() => ir(s)} onMouseEnter={() => setActiva(i)}
            className={`flex min-h-11 cursor-pointer items-center gap-3 px-4 py-2 ${i === activa ? 'bg-seccion shadow-[inset_3px_0_0_var(--cian)]' : ''}`}
          >
            <span className="min-w-0 flex-1 truncate">{s.texto}</span>
            <span className="shrink-0 text-sm text-[#5f6070]">
              {s.tipo === 'categoria' ? 'Categoría' : s.tipo === 'marca' ? 'Marca' : s.desde !== undefined ? `desde ${dolares.format(s.desde)}` : 'Producto'}
            </span>
          </li>
        ))}
      </ul>
      <p className="sr-only" aria-live="polite">{visible ? `${lista.length} sugerencias` : ''}</p>
    </form>
  );
}

/** Pestañas de las categorías. `activa` es la ruta de la categoría en curso; sin ella ninguna queda marcada. */
export function ListaPestanas({ activa = '' }: { activa?: string }) {
  return (
    <nav aria-label="Categorías de productos" className="border-t border-white/15">
      <ul className="sin-barra mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 sm:justify-center sm:px-4">
        {RAPIDAS.map(r => {
          const actual = r.href === activa;
          return (
            <li key={r.q} className="shrink-0">
              <Link
                href={r.href} aria-current={actual ? 'page' : undefined}
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

/** Marca la pestaña de la categoría en curso. */
function PestanasActivas() {
  return <ListaPestanas activa={usePathname()} />;
}

/** Pestañas de la cabecera. En la portada, en /buscar y en las categorías no van: allí las categorías están en el banner. */
export function Pestanas() {
  const ruta = usePathname();
  if (ruta === '/' || ruta === '/buscar' || ruta.startsWith('/categoria/')) return null;
  return (
    <Suspense fallback={<ListaPestanas />}>
      <PestanasActivas />
    </Suspense>
  );
}
