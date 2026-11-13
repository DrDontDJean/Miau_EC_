import type { Metadata } from 'next';
import { tiendasActivas } from '@/lib/datos';
import { diaCorto, horaCorta } from '@/lib/fechas';

export const metadata: Metadata = { title: 'Tiendas', description: 'Tiendas que compara DecideAquí y la última actualización de precios de cada una.' };

export default async function Tiendas() {
  const tiendas = await tiendasActivas();
  return (
    <section className="max-w-3xl">
      <h1 className="text-3xl font-extrabold tracking-tight">Tiendas que comparamos</h1>
      <p className="mt-2 max-w-[65ch] text-suave">
        Última actualización de precios de cada tienda.
      </p>
      <div className="mt-6 overflow-hidden rounded-2xl border border-borde bg-superficie">
        <table className="w-full text-left">
          <thead className="bg-seccion text-sm">
            <tr><th className="px-4 py-3">Tienda</th><th className="px-4 py-3">Última actualización</th></tr>
          </thead>
          <tbody>
            {tiendas.map(t => (
              <tr key={t.id} className="border-t border-borde">
                <td className="px-4 py-1">
                  <a href={t.origen} rel="noopener" className="inline-flex min-h-11 items-center font-bold text-enlace underline">{t.nombre}</a>
                  {t.plataforma === 'feed' && <span className="block pb-2 text-sm text-suave">Precios enviados por la tienda</span>}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {t.ultima_corrida_ok
                    ? `${diaCorto(t.ultima_corrida_ok)}, ${horaCorta(t.ultima_corrida_ok)}`
                    : <span className="font-semibold">Actualización pendiente</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
