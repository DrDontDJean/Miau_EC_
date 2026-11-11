import Link from 'next/link';
import { productosDestacados, tiendasActivas } from '@/lib/datos';
import { RejillaProductos } from '@/components/ofertas';

// Solo hechos que se pueden comprobar en el propio sitio: sin cifras ni testimonios.
const HECHOS = [
  { titulo: 'El mismo producto', texto: 'Solo juntamos ofertas que comparten código de barras (EAN) o código de modelo del fabricante.' },
  { titulo: 'El precio de la tienda', texto: 'Mostramos el precio que cada tienda publica en su web.' },
  { titulo: 'Actualizado cada día', texto: 'Leemos los catálogos una vez al día. En cada producto ves a qué hora leímos el precio de cada tienda.' },
  { titulo: 'Sin patrocinios', texto: 'Ninguna tienda paga por aparecer primero: el orden lo decide el precio.' },
];

export default async function Inicio() {
  const [destacados, tiendas] = await Promise.all([productosDestacados(), tiendasActivas()]);
  return (
    <div className="flex flex-col gap-8 sm:gap-12">
      <section>
        <h1 className="max-w-[22ch] text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">Compara precios entre tiendas de Ecuador</h1>
        <p className="mt-3 max-w-[62ch] text-lg text-suave">
          Juntamos las ofertas del mismo producto en {tiendas.length} tiendas online y te mostramos dónde está más barato.
        </p>
      </section>

      {destacados.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-bold">Productos en varias tiendas</h2>
          <RejillaProductos
            nivel="h3"
            productos={destacados.map(p => ({ id: p.id, titulo: p.titulo, imagen: p.imagen_url, desde: p.precio_desde, numTiendas: p.num_tiendas }))}
          />
        </section>
      )}

      <section id="como-comparamos" className="scroll-mt-40 rounded-2xl bg-arena-fondo px-5 py-8 sm:px-8">
        <h2 className="text-xl font-bold">Cómo comparamos</h2>
        <dl className="mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {HECHOS.map(h => (
            <div key={h.titulo}>
              <dt className="font-bold">{h.titulo}</dt>
              <dd className="mt-1 text-sm leading-relaxed">{h.texto}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="text-xl font-bold">Tiendas incluidas</h2>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-lg">
          {tiendas.map(t => <li key={t.id}>{t.nombre}</li>)}
        </ul>
        <p className="mt-3">
          <Link href="/tiendas" className="inline-flex min-h-11 items-center font-semibold text-enlace underline">Ver cuándo leímos cada tienda</Link>
        </p>
      </section>
    </div>
  );
}
