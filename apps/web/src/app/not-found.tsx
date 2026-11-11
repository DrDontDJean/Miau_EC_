import Link from 'next/link';

export default function NoEncontrado() {
  return (
    <section className="py-10">
      <h1 className="font-display text-2xl font-extrabold">No encontramos esa página</h1>
      <p className="mt-2 text-suave">El producto pudo dejar de venderse o el enlace está incompleto.</p>
      <Link href="/" className="mt-4 inline-block font-semibold text-acento underline">Volver al inicio</Link>
    </section>
  );
}
