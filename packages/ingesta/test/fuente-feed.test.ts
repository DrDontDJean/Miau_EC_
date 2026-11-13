import { describe, expect, it } from 'vitest';
import { fuentePara } from '../src/index.ts';
import { booleano, numero } from '../src/fuentes/feed.ts';
import { fetchFalso, tienda, todas, type Respuesta } from './apoyo.ts';

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

describe('numero y booleano del feed', () => {
  it.each([
    ['1299.90', 1299.9], ['1,299.90', 1299.9], ['1.299,90', 1299.9], ['$ 1 299.90', 1299.9], ['1299,9', 1299.9],
    ['1,299', 1299], ['1.299.000', 1299000], ['489', 489], [489, 489], ['', null], [undefined, null], [null, null],
  ] as const)('numero(%j) = %j', (entrada, esperado) => {
    expect(numero(entrada)).toBe(esperado);
  });

  it.each(['1,2,3', 'gratis', '$'])('numero(%j) es NaN, que validar() manda a cuarentena', entrada => {
    expect(numero(entrada)).toBeNaN();
  });

  it('reconoce la disponibilidad en español e inglés; vacía, ausente o desconocida queda en null', () => {
    for (const v of ['si', 'Sí', 'true', '1', 'Disponible', 'en stock', 'In Stock', true]) expect(booleano(v), String(v)).toBe(true);
    for (const v of ['no', 'FALSE', '0', 'agotado', 'Sin stock', 'out of stock', false]) expect(booleano(v), String(v)).toBe(false);
    for (const v of ['', '  ', undefined, null, 'quizás']) expect(booleano(v), String(v)).toBeNull();
  });
});

describe('fuente feed: forma del archivo', () => {
  const leerFeed = (url_feed: string, r: Respuesta) => {
    const srv = fetchFalso(url => (url.toString() === url_feed ? r : undefined));
    return todas(fuentePara({ ...artefacta, url_feed }, { fetch: srv.fetch, esperar: async () => {} }).leer());
  };
  const urlJson = () => artefacta.url_feed!.replace('.csv', '.json');

  it('un CSV sin columna disponible deja la disponibilidad en null (se publica como disponible)', async () => {
    const csv = 'SKU,Titulo,URL,Precio\nA-9,Microondas MS23K3513AS Samsung,https://www.artefacta.com/ms23/p,"1,299.00"';
    const [oferta] = (await leerFeed(artefacta.url_feed!, { texto: csv })).flat();
    expect(oferta).toMatchObject({ sku_tienda: 'A-9', precio: 1299, disponible: null });
  });

  it('un feed sin las columnas obligatorias hace fallar la corrida con un mensaje claro', async () => {
    const csv = 'sku,nombre,url\nA-1,Refrigeradora,https://www.artefacta.com/r/p';
    await expect(leerFeed(artefacta.url_feed!, { texto: csv })).rejects.toThrow('Al feed de artefacta le faltan columnas obligatorias: titulo, precio');
  });

  it('un feed JSON que no es una lista de objetos, o que no es JSON, se rechaza', async () => {
    await expect(leerFeed(urlJson(), { json: { productos: [] } })).rejects.toThrow(/debe ser una lista de objetos/);
    await expect(leerFeed(urlJson(), { json: [1, 2] })).rejects.toThrow(/debe ser una lista de objetos/);
    await expect(leerFeed(urlJson(), { texto: '[{"sku": ' })).rejects.toThrow(/no es JSON válido/);
  });

  it('las claves del feed JSON pasan a minúsculas, igual que la cabecera del CSV', async () => {
    const [oferta] = (await leerFeed(urlJson(), {
      json: [{ SKU: 'A-5', Titulo: 'TV 50"', URL: 'https://www.artefacta.com/tv/p', Precio: '399,90' }],
    })).flat();
    expect(oferta).toMatchObject({ sku_tienda: 'A-5', titulo: 'TV 50"', precio: 399.9, disponible: null });
  });
});
