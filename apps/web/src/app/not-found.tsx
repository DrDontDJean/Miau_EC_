import Link from 'next/link';
import { SalidasRapidas } from '@/components/salidas';

export default function NoEncontrado() {
  return (
    <section className="py-6">
      <h1 className="text-3xl font-extrabold tracking-tight">No encontramos esa página</h1>
      <p className="mt-2 max-w-[60ch] text-suave">
        El enlace puede estar incompleto o la página ya no existe. Si buscabas un producto, puede que las tiendas hayan dejado de venderlo.
        Búscalo de nuevo arriba o empieza por aquí.
      </p>
      <SalidasRapidas titulo="Empieza por aquí" />
      <p className="mt-6">
        <Link href="/" className="inline-flex min-h-11 items-center font-semibold text-enlace underline">Volver al inicio</Link>
      </p>
    </section>
  );
}
