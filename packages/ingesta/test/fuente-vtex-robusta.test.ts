// Robustez de la fuente VTEX: errores 500, categorías grandes, orden por nombre y total declarado.
import { describe, expect, it } from 'vitest';
import { fuentePara } from '../src/index.ts';
import { fetchFalso, fixture, tienda, todas } from './apoyo.ts';

type ProductoVtex = { productId: string; productName: string; items: { itemId: string }[] };
const grabados = fixture<ProductoVtex[]>('vtex-productos.json');

/** n productos distintos, en el orden "ascendente por nombre" que simula el servidor. */
function catalogo(n: number, prefijo: string) {
  return Array.from({ length: n }, (_, i) => {
    const base = structuredClone(grabados[i % grabados.length]!);
    base.productId = `${prefijo}${i}`;
    base.items[0]!.itemId = `${prefijo}${i}`;
    return base;
  });
}

type Config = {
  arbol: { id: number; children?: unknown[] }[];
  porCategoria: Record<number, ProductoVtex[]>;
  /** Búsqueda sin categoría; por omisión, la unión de todas las categorías. */
  todos?: ProductoVtex[];
  /** Total que declara la tienda para la búsqueda sin categoría, si no es el real. */
  totalGlobal?: number;
  /** Responde 500 a las búsquedas para las que devuelva true. */
  falla?: (desde: number, hasta: number, orden: string | null) => boolean;
};

function servidor(c: Config) {
  const union = c.todos ?? Object.values(c.porCategoria).flat();
  return fetchFalso(url => {
    if (url.pathname.startsWith('/api/catalog_system/pub/category/tree/')) return { json: c.arbol };
    if (url.pathname !== '/api/catalog_system/pub/products/search') return undefined;
    const fq = url.searchParams.get('fq');
    const cat = Number(/C:\/(?:\d+\/)*(\d+)\/$/.exec(fq ?? '')?.[1]);
    const lista = fq ? (c.porCategoria[cat] ?? []) : union;
    const ordenada = url.searchParams.get('O') === 'OrderByNameDESC' ? [...lista].reverse() : lista;
    const desde = Number(url.searchParams.get('_from'));
    const pedidoHasta = Number(url.searchParams.get('_to'));
    if (c.falla?.(desde, pedidoHasta, url.searchParams.get('O'))) return { status: 500, texto: 'error interno' };
    const hasta = Math.min(pedidoHasta, ordenada.length - 1);
    const total = fq ? lista.length : (c.totalGlobal ?? lista.length);
    return { status: 206, json: ordenada.slice(desde, hasta + 1), cabeceras: { resources: `${desde}-${hasta}/${total}` } };
  });
}

const leerTodo = (srv: ReturnType<typeof servidor>, contexto = {}) => {
  const fuente = fuentePara(tienda(), { fetch: srv.fetch, esperar: async () => {} }, contexto);
  return todas(fuente.leer()).then(paginas => ({ fuente, ofertas: paginas.flat() }));
};
const busquedas = (srv: ReturnType<typeof servidor>) =>
  srv.peticiones.filter(p => p.url.includes('/products/search')).map(p => new URL(p.url).searchParams);

describe('fuente VTEX: errores de servidor', () => {
  it('un tramo de 50 que da 500 se pide en bloques de 10 y no se pierde ningún producto', async () => {
    const srv = servidor({ arbol: [{ id: 7 }], porCategoria: { 7: catalogo(120, 'p') }, falla: (d, h) => d === 50 && h === 99 });
    const { fuente, ofertas } = await leerTodo(srv);
    expect(ofertas).toHaveLength(120);
    expect(fuente.incompleta?.()).toBeNull();
    const rangos = busquedas(srv).map(q => `${q.get('_from')}-${q.get('_to')}`);
    expect(rangos).toContain('50-59');
    expect(rangos).toContain('90-99');
  });

  it('un producto que sigue fallando se omite, se anota y la corrida queda incompleta', async () => {
    const srv = servidor({
      arbol: [{ id: 7 }], porCategoria: { 7: catalogo(120, 'p') },
      falla: (d, h, orden) => orden === null && d <= 73 && 73 <= h,
    });
    // Con el orden por nombre prohibido, no hay otra vía para recuperarlo.
    const { fuente, ofertas } = await leerTodo(srv, { leerRobots: async () => 'User-agent: *\nDisallow: /*OrderBy' });
    expect(ofertas).toHaveLength(119);
    expect(ofertas.map(o => o.sku_tienda)).not.toContain('p73');
    expect(fuente.incompleta?.()).toMatch(/1 tramo\(s\) con error del servidor se omitieron: C:\/7\/ desde 73/);
    expect(fuente.incompleta?.()).toMatch(/se leyeron 119 de los 120 productos/);
  });

  it('un producto omitido por error de servidor que se recupera con la lectura general no deja la fuente incompleta', async () => {
    const srv = servidor({
      arbol: [{ id: 7 }], porCategoria: { 7: catalogo(120, 'p') },
      falla: (d, h, orden) => orden === null && d <= 73 && 73 <= h,
    });
    const { fuente, ofertas } = await leerTodo(srv);
    expect(ofertas).toHaveLength(120);
    expect(ofertas.map(o => o.sku_tienda)).toContain('p73');
    expect(fuente.incompleta?.()).toBeNull();
  });

  it('una forma inesperada no se confunde con un error de servidor: la corrida falla', async () => {
    const srv = fetchFalso(url => url.pathname.includes('/category/tree/')
      ? { json: [{ id: 7 }] }
      : { status: 206, json: [{ productId: 1 }], cabeceras: { resources: '0-0/1' } });
    await expect(todas(fuentePara(tienda(), { fetch: srv.fetch, esperar: async () => {} }).leer()))
      .rejects.toThrow(/Forma inesperada en VTEX \(novicompu\)/);
  });
});

