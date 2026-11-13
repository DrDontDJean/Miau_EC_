import { describe, expect, it } from 'vitest';
import { fuentePara } from '../src/index.ts';
import { fetchFalso, fixture, tienda, todas } from './apoyo.ts';

const ekustore = tienda({ id: 'ekustore', nombre: 'EkuStore', origen: 'https://ekustore.com', plataforma: 'shopify' });
// Un producto de una variante (EkuStore) y otro de dos (Colineal), grabados de sus tiendas.
const [simple, conVariantes] = fixture<{ products: unknown[] }>('shopify-productos.json').products;

function servidor(paginas: unknown[][], moneda: unknown = 'USD') {
  return fetchFalso(url => {
    if (url.pathname === '/meta.json') return { json: { currency: moneda } };
    if (url.pathname === '/products.json') {
      const n = Number(url.searchParams.get('page'));
      return { json: { products: paginas[n - 1] ?? [] } };
    }
  });
}
const leer = (srv: ReturnType<typeof servidor>, contexto = {}) => {
  const fuente = fuentePara(ekustore, { fetch: srv.fetch, esperar: async () => {} }, contexto);
  return todas(fuente.leer()).then(paginas => ({ fuente, paginas }));
};

describe('fuente Shopify', () => {
  it('recorre /products.json hasta una página vacía y entrega una oferta por variante', async () => {
    const srv = servidor([[simple], [conVariantes]]);
    const { fuente, paginas } = await leer(srv);

    expect(paginas.map(p => p.length)).toEqual([1, 2]);
    const paginasPedidas = srv.peticiones.filter(p => p.url.includes('/products.json')).map(p => new URL(p.url).searchParams.get('page'));
    expect(paginasPedidas).toEqual(['1', '2', '3']);   // la 3 llega vacía
    expect(srv.peticiones.every(p => p.agente?.startsWith('DecideAqui/'))).toBe(true);
    expect(fuente.incompleta?.()).toBeNull();

    expect(paginas[0]![0]).toEqual({
      sku_tienda: '50757036343536',
      titulo: 'Disco Duro Western Digital (WD) 1 TB',
      url: 'https://ekustore.com/products/disco-duro-western-digital-wd-1-tb',
      imagen_url: 'https://cdn.shopify.com/s/files/1/0749/7308/5936/files/cfdfb82d07d44c28314bd035e1e2b7cb.jpg?v=1794348061',
      precio: 154.1, precio_lista: null, moneda: 'USD', disponible: true, ean: null, marca: 'WESTERN DIGITAL',
    });
    expect(paginas[1]![0]).toEqual({
      sku_tienda: '53691930804405',
      titulo: 'Bata de Baño Deluxe Unisex Beige Large',
      url: 'https://ekustore.com/products/bata-de-bano-deluxe-unisex-beige?variant=53691930804405',
      imagen_url: 'https://cdn.shopify.com/s/files/1/2098/0315/files/7861215932413-2.jpg?v=1793806940',
      precio: 59.5, precio_lista: 85, moneda: 'USD', disponible: true, ean: null, marca: 'Colineal',
    });
    expect(paginas[1]![1]).toMatchObject({ sku_tienda: '53733230379189', titulo: 'Bata de Baño Deluxe Unisex Beige XLarge', precio: 66.5 });
  });

  it('un precio 0 se entrega como viene: validar() lo trata como agotada o lo manda a cuarentena', async () => {
    const sinPrecio = structuredClone(simple) as { variants: { price: string; available: boolean }[] };
    sinPrecio.variants[0]!.price = '0.00';
    sinPrecio.variants[0]!.available = false;
    const { paginas } = await leer(servidor([[sinPrecio]]));
    expect(paginas[0]![0]).toMatchObject({ precio: 0, disponible: false });
  });

  it('si la tienda no vende en USD, las ofertas llevan su moneda y validar() las rechazará', async () => {
    const { paginas } = await leer(servidor([[simple]], 'eur'));
    expect(paginas[0]![0]).toMatchObject({ moneda: 'EUR' });
  });

  it('lee la moneda de /meta.json, nunca de /cart.js, que los robots.txt de las tiendas prohíben', async () => {
    const srv = servidor([[simple]]);
    await leer(srv);
    const rutas = srv.peticiones.map(p => new URL(p.url).pathname);
    expect(rutas).toContain('/meta.json');
    expect(rutas).not.toContain('/cart.js');
  });

  it('si el robots.txt prohíbe /meta.json, no se lee nada', async () => {
    const srv = servidor([[simple]]);
    await expect(leer(srv, { leerRobots: async () => 'User-agent: *\nDisallow: /meta.json' }))
      .rejects.toThrow(/prohíbe \/meta\.json/);
    expect(srv.peticiones).toHaveLength(0);
  });

  it('si Shopify repite la última página en vez de terminar, corta y declara la fuente incompleta', async () => {
    const srv = fetchFalso(url => url.pathname === '/meta.json'
      ? { json: { currency: 'USD' } }
      : { json: { products: [simple] } });   // cualquier page devuelve lo mismo
    const { fuente, paginas } = await leer(srv as ReturnType<typeof servidor>);
    expect(paginas).toHaveLength(1);
    expect(fuente.incompleta?.()).toMatch(/repitió la página 1/);
  });

  it('si Shopify cambia la forma de sus productos, la corrida falla en vez de cargar basura', async () => {
    await expect(leer(servidor([[{ id: 'x', nombre: 'otra forma' }]]))).rejects.toThrow(/Forma inesperada en Shopify \(ekustore\)/);
    await expect(leer(servidor([[simple]], null))).rejects.toThrow(/\/meta\.json sin moneda/);
  });
});
