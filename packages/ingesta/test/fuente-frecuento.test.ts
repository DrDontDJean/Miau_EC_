import { describe, expect, it } from 'vitest';
import { fuentePara } from '../src/index.ts';
import { fetchFalso, fixture, tienda, todas } from './apoyo.ts';

const frecuento = tienda({
  id: 'frecuento', nombre: 'Frecuento', origen: 'https://www.frecuento.com', plataforma: 'frecuento',
  origen_api: 'https://app.frecuento.com',
});
type Fila = { id: number; amount_total: string; has_stock: boolean };
const [simple, conVariantes] = fixture<{ results: Fila[] }>('frecuento-productos.json').results as [Fila, Fila];

/** Páginas de la API: cada una lleva count y pages como la real. */
function servidor(paginas: Fila[][], count = paginas.flat().length) {
  return fetchFalso(url => {
    if (url.host !== 'app.frecuento.com' || url.pathname !== '/products/') return undefined;
    const n = Number(url.searchParams.get('page'));
    return { json: { count, limit: 500, pages: paginas.length, results: paginas[n - 1] ?? [] } };
  });
}
const leer = (srv: ReturnType<typeof servidor>) => {
  const fuente = fuentePara(frecuento, { fetch: srv.fetch, esperar: async () => {} });
  return todas(fuente.leer()).then(paginas => ({ fuente, paginas }));
};

describe('fuente Frecuento', () => {
  it('pide cada página de 500 al host de la API según pages y entrega una oferta por producto', async () => {
    const srv = servidor([[simple], [conVariantes]]);
    const { fuente, paginas } = await leer(srv);

    expect(srv.peticiones.map(p => new URL(p.url).searchParams.get('page'))).toEqual(['1', '2']);
    expect(srv.peticiones.every(p => p.url.startsWith('https://app.frecuento.com/products/?limit=500'))).toBe(true);
    expect(paginas.map(p => p.length)).toEqual([1, 1]);
    expect(fuente.incompleta?.()).toBeNull();
    expect(paginas[0]![0]).toEqual({
      sku_tienda: '1119032',
      titulo: 'Set de Cartas Pokémon Elite Trainer Box Aniversario 30 Años Inglés',
      url: 'https://www.frecuento.com/set-de-cartas-pokemon-elite-trainer-box-aniversario-30-anos-ingles/1119032/',
      imagen_url: 'https://d2o812a6k13pkp.cloudfront.net/fit-in/190x190/Productos/40650670_0120261030093638.jpg',
      precio: 110, precio_lista: null, moneda: 'USD', disponible: true, ean: null, marca: 'Pokemon',
    });
    expect(paginas[1]![0]).toMatchObject({ sku_tienda: '955556', precio: 8.2, marca: "Kuero's" });
  });

  it('un producto padre con variantes y precio 0 se entrega con ese precio y su stock', async () => {
    const padre = { ...structuredClone(conVariantes), amount_total: '0.00', has_stock: false };
    const { paginas } = await leer(servidor([[padre]]));
    expect(paginas[0]![0]).toMatchObject({ precio: 0, disponible: false });
  });

  it('si se leen menos productos de los que declara la tienda, la fuente se declara incompleta', async () => {
    const { fuente } = await leer(servidor([[simple, conVariantes]], 1000));
    expect(fuente.incompleta?.()).toMatch(/se leyeron 2 de los 1000 productos/);
  });

  it('una diferencia de menos del 1 % no cuenta: el catálogo cambia mientras se lee', async () => {
    const filas = Array.from({ length: 500 }, (_, i) => ({ ...simple, id: i }));
    const { fuente } = await leer(servidor([filas], 504));
    expect(fuente.incompleta?.()).toBeNull();
  });

  it('si la API cambia la forma de sus productos, la corrida falla en vez de cargar basura', async () => {
    const srv = fetchFalso(() => ({ json: { count: 1, limit: 500, pages: 1, results: [{ id: 'x' }] } }));
    await expect(todas(fuentePara(frecuento, { fetch: srv.fetch, esperar: async () => {} }).leer()))
      .rejects.toThrow(/Forma inesperada en la API de frecuento/);
  });
});
