import { describe, expect, it } from 'vitest';
import { fuentePara } from '../src/index.ts';
import { fetchFalso, fixture, tienda, todas } from './apoyo.ts';

type ProductoVtex = { productId: string; productName: string; items: { itemId: string }[] };
const productos = fixture<ProductoVtex[]>('vtex-productos.json');

/** n productos distintos a partir de los dos grabados de Novicompu. */
function catalogo(n: number, prefijo = 'p') {
  return Array.from({ length: n }, (_, i) => {
    const base = structuredClone(productos[i % productos.length]!);
    base.productId = `${prefijo}${i}`;
    base.items[0]!.itemId = `${prefijo}${i}`;
    return base;
  });
}

function servidorVtex(categorias: { id: number; children?: unknown[] }[], porCategoria: Record<number, ProductoVtex[]>) {
  return fetchFalso(url => {
    if (url.pathname.startsWith('/api/catalog_system/pub/category/tree/')) return { json: categorias };
    if (url.pathname === '/api/catalog_system/pub/products/search') {
      const cat = Number(/C:\/(?:\d+\/)*(\d+)\/$/.exec(url.searchParams.get('fq') ?? '')?.[1]);
      const todos = porCategoria[cat] ?? [];
      const desde = Number(url.searchParams.get('_from'));
      const hasta = Math.min(Number(url.searchParams.get('_to')), todos.length - 1);
      return { status: 206, json: todos.slice(desde, hasta + 1), cabeceras: { resources: `${desde}-${hasta}/${todos.length}` } };
    }
  });
}

describe('fuente VTEX', () => {
  it('pagina cada categoría de 50 en 50 y entrega una oferta por SKU, en dólares', async () => {
    const srv = servidorVtex([{ id: 7, children: [] }], { 7: catalogo(120) });
    const paginas = await todas(fuentePara(tienda(), { fetch: srv.fetch, esperar: async () => {} }).leer());

    expect(paginas.map(p => p.length)).toEqual([50, 50, 20]);
    const busquedas = srv.peticiones.filter(p => p.url.includes('/products/search'));
    // La última búsqueda (_from=0) es la del total global, con la que se comprueba que no falte nada.
    expect(busquedas.map(p => new URL(p.url).searchParams.get('_from'))).toEqual(['0', '50', '100', '0']);
    expect(srv.peticiones.some(p => p.url.includes('/category/tree/10'))).toBe(true);
    expect(paginas[0]![0]).toEqual({
      sku_tienda: 'p0',
      titulo: 'TELEVISOR MINI HOME ENV 18.5"',
      url: 'https://www.novicompu.com/televisor-mini-home-env-18-5-pulg-/p',
      imagen_url: 'https://novicompu.vteximg.com.br/arquivos/ids/182057/1AENV8423.png?v=639250147760630000',
      precio: 113,
      precio_lista: 113,
      moneda: 'USD',
      disponible: true,
      ean: null,
      marca: 'ENV',
    });
  });

  it('una categoría con más de 2500 productos se recorre por sus subcategorías (como Kywi)', async () => {
    const srv = servidorVtex(
      [{ id: 1, children: [{ id: 11, children: [] }, { id: 12, children: [] }] }],
      { 1: catalogo(2600, 'r'), 11: catalogo(60, 'a'), 12: catalogo(10, 'b') },
    );
    const paginas = await todas(fuentePara(tienda(), { fetch: srv.fetch, esperar: async () => {} }).leer());
    expect(paginas.flat()).toHaveLength(70);
    const fqs = srv.peticiones.filter(p => p.url.includes('/products/search')).map(p => new URL(p.url).searchParams.get('fq'));
    expect(fqs).toEqual(['C:/1/', 'C:/1/11/', 'C:/1/11/', 'C:/1/12/', null]);   // null: el total global
  });

  it('un producto que aparece en dos categorías se entrega una sola vez', async () => {
    const mismo = catalogo(3, 'x');
    const srv = servidorVtex([{ id: 1 }, { id: 2 }], { 1: mismo, 2: mismo });
    const paginas = await todas(fuentePara(tienda(), { fetch: srv.fetch, esperar: async () => {} }).leer());
    expect(paginas.flat().map(o => o.sku_tienda)).toEqual(['x0', 'x1', 'x2']);
  });

  it('es cortés: se identifica, espera 1 s entre peticiones y respeta Retry-After ante 429', async () => {
    let reloj = 0;
    const esperas: number[] = [];
    let primera429 = true;
    const srv = fetchFalso(url => {
      if (url.pathname.includes('/category/tree/')) return { json: [{ id: 7 }] };
      if (primera429) { primera429 = false; return { status: 429, cabeceras: { 'retry-after': '5' } }; }
      return { status: 206, json: catalogo(2), cabeceras: { resources: '0-1/2' } };
    });
    await todas(fuentePara(tienda(), {
      fetch: srv.fetch, ahora: () => reloj, esperar: async ms => { esperas.push(ms); reloj += ms; },
    }).leer());
    expect(srv.peticiones.every(p => p.agente?.startsWith('DecideAqui/'))).toBe(true);
    // árbol → (1 s) → búsqueda 429 → Retry-After 5 s → (sin espera extra: ya pasó 1 s) → búsqueda 206
    // y, tras la categoría, otro segundo de pausa antes de la búsqueda del total global
    expect(esperas).toEqual([1000, 5000, 1000]);
  });

  it('si VTEX cambia la forma de sus productos, la corrida falla en vez de cargar basura', async () => {
    const srv = fetchFalso(url => url.pathname.includes('/category/tree/')
      ? { json: [{ id: 7 }] }
      : { status: 206, json: [{ productId: 1, nombre: 'otra forma' }], cabeceras: { resources: '0-0/1' } });
    await expect(todas(fuentePara(tienda(), { fetch: srv.fetch, esperar: async () => {} }).leer()))
      .rejects.toThrow(/Forma inesperada en VTEX \(novicompu\)/);
  });
});
