import { describe, expect, it } from 'vitest';
import { fuentePara } from '../src/index.ts';
import { fetchFalso, tienda, todas } from './apoyo.ts';

const artefacta = tienda({
  id: 'artefacta', nombre: 'Artefacta', origen: 'https://www.artefacta.com', plataforma: 'feed',
  url_feed: 'https://www.artefacta.com/feeds/comparador.csv',
});

const CSV = [
  'sku,titulo,url,precio,precio_lista,disponible,ean,imagen,marca',
  'A-1,"Refrigeradora 14"" No Frost, acero RI-480",https://www.artefacta.com/ri480/p,699.90,899.00,si,,https://www.artefacta.com/i/1.jpg,Indurama',
  'A-2,Lavadora 17 kg WA17T6260BY,https://www.artefacta.com/wa17/p,489,,no,8806094000000,,Samsung',
].join('\r\n');

describe('fuente feed', () => {
  it('lee un CSV con comillas, comas dentro de campos y disponibilidad en español', async () => {
    const srv = fetchFalso(url => url.pathname === '/feeds/comparador.csv' ? { texto: CSV } : undefined);
    const paginas = await todas(fuentePara(artefacta, { fetch: srv.fetch, esperar: async () => {} }).leer());
    expect(paginas.flat()).toEqual([
      { sku_tienda: 'A-1', titulo: 'Refrigeradora 14" No Frost, acero RI-480', url: 'https://www.artefacta.com/ri480/p',
        precio: 699.9, precio_lista: 899, moneda: 'USD', disponible: true, ean: null,
        imagen_url: 'https://www.artefacta.com/i/1.jpg', marca: 'Indurama' },
      { sku_tienda: 'A-2', titulo: 'Lavadora 17 kg WA17T6260BY', url: 'https://www.artefacta.com/wa17/p',
        precio: 489, precio_lista: null, moneda: 'USD', disponible: false, ean: '8806094000000',
        imagen_url: null, marca: 'Samsung' },
    ]);
  });

  it('acepta también un feed JSON con los mismos campos', async () => {
    const json = artefacta.url_feed!.replace('.csv', '.json');
    const srv = fetchFalso(url => url.toString() === json
      ? { json: [{ sku: 'A-3', titulo: 'TV 50"', url: 'https://www.artefacta.com/tv/p', precio: 399, disponible: true }] }
      : undefined);
    const paginas = await todas(fuentePara({ ...artefacta, url_feed: json }, { fetch: srv.fetch, esperar: async () => {} }).leer());
    expect(paginas.flat()[0]).toMatchObject({ sku_tienda: 'A-3', precio: 399, disponible: true, moneda: 'USD' });
  });
});
