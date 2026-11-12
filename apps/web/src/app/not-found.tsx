import Link from 'next/link';
import { SalidasRapidas } from '@/components/salidas';

export default function NoEncontrado() {
  return (
    <section className="py-6">
      <h1 className="text-3xl font-extrabold tracking-tight">Página no encontrada</h1>
      <p className="mt-2 max-w-[60ch] text-suave">
        El enlace puede estar incompleto o la página ya no existe. Si buscaba un producto, es posible que ya no se venda.
      </p>
      <SalidasRapidas />
      <p className="mt-6">
        <Link href="/" className="inline-flex min-h-11 items-center font-semibold text-enlace underline">Volver al inicio</Link>
      </p>
    </section>
  );
}
