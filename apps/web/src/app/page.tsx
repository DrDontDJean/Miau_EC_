import Link from 'next/link';
import { productosDestacados, tiendasActivas } from '@/lib/datos';
import { precio } from '@/components/ofertas';

const SUGERENCIAS = ['televisor 55', 'refrigeradora', 'laptop', 'lavadora', 'samsung'];

export default async function Inicio() {
  const [destacados, tiendas] = await Promise.all([productosDestacados(), tiendasActivas()]);
  return (
    <div className="flex flex-col gap-10">
      <section className="py-6">
        <h1 className="font-display text-3xl font-extrabold text-acento sm:text-4xl">Compara precios entre tiendas de Ecuador</h1>
        <p className="mt-3 max-w-[62ch] text-lg text-suave">
          Reunimos los catálogos de {tiendas.length} tiendas online, agrupamos el mismo producto y te mostramos dónde está más barato.
          Al elegir una oferta, vas directo a la tienda.
        </p>
        <ul className="mt-5 flex flex-wrap gap-2">
          {SUGERENCIAS.map(s => (
            <li key={s}>
              <Link href={`/buscar?q=${encodeURIComponent(s)}`} className="rounded-full bg-acento-suave px-4 py-1.5 text-acento hover:underline">{s}</Link>
            </li>
          ))}
        </ul>
      </section>

      {destacados.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-semibold">Comparaciones destacadas</h2>
          <p className="text-sm text-suave">Productos que encontramos en más de una tienda.</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {destacados.map(p => (
              <li key={p.id}>
                <Link href={`/p/${p.id}`} className="flex h-full items-center gap-3 rounded-xl border border-borde bg-superficie p-3 hover:border-acento">
                  <span className="grid size-16 shrink-0 place-items-center">
                    {p.imagen_url && <img src={p.imagen_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-contain" />}
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 font-display leading-snug">{p.titulo}</span>
                    <span className="mt-1 block text-sm text-suave">
                      <strong className="text-acento tabular-nums">desde {precio(p.precio_desde)}</strong> · {p.num_tiendas} tiendas
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-display text-xl font-semibold">Tiendas incluidas</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {tiendas.map(t => (
            <li key={t.id} className="rounded-full border border-borde bg-superficie px-3 py-1 text-sm">{t.nombre}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
