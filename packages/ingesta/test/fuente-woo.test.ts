import { describe, expect, it } from 'vitest';
import { fuentePara } from '../src/index.ts';
import { fetchFalso, fixture, tienda, todas } from './apoyo.ts';

const grabados = fixture<Record<string, unknown>[]>('woo-productos.json');
const computron = tienda({ id: 'computron', nombre: 'Computron', origen: 'https://www.computron.com.ec', plataforma: 'woocommerce' });

describe('fuente WooCommerce', () => {
  it('recorre todas las páginas de la Store API y convierte los precios desde centavos', async () => {
    const srv = fetchFalso(url => {
      if (url.pathname !== '/wp-json/wc/store/v1/products') return undefined;
      const pagina = Number(url.searchParams.get('page'));
      return { json: pagina <= 2 ? grabados : [], cabeceras: { 'x-wp-totalpages': '2', 'x-wp-total': '4' } };
    });
    const paginas = await todas(fuentePara(computron, { fetch: srv.fetch, esperar: async () => {} }).leer());

    expect(srv.peticiones.map(p => new URL(p.url).searchParams.get('page'))).toEqual(['1', '2']);
    expect(srv.peticiones.every(p => new URL(p.url).searchParams.get('per_page') === '100')).toBe(true);
    expect(paginas.map(p => p.length)).toEqual([2, 2]);
    // Valores esperados leídos a mano del fixture grabado de Computron.
    expect(paginas[0]![0]).toEqual({
      sku_tienda: '10038194',
      titulo: 'Televisor-tv 75″ QLED 4K UHD 75TIKIQMINLED – Google TV 5.0 Indurama',
      url: 'https://www.computron.com.ec/producto/televisor-tv-75-qled-4k-uhd-75tikiqminled-google-tv-5-0-indurama/',
      imagen_url: 'https://www.computron.com.ec/wp-content/uploads/2026/11/10038194-5.webp',
      precio: 988.67,
      precio_lista: 998.99,
      moneda: 'USD',
      disponible: true,
      ean: null,
      marca: 'INDURAMA',
    });
  });
});
