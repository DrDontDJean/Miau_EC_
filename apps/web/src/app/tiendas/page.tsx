import type { Metadata } from 'next';
import { tiendasActivas } from '@/lib/datos';

export const metadata: Metadata = { title: 'Tiendas', description: 'Tiendas incluidas en el comparador y su última actualización.' };

const PLATAFORMA: Record<string, string> = { vtex: 'Catálogo público VTEX', woocommerce: 'API de tienda WooCommerce', feed: 'Feed acordado con la tienda' };

export default async function Tiendas() {
  const tiendas = await tiendasActivas();
  return (
    <section className="max-w-3xl">
      <h1 className="font-display text-2xl font-extrabold">Tiendas incluidas</h1>
      <p className="mt-2 text-suave">
        Leemos el catálogo de cada tienda una vez al día, de madrugada, a un ritmo de una petición por segundo y solo si su robots.txt lo permite.
        Las tiendas que lo prohíben no se incluyen hasta que acuerden enviarnos un feed.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-borde bg-superficie">
        <table className="w-full text-left text-sm">
          <thead className="bg-acento-suave text-acento">
            <tr><th className="px-4 py-2">Tienda</th><th className="px-4 py-2">Fuente</th><th className="px-4 py-2">Última corrida completa</th></tr>
          </thead>
          <tbody>
            {tiendas.map(t => (
              <tr key={t.id} className="border-t border-borde">
                <td className="px-4 py-2"><a href={t.origen} rel="noopener" className="font-semibold hover:underline">{t.nombre}</a></td>
                <td className="px-4 py-2 text-suave">{PLATAFORMA[t.plataforma] ?? t.plataforma}</td>
                <td className="px-4 py-2 tabular-nums">
                  {t.ultima_corrida_ok
                    ? new Date(t.ultima_corrida_ok).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guayaquil' })
                    : <span className="text-suave">Pendiente</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
