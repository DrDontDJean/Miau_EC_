import { describe, expect, it } from 'vitest';
import type { OfertaCruda } from '@comparador/dominio';
import { almacenPostgres, ejecutarCorrida, type Fuente } from '../src/index.ts';
import { baseDePrueba } from './base-pglite.ts';
import { tienda } from './apoyo.ts';

const comandato = tienda({ id: 'comandato', nombre: 'Comandato', origen: 'https://www.comandato.com' });
const ROBOTS_ABIERTO = 'User-agent: *\nDisallow: /checkout/*';

const oferta = (sku: string, titulo: string, precio: number, extra: Partial<OfertaCruda> = {}): OfertaCruda => ({
  sku_tienda: sku, titulo, url: `https://www.comandato.com/${sku}/p`, imagen_url: 'https://comandato.vteximg.com.br/i.png',
  precio, precio_lista: null, moneda: 'USD', disponible: true, ean: null, marca: null, ...extra,
});

const fuenteDe = (...paginas: OfertaCruda[][]): Fuente => ({ async *leer() { yield* paginas; } });

describe('ejecutarCorrida', () => {
  it('carga las válidas, manda a cuarentena las inválidas, anota advertencias y cierra en ok', async () => {
    const { ejecutar } = await baseDePrueba();
    const resumen = await ejecutarCorrida(comandato, {
      fuente: fuenteDe(
        [oferta('1', 'Televisor 55" 4K UHD Tizen UN55U8000FPCZE Samsung', 451.33), oferta('2', 'Precio roto', 0)],
        [oferta('3', 'Lámpara LED de escritorio', 12.5, { imagen_url: null }), oferta('4', 'Refrigeradora RI-480 Indurama', 699)],
      ),
      almacen: almacenPostgres(ejecutar),
      leerRobots: async () => ROBOTS_ABIERTO,
    });

    expect(resumen).toMatchObject({ estado: 'ok', leidas: 4, validas: 3, en_cuarentena: 1, nuevas: 3 });
    const incidencias = await ejecutar(`select regla_id, count(*)::int n from calidad.incidencia group by 1 order by 1`);
    expect(incidencias).toEqual([
      { regla_id: 'precio_invalido', n: 1 },
      { regla_id: 'sin_emparejar', n: 2 },   // lámpara y refrigeradora (RI-480 tiene 5 caracteres útiles)
      { regla_id: 'sin_imagen', n: 1 },
    ]);
    const enBusqueda = await ejecutar(`select titulo from public.buscar_productos('televisor samsung')`);
    expect(enBusqueda).toEqual([{ titulo: 'Televisor 55" 4K UHD Tizen UN55U8000FPCZE Samsung' }]);
  });

  it('si robots.txt prohíbe la búsqueda, no lee nada y marca la tienda sin permiso', async () => {
    const { ejecutar } = await baseDePrueba();
    let leida = false;
    const resumen = await ejecutarCorrida(comandato, {
      fuente: { async *leer() { leida = true; yield []; } },
      almacen: almacenPostgres(ejecutar),
      leerRobots: async () => 'User-agent: *\nDisallow: /*?',
    });
    expect(leida).toBe(false);
    expect(resumen).toMatchObject({ estado: 'sin_permiso', leidas: 0 });
    expect(resumen.error).toMatch(/robots\.txt prohíbe \/api\/catalog_system/);
    expect(await ejecutar(`select estado from public.tienda where id = 'comandato'`)).toEqual([{ estado: 'sin_permiso' }]);
  });

  it('si la tienda falla a mitad de camino, la corrida queda fallida, con el error y lo ya cargado', async () => {
    const { ejecutar } = await baseDePrueba();
    const resumen = await ejecutarCorrida(comandato, {
      fuente: { async *leer() { yield [oferta('1', 'Televisor UN55U8000FPCZE', 451.33)]; throw new Error('HTTP 503 en página 2'); } },
      almacen: almacenPostgres(ejecutar),
      leerRobots: async () => ROBOTS_ABIERTO,
    });
    expect(resumen).toMatchObject({ estado: 'fallida', validas: 1, error: 'HTTP 503 en página 2' });
    expect(await ejecutar(`select count(*)::int n from public.oferta where activa`)).toEqual([{ n: 1 }]);
  });

  it('un SKU repetido se carga una vez, con el precio más barato, y se anota sku_duplicado', async () => {
    const { ejecutar } = await baseDePrueba();
    const resumen = await ejecutarCorrida(comandato, {
      fuente: fuenteDe(
        [oferta('9', 'Lavadora WA17T6260BY', 520), oferta('9', 'Lavadora WA17T6260BY', 505)],
        [oferta('9', 'Lavadora WA17T6260BY', 499), oferta('9', 'Lavadora WA17T6260BY', 530)],
      ),
      almacen: almacenPostgres(ejecutar),
      leerRobots: async () => ROBOTS_ABIERTO,
    });
    expect(resumen.estado).toBe('ok');
    expect(await ejecutar(`select precio::float8 precio from public.oferta where sku_tienda = '9'`)).toEqual([{ precio: 499 }]);
    expect(await ejecutar(`select count(*)::int n from calidad.incidencia where regla_id = 'sku_duplicado'`)).toEqual([{ n: 3 }]);
  });

  it('con límite de páginas solo lee esas páginas y cierra como parcial, sin desactivar nada', async () => {
    const { ejecutar } = await baseDePrueba();
    const paginasLeidas: number[] = [];
    const fuente: Fuente = { async *leer() { for (let p = 1; p <= 5; p++) { paginasLeidas.push(p); yield [oferta(`s${p}`, `Producto ${p} ABC12${p}X`, 10 * p)]; } } };
    const resumen = await ejecutarCorrida(comandato, {
      fuente, almacen: almacenPostgres(ejecutar), leerRobots: async () => ROBOTS_ABIERTO, limitePaginas: 2,
    });
    expect(paginasLeidas).toEqual([1, 2]);
    expect(resumen).toMatchObject({ estado: 'parcial', validas: 2, desactivadas: 0 });
  });

  it('dos SKUs distintos de la misma tienda con el mismo código de familia no se agrupan; entre tiendas, sí', async () => {
    // Caso real: "15AMN8" es la familia IdeaPad Slim 3, no un modelo. Cada laptop debe quedar aparte.
    const { ejecutar } = await baseDePrueba();
    const almacen = almacenPostgres(ejecutar);
    await ejecutarCorrida(comandato, {
      fuente: fuenteDe(
        [oferta('L1', 'Laptop IPS3 15AMN8 Amd R5 8GB 512GB', 610.48)],
        [oferta('L2', 'Laptop IPS3 15AMN8 Amd R7 16GB 1TB', 768.68)],
      ),
      almacen, leerRobots: async () => ROBOTS_ABIERTO,
    });
    const novicompu = tienda({ id: 'novicompu', origen: 'https://www.novicompu.com' });
    await ejecutarCorrida(novicompu, {
      fuente: fuenteDe([{ ...oferta('N1', 'Laptop Lenovo IdeaPad 15AMN8 R5', 650), url: 'https://www.novicompu.com/n1/p' }]),
      almacen, leerRobots: async () => ROBOTS_ABIERTO,
    });
    const productos = await ejecutar(`
      select p.num_tiendas::int n, string_agg(o.tienda_id, ',' order by o.tienda_id) tiendas
        from public.producto p join public.oferta o on o.producto_id = p.id
       group by p.id order by 2`);
    expect(productos).toEqual([{ n: 1, tiendas: 'comandato' }, { n: 2, tiendas: 'comandato,novicompu' }]);
  });

  it('una segunda corrida idéntica no cambia nada: todo cuenta como sin cambios', async () => {
    const { ejecutar } = await baseDePrueba();
    const deps = () => ({
      fuente: fuenteDe([oferta('1', 'Televisor UN55U8000FPCZE', 451.33), oferta('2', 'Refrigeradora RI480XYZ', 699)]),
      almacen: almacenPostgres(ejecutar),
      leerRobots: async () => ROBOTS_ABIERTO,
    });
    await ejecutarCorrida(comandato, deps());
    const segunda = await ejecutarCorrida(comandato, deps());
    expect(segunda).toMatchObject({ estado: 'ok', nuevas: 0, actualizadas: 0, sin_cambios: 2 });
    expect(await ejecutar(`select count(*)::int n from public.precio_historial`)).toEqual([{ n: 2 }]);
  });
});
