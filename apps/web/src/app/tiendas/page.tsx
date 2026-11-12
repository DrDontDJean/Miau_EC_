import type { Metadata } from 'next';
import { tiendasActivas } from '@/lib/datos';
import { diaCorto, horaCorta } from '@/lib/fechas';

export const metadata: Metadata = { title: 'Tiendas', description: 'Tiendas incluidas en el comparador y su última actualización.' };

export default async function Tiendas() {
  const tiendas = await tiendasActivas();
  return (
    <section className="max-w-3xl">
      <h1 className="text-3xl font-extrabold tracking-tight">Tiendas incluidas</h1>
      <p className="mt-2 max-w-[65ch] text-suave">
        Última lectura completa del catálogo de cada tienda, en hora de Ecuador.
      </p>
      <div className="mt-6 overflow-hidden rounded-2xl border border-borde bg-superficie">
        <table className="w-full text-left">
          <thead className="bg-seccion text-sm">
            <tr><th className="px-4 py-3">Tienda</th><th className="px-4 py-3">Última lectura completa</th></tr>
          </thead>
          <tbody>
            {tiendas.map(t => (
              <tr key={t.id} className="border-t border-borde">
                <td className="px-4 py-1">
                  <a href={t.origen} rel="noopener" className="inline-flex min-h-11 items-center font-bold text-enlace underline">{t.nombre}</a>
                  {t.plataforma === 'feed' && <span className="block pb-2 text-sm text-suave">Archivo enviado por la tienda</span>}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {t.ultima_corrida_ok
                    ? `${diaCorto(t.ultima_corrida_ok)}, ${horaCorta(t.ultima_corrida_ok)}`
                    : <span className="font-semibold">Última lectura incompleta · se reintenta cada día</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="mt-10 text-xl font-bold">Tiendas no incluidas</h2>
      <p className="mt-2 max-w-[65ch] text-suave">
        Solo se incluyen tiendas cuyas reglas web permiten la lectura automática del catálogo.
      </p>
    </section>
  );
}
