'use client'; // Los límites de error de Next son componentes de cliente.

// Pantalla para un fallo de la base (por ejemplo, una consulta que pasó del tiempo límite). Nunca se muestra como
// "Sin resultados" y nunca muestra el texto técnico del error: en producción Next solo entrega un identificador.
import { useEffect } from 'react';
import { SalidasRapidas } from '@/components/salidas';

export default function ErrorDePagina({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <section className="py-6" role="alert">
      <h1 className="text-3xl font-extrabold tracking-tight">No pudimos cargar esta página</h1>
      <p className="mt-2 max-w-[60ch] text-suave">Intente de nuevo en unos segundos. Si el problema sigue, vuelva al inicio o busque otro producto.</p>
      <button
        type="button" onClick={() => retry()}
        className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-accion px-5 font-bold text-white transition-colors hover:opacity-90"
      >
        Intentar de nuevo
      </button>
      <SalidasRapidas />
    </section>
  );
}
