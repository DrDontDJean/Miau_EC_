import { describe, expect, it } from 'vitest';
import { clasificarPendientes } from '../src/clasificar.ts';
import { baseDePrueba } from './base-pglite.ts';

describe('clasificarPendientes (contra PGlite con las migraciones)', () => {
  it('asigna categoría y atributos a los productos sin clasificar, y no vuelve a tocarlos', async () => {
    const { ejecutar } = await baseDePrueba();
    await ejecutar(`insert into public.producto (titulo, num_tiendas, precio_desde) values
      ('Laptop Lenovo IdeaPad Slim 3 15.6" Ryzen 5 16GB 512GB', 1, 600),
      ('Mochila P-Laptop Clasica 14plg', 1, 20),
      ('Celular Xiaomi Redmi 15C - 4/256GB', 1, 150)`);
    const r = await clasificarPendientes(ejecutar, { lote: 2 });
    expect(r).toEqual({ revisados: 3, conCategoria: 2, actualizados: 3 });

    const filas = await ejecutar(`select p.titulo, c.slug, p.atributos from public.producto p
                                   left join public.categoria c on c.id = p.categoria_id order by p.titulo`);
    expect(filas.map(f => [String(f.titulo).slice(0, 12), f.slug])).toEqual([
      ['Celular Xiao', 'celulares'], ['Laptop Lenov', 'laptops'], ['Mochila P-La', null],
    ]);
    expect(filas[1]!.atributos).toMatchObject({ procesador: ['amd'], ram: ['16'], almacenamiento: ['512gb'], pantalla: ['15-6'] });
    expect(filas[2]!.atributos).toEqual({});

    expect(await clasificarPendientes(ejecutar)).toEqual({ revisados: 0, conCategoria: 0, actualizados: 0 });
  });
});
