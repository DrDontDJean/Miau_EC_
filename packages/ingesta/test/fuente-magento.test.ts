import { describe, expect, it } from 'vitest';
import { fuentePara } from '../src/index.ts';
import { fetchFalso, fixture, tienda, todas } from './apoyo.ts';

const pintulac = tienda({ id: 'pintulac', nombre: 'Pintulac', origen: 'https://www.pintulac.com.ec', plataforma: 'magento' });
type Item = { sku: string; stock_status?: string; price_range: { minimum_price: { final_price: { value: number; currency: string } } } };
const grabado = fixture<{ data: { products: { total_count: number; items: Item[] } } }>('magento-productos.json');
const [primero, segundo] = grabado.data.products.items as [Item, Item];

/** n productos distintos a partir de los dos grabados de Pintulac. */
const catalogo = (n: number): Item[] => Array.from({ length: n }, (_, i) => ({ ...structuredClone(i % 2 ? segundo : primero), sku: `S${i}` }));

type Config = { items: Item[]; total?: (pagina: number) => number; errores?: unknown[]; sinDatos?: boolean };
function servidor(c: Config) {
  return fetchFalso(url => {
    if (url.pathname !== '/graphql') return undefined;
    const consulta = url.searchParams.get('query') ?? '';
    const pagina = Number(/currentPage:(\d+)/.exec(consulta)?.[1]);
    if (c.errores) return { json: { errors: c.errores, data: null } };
    if (c.sinDatos) return { json: { data: null } };
    const items = c.items.slice((pagina - 1) * 100, pagina * 100);
    return { json: { data: { products: { total_count: c.total?.(pagina) ?? c.items.length, items } } } };
  });
}
const leer = (srv: ReturnType<typeof servidor>) => {
  const fuente = fuentePara(pintulac, { fetch: srv.fetch, esperar: async () => {} });
  return todas(fuente.leer()).then(paginas => ({ fuente, paginas, srv }));
};

describe('fuente Magento', () => {
  it('pide cada página de 100 por GET, según total_count, y entrega una oferta por producto', async () => {
    const srv = servidor({ items: catalogo(250) });
    const { fuente, paginas } = await leer(srv);

    expect(paginas.map(p => p.length)).toEqual([100, 100, 50]);
    const consultas = srv.peticiones.map(p => new URL(p.url));
    expect(consultas.map(u => /currentPage:(\d+)/.exec(u.searchParams.get('query')!)?.[1])).toEqual(['1', '2', '3']);
    expect(consultas.every(u => u.pathname === '/graphql' && u.searchParams.has('query'))).toBe(true);
    expect(fuente.incompleta?.()).toBeNull();
  });

  it('redondea el precio a 2 decimales y arma la URL con url_key y url_suffix', async () => {
    const { paginas } = await leer(servidor({ items: [primero, segundo] }));
    expect(paginas[0]![0]).toEqual({
      sku_tienda: 'E579.13-BL',
      titulo: '1/2 JUEGO ACCESORIOS PORCELANA BLANCO',
      url: 'https://www.pintulac.com.ec/1-2-juego-accesorios-porcelana-blanco.html',
      imagen_url: 'https://www.pintulac.com.ec/media/catalog/product/cache/00139b58a2c265df45428fb70407888a/e/5/e579.13-bl.jpg',
      precio: 10.21, precio_lista: 10.21, moneda: 'USD', disponible: true, ean: null, marca: null,
    });
    expect(paginas[0]![1]).toMatchObject({ sku_tienda: 'CHMP2966', precio: 20.86 });
  });

  it('OUT_OF_STOCK es no disponible y un estado desconocido queda sin dato', async () => {
    const agotado = { ...structuredClone(primero), sku: 'A', stock_status: 'OUT_OF_STOCK' };
    const raro = { ...structuredClone(primero), sku: 'B', stock_status: 'ON_BACKORDER' };
    const { paginas } = await leer(servidor({ items: [agotado, raro] }));
    expect(paginas[0]!.map(o => o.disponible)).toEqual([false, null]);
  });

  it('un error GraphQL con HTTP 200 hace fallar la corrida con el mensaje de la tienda', async () => {
    await expect(leer(servidor({ items: [], errores: [{ message: 'Field "products" argument "search" is invalid' }] })))
      .rejects.toThrow(/Magento \(pintulac\) rechazó la consulta: Field "products"/);
    await expect(leer(servidor({ items: [], sinDatos: true }))).rejects.toThrow(/respondió sin datos de productos/);
  });

  it('si el total cambia mientras se lee, la fuente se declara incompleta', async () => {
    const { fuente } = await leer(servidor({ items: catalogo(150), total: pagina => (pagina === 1 ? 150 : 148) }));
    expect(fuente.incompleta?.()).toMatch(/cambió durante la lectura \(de 150 a 148\)/);
  });

  it('si una página llega con menos productos de los que debía, la fuente se declara incompleta', async () => {
    const { fuente } = await leer(servidor({ items: catalogo(130), total: () => 200 }));
    expect(fuente.incompleta?.()).toMatch(/página 2 de pintulac llegó incompleta \(30 productos\)/);
  });

  it('si Magento cambia la forma de sus productos, la corrida falla en vez de cargar basura', async () => {
    const srv = fetchFalso(() => ({ json: { data: { products: { total_count: 1, items: [{ sku: 1 }] } } } }));
    await expect(todas(fuentePara(pintulac, { fetch: srv.fetch, esperar: async () => {} }).leer()))
      .rejects.toThrow(/Forma inesperada en Magento \(pintulac\)/);
  });
});
