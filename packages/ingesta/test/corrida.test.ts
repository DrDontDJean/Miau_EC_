import { describe, expect, it } from 'vitest';
import type { OfertaCruda } from '@comparador/dominio';
import { almacenPostgres, ejecutarCorrida, origenDeRobots, rutaDeLectura, type Fuente } from '../src/index.ts';
import { baseDePrueba } from './base-pglite.ts';
import { tienda } from './apoyo.ts';

const comandato = tienda({ id: 'comandato', nombre: 'Comandato', origen: 'https://www.comandato.com' });
const ROBOTS_ABIERTO = 'User-agent: *\nDisallow: /checkout/*';

const oferta = (sku: string, titulo: string, precio: number, extra: Partial<OfertaCruda> = {}): OfertaCruda => ({
  sku_tienda: sku, titulo, url: `https://www.comandato.com/${sku}/p`, imagen_url: 'https://comandato.vteximg.com.br/i.png',
  precio, precio_lista: null, moneda: 'USD', disponible: true, ean: null, marca: null, ...extra,
});

const fuenteDe = (...paginas: OfertaCruda[][]): Fuente => ({ async *leer() { yield* paginas; } });

describe('rutaDeLectura y origenDeRobots', () => {
  it.each([
    ['vtex', {}, '/api/catalog_system/pub/products/search?fq=C:/1/&_from=0&_to=49'],
    ['woocommerce', {}, '/wp-json/wc/store/v1/products?page=1&per_page=100'],
    ['shopify', {}, '/products.json?limit=250&page=1'],
    ['magento', {}, '/graphql?query=%7Bproducts%7Btotal_count%7D%7D'],
    ['frecuento', { origen_api: 'https://app.frecuento.com' }, '/products/?limit=500&page=1'],
    ['sitemap', {}, '/sitemap.xml'],
    ['sitemap', { url_sitemap: 'https://www.crecos.com/sitemap/product-0.xml' }, '/sitemap/product-0.xml'],
    ['feed', { url_feed: 'https://www.comandato.com/f.csv' }, null],
  ] as const)('%s %j → %s', (plataforma, extra, esperada) => {
    expect(rutaDeLectura(tienda({ plataforma, ...extra }))).toBe(esperada);
  });

  it('el robots.txt que manda es el del host de la API si es distinto del de la tienda', () => {
    expect(origenDeRobots(tienda())).toBe('https://www.novicompu.com');
    expect(origenDeRobots(tienda({ plataforma: 'frecuento', origen_api: 'https://app.frecuento.com' }))).toBe('https://app.frecuento.com');
  });
});

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

  it('una tienda sin_permiso cuyo robots.txt ya lo permite lee su catálogo y vuelve a activa', async () => {
    const { ejecutar } = await baseDePrueba();
    const almacen = almacenPostgres(ejecutar);
    await ejecutar(`update public.tienda set estado = 'sin_permiso', motivo_estado = 'robots.txt: Disallow: /*?' where id = 'comandato'`);
    const r = await ejecutarCorrida(comandato, {
      fuente: fuenteDe([oferta('1', 'Televisor UN55U8000FPCZE Samsung', 400)]), almacen, leerRobots: async () => ROBOTS_ABIERTO,
    });
    expect(r.estado).toBe('ok');
    expect(await ejecutar(`select estado::text, motivo_estado from public.tienda where id = 'comandato'`))
      .toEqual([{ estado: 'activa', motivo_estado: null }]);
  });

  it('si el robots.txt sigue prohibiendo, la tienda sin_permiso no lee nada más y sigue sin permiso', async () => {
    const { ejecutar } = await baseDePrueba();
    await ejecutar(`update public.tienda set estado = 'sin_permiso', motivo_estado = 'robots.txt: Disallow: /*?' where id = 'comandato'`);
    let leida = false;
    const r = await ejecutarCorrida(comandato, {
      fuente: { async *leer() { leida = true; yield []; } },
      almacen: almacenPostgres(ejecutar), leerRobots: async () => 'User-agent: *\nDisallow: /*?',
    });
    expect(leida).toBe(false);
    expect(r.estado).toBe('sin_permiso');
    expect(await ejecutar(`select estado::text e from public.tienda where id = 'comandato'`)).toEqual([{ e: 'sin_permiso' }]);
  });

  it('una tienda que pasa a sin_permiso deja de contar en num_tiendas y precio_desde del producto compartido', async () => {
    const { ejecutar } = await baseDePrueba();
    const almacen = almacenPostgres(ejecutar);
    const novicompu = tienda({ id: 'novicompu', origen: 'https://www.novicompu.com' });
    await ejecutarCorrida(comandato, {
      fuente: fuenteDe([oferta('1', 'Televisor UN55U8000FPCZE Samsung', 400)]), almacen, leerRobots: async () => ROBOTS_ABIERTO,
    });
    await ejecutarCorrida(novicompu, {
      fuente: fuenteDe([{ ...oferta('N1', 'Televisor Samsung UN55U8000FPCZE', 500), url: 'https://www.novicompu.com/n1/p' }]),
      almacen, leerRobots: async () => ROBOTS_ABIERTO,
    });
    const consulta = `select num_tiendas::int n, precio_desde::float8 desde, jsonb_array_length(ofertas) visibles
                        from public.buscar_productos('televisor samsung')`;
    expect(await ejecutar(consulta)).toEqual([{ n: 2, desde: 400, visibles: 2 }]);

    const r = await ejecutarCorrida(comandato, {
      fuente: fuenteDe(), almacen, leerRobots: async () => 'User-agent: *\nDisallow: /*?',
    });
    expect(r.estado).toBe('sin_permiso');
    expect(await ejecutar(consulta)).toEqual([{ n: 1, desde: 500, visibles: 1 }]);
    // Las ofertas no se desactivan: vuelven si la tienda recupera el permiso.
    expect(await ejecutar(`select activa from public.oferta where tienda_id = 'comandato'`)).toEqual([{ activa: true }]);
  });

  it('una fuente que se declara incompleta cierra la corrida como parcial, con el motivo, y no desactiva nada', async () => {
    const { ejecutar } = await baseDePrueba();
    const almacen = almacenPostgres(ejecutar);
    const corrida = (fuente: Fuente) => ejecutarCorrida(comandato, { fuente, almacen, leerRobots: async () => ROBOTS_ABIERTO });
    const tv = oferta('1', 'Televisor UN55U8000FPCZE', 451.33);
    await corrida(fuenteDe([tv, oferta('2', 'Refrigeradora RI480XYZ', 699)]));
    await corrida(fuenteDe([tv]));   // la refrigeradora falta una vez
    const motivo = 'La fuente no cubrió todo el catálogo: faltan categorías';
    const r = await corrida({ async *leer() { yield [tv]; }, incompleta: () => motivo });
    // Con estado 'ok' la refrigeradora se habría desactivado: falta en dos corridas seguidas.
    expect(r).toMatchObject({ estado: 'parcial', error: motivo, desactivadas: 0 });
    expect(await ejecutar(`select count(*)::int n from public.oferta where activa`)).toEqual([{ n: 2 }]);
  });

  it('una oferta que llega agotada conserva su último precio, queda sin stock y no va a cuarentena', async () => {
    const { ejecutar } = await baseDePrueba();
    const almacen = almacenPostgres(ejecutar);
    const corrida = (...paginas: OfertaCruda[][]) =>
      ejecutarCorrida(comandato, { fuente: fuenteDe(...paginas), almacen, leerRobots: async () => ROBOTS_ABIERTO });
    const agotada = (sku: string, titulo: string) => oferta(sku, titulo, 0, { disponible: false });

    await corrida([oferta('100', 'Televisor UN55U8000FPCZE Samsung', 451.33), oferta('200', 'Lavadora WA17T6260BY', 520)]);
    const r = await corrida(
      [agotada('100', 'Televisor UN55U8000FPCZE Samsung'), agotada('300', 'Refrigeradora RI480XYZ Indurama')],
      // El mismo SKU llega con precio en otra lectura de la corrida: esa lectura manda.
      [oferta('200', 'Lavadora WA17T6260BY', 520), agotada('200', 'Lavadora WA17T6260BY')],
    );

    expect(r).toMatchObject({ estado: 'ok', agotadas: 2, leidas: 3, validas: 3, en_cuarentena: 0 });
    expect(await ejecutar(`select sku_tienda, precio::float8 precio, disponible, activa from public.oferta order by 1`)).toEqual([
      { sku_tienda: '100', precio: 451.33, disponible: false, activa: true },
      { sku_tienda: '200', precio: 520, disponible: true, activa: true },
    ]);   // la agotada que nunca se vio con precio (300) no se publica
    expect(await ejecutar(`select count(*)::int n from ingesta.cuarentena`)).toEqual([{ n: 0 }]);
    const historial = await ejecutar(`
      select h.precio::float8 precio, h.disponible from public.precio_historial h
        join public.oferta o on o.id = h.oferta_id where o.sku_tienda = '100' order by h.valido_desde`);
    expect(historial).toEqual([{ precio: 451.33, disponible: true }, { precio: 451.33, disponible: false }]);
    expect(await ejecutar(`select agotadas from calidad.resumen_corrida where corrida_id = $1`, [r.corrida_id])).toEqual([{ agotadas: 2 }]);
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
