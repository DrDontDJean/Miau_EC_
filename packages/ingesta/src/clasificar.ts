// Clasificación del catálogo: categoría y atributos de cada producto (dominio: categoriaDe y atributosDe).
//
// Se calcula aquí, en TypeScript y con las reglas medidas contra el conjunto dorado, y se guarda con
// ingesta.aplicar_clasificacion (migración 2500). Clasifica los productos con atributos en null: los nuevos de cada
// corrida y, la primera vez, todo el catálogo. Para volver a clasificar con reglas nuevas basta una migración que
// ponga atributos en null.
import { atributosDe, categoriaDe } from '@comparador/dominio';
import type { Ejecutar } from './almacen/postgres.ts';

export type ResumenClasificacion = { revisados: number; conCategoria: number; actualizados: number };

export async function clasificarPendientes(ejecutar: Ejecutar, { lote = 5000, maximo = 500_000 } = {}): Promise<ResumenClasificacion> {
  const r: ResumenClasificacion = { revisados: 0, conCategoria: 0, actualizados: 0 };
  while (r.revisados < maximo) {
    const filas = await ejecutar(
      'select id::text as id, titulo from public.producto where atributos is null order by id limit $1', [lote]) as { id: string; titulo: string }[];
    if (!filas.length) break;
    const cambios = filas.map(f => {
      const categoria = categoriaDe({ titulo: f.titulo });
      return { id: f.id, categoria, atributos: categoria ? atributosDe(categoria, f.titulo) : {} };
    });
    // Como texto JSON: un arreglo de JavaScript, postgres.js lo enviaría como arreglo de Postgres.
    const [fila] = await ejecutar('select ingesta.aplicar_clasificacion($1::text::jsonb) as n', [JSON.stringify(cambios)]);
    r.revisados += filas.length;
    r.conCategoria += cambios.filter(c => c.categoria).length;
    r.actualizados += Number(fila?.n ?? 0);
    if (filas.length < lote) break;
  }
  return r;
}
