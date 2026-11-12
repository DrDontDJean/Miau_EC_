import Link from 'next/link';
import { productosDestacados, tiendasActivas } from '@/lib/datos';
import { RejillaProductos } from '@/components/ofertas';
import { RAPIDAS, rutaBusqueda } from '@/lib/rapidas';

export default async function Inicio() {
  const [destacados, tiendas] = await Promise.all([productosDestacados(), tiendasActivas()]);
  const escaparate = destacados.slice(0, 3);
  const resto = destacados.slice(3);
  return (
    <div className="flex flex-col gap-8">
      <section className="en-cabecera grid items-center gap-8 overflow-hidden rounded-2xl bg-cabecera px-6 py-10 text-en-cabecera sm:px-10 md:grid-cols-[1.2fr_1fr]">
        <div>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Encuentre el precio más bajo</h1>
          <p className="mt-2 text-lg text-en-cabecera-suave">El mismo producto, comparado en {tiendas.length} tiendas online de Ecuador.</p>
          <ul className="mt-6 flex flex-wrap gap-2">
            <li><span aria-current="page" className="inline-flex min-h-11 items-center rounded-full bg-white px-4 font-semibold text-[#1f1f33]">Todo</span></li>
            {RAPIDAS.map(r => (
              <li key={r.q}>
                <Link href={rutaBusqueda(r.q)} className="inline-flex min-h-11 items-center rounded-full border border-white/60 px-4 font-semibold transition-colors hover:bg-white/10">{r.etiqueta}</Link>
              </li>
            ))}
          </ul>
        </div>
        {escaparate.length > 0 && (
          <ul className="flex items-end justify-center gap-3">
            {escaparate.map((p, i) => (
              <li key={p.id} className={i === 1 ? 'w-2/5' : 'w-1/3'}>
                <Link href={`/p/${p.id}`} className="block aspect-square rounded-full bg-white p-4 sm:p-6">
                  {p.imagen_url && <img src={p.imagen_url} alt={p.titulo} referrerPolicy="no-referrer" className="size-full object-contain" />}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {resto.length > 0 && (
        <section>
          <h2 className="mb-5 text-2xl font-bold">Productos en varias tiendas</h2>
          <RejillaProductos
            nivel="h3"
            productos={resto.map(p => ({ id: p.id, titulo: p.titulo, imagen: p.imagen_url, desde: p.precio_desde, numTiendas: p.num_tiendas }))}
          />
        </section>
      )}

      <p className="text-sm text-suave">
        Tiendas incluidas: {tiendas.map(t => t.nombre).join(' · ')}.{' '}
        <Link href="/tiendas" className="font-semibold text-enlace underline">Última lectura de cada tienda</Link>
      </p>
    </div>
  );
}
