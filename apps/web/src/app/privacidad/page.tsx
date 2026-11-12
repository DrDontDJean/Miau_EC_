import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Privacidad', description: 'Qué registra DecideAquí cuando usted va a una tienda.' };

// Describe lo que hacen /ir/[id] y la función registrar_salida: nada más.
export default function Privacidad() {
  return (
    <section className="max-w-3xl rounded-2xl bg-superficie p-6 sm:p-8">
      <h1 className="text-3xl font-extrabold tracking-tight">Privacidad</h1>
      <p className="mt-4 max-w-[65ch]">
        DecideAquí no pide registro ni guarda datos personales. Al pulsar «Ver oferta» o «Ir a» una tienda, se registra la visita de forma anónima antes de abrir la página de la tienda.
      </p>
      <h2 className="mt-8 text-xl font-bold">Qué se registra</h2>
      <ul className="mt-2 flex max-w-[65ch] list-disc flex-col gap-1 pl-5">
        <li>La oferta, la tienda y el producto que abrió.</li>
        <li>El precio que se mostraba en ese momento y la fecha.</li>
        <li>Un código anónimo que cambia cada día. No contiene su dirección IP ni permite identificarle.</li>
      </ul>
      <h2 className="mt-8 text-xl font-bold">Para qué se usa</h2>
      <p className="mt-2 max-w-[65ch]">
        Para saber cuántas visitas recibe cada tienda desde DecideAquí. El enlace a la tienda lleva la marca <code className="rounded bg-seccion px-1 text-sm">utm_source=decideaqui</code> para que la tienda sepa de dónde llega la visita.
      </p>
      <p className="mt-8">
        <Link href="/" className="inline-flex min-h-11 items-center font-semibold text-enlace underline">Volver al inicio</Link>
      </p>
    </section>
  );
}