describe('fuente VTEX: categorías de más de 2500 productos', () => {
  it('sin subcategorías, se lee por nombre ascendente y descendente y se cubren hasta 5000', async () => {
    const srv = servidor({ arbol: [{ id: 4, children: [] }], porCategoria: { 4: catalogo(2530, 't') } });
    const { fuente, ofertas } = await leerTodo(srv);
    expect(ofertas).toHaveLength(2530);
    expect(new Set(ofertas.map(o => o.sku_tienda)).size).toBe(2530);
    expect(fuente.incompleta?.()).toBeNull();
    const ordenes = new Set(busquedas(srv).map(q => q.get('O')));
    expect(ordenes).toEqual(new Set([null, 'OrderByNameASC', 'OrderByNameDESC']));
  });

  it('con más de 5000 productos sin hijas, anota la categoría y cuántos se leyeron de más', async () => {
    const srv = servidor({ arbol: [{ id: 4 }], porCategoria: { 4: catalogo(6000, 'g') } });
    const { fuente, ofertas } = await leerTodo(srv);
    expect(ofertas).toHaveLength(5000);
    expect(fuente.incompleta?.()).toMatch(/C:\/4\/ \(6000 productos; solo se alcanzan 5000\)/);
  });

  it('si el robots.txt prohíbe el orden por nombre, lee 2500 sin ese parámetro y lo anota', async () => {
    const srv = servidor({ arbol: [{ id: 4 }], porCategoria: { 4: catalogo(2530, 't') } });
    const { fuente, ofertas } = await leerTodo(srv, { leerRobots: async () => 'User-agent: *\nDisallow: /*OrderBy' });
    expect(ofertas).toHaveLength(2500);
    expect(fuente.incompleta?.()).toMatch(/se leyeron 2500 de los 2530 productos/);
    expect(busquedas(srv).every(q => q.get('O') === null)).toBe(true);
    expect(fuente.incompleta?.()).toMatch(/prohíbe el orden por nombre/);
  });

  it('un robots.txt que no menciona el orden deja usarlo', async () => {
    const srv = servidor({ arbol: [{ id: 4 }], porCategoria: { 4: catalogo(2530, 't') } });
    const { ofertas } = await leerTodo(srv, { leerRobots: async () => 'User-agent: *\nDisallow: /checkout/*' });
    expect(ofertas).toHaveLength(2530);
  });
});

describe('fuente VTEX: el total declarado por la tienda', () => {
  it('los productos fuera del árbol de categorías se recuperan con lecturas generales', async () => {
    const enArbol = catalogo(60, 'a');
    const fuera = catalogo(5, 'z');
    const srv = servidor({ arbol: [{ id: 7 }], porCategoria: { 7: enArbol }, todos: [...enArbol, ...fuera] });
    const { fuente, ofertas } = await leerTodo(srv);
    expect(ofertas).toHaveLength(65);
    expect(ofertas.map(o => o.sku_tienda)).toContain('z4');
    expect(fuente.incompleta?.()).toBeNull();
  });

  it('si aun así faltan productos, la fuente dice cuántos se leyeron de cuántos', async () => {
    const enArbol = catalogo(60, 'a');
    const srv = servidor({ arbol: [{ id: 7 }], porCategoria: { 7: enArbol }, todos: enArbol, totalGlobal: 70 });
    const { fuente, ofertas } = await leerTodo(srv);
    expect(ofertas).toHaveLength(60);
    expect(fuente.incompleta?.()).toMatch(/se leyeron 60 de los 70 productos que declara la tienda/);
  });

  it('sin diferencias con el total declarado no se hacen lecturas generales de más', async () => {
    const srv = servidor({ arbol: [{ id: 7 }], porCategoria: { 7: catalogo(60, 'a') } });
    await leerTodo(srv);
    expect(busquedas(srv).filter(q => q.get('O') !== null)).toHaveLength(0);
  });
});

describe('fuente VTEX: SKUs agotados', () => {
  it('un SKU agotado con Price 0 va sin precio y sin stock; si otro vendedor tiene precio, usa el más barato', async () => {
    const srv = servidor({ arbol: [{ id: 9 }], porCategoria: { 9: fixture<ProductoVtex[]>('vtex-agotado.json') } });
    const { ofertas } = await leerTodo(srv);
    expect(ofertas).toMatchObject([
      { sku_tienda: '9950', precio: null, precio_lista: null, disponible: false },
      { sku_tienda: '9951', precio: 139.9, precio_lista: 159.9, disponible: false },
    ]);
  });
});
