import { describe, expect, it } from 'vitest';
import { validar, type OfertaCruda, type Tienda } from '../src/index.ts';

const comandato: Tienda = { id: 'comandato', nombre: 'Comandato', origen: 'https://www.comandato.com' };

const tv: OfertaCruda = {
  sku_tienda: '685',
  titulo: '  Televisor 55" 4K UHD Tizen UN55U8000FPCZE Samsung ',
  url: 'https://www.comandato.com/televisor-55--4k-uhd-tizen-un55u8000fpcze-samsung/p',
  imagen_url: 'https://comandato.vteximg.com.br/arquivos/ids/1/tv.png',
  precio: 451.33,
  precio_lista: 988.25,
  moneda: 'USD',
  disponible: true,
  ean: null,
  marca: 'Samsung',
};

describe('validar', () => {
  it('una oferta correcta es válida, con título limpio y su clave de producto', () => {
    const r = validar(tv, comandato);
    expect(r.tipo).toBe('valida');
    if (r.tipo !== 'valida') return;
    expect(r.oferta).toMatchObject({
      sku_tienda: '685',
      titulo: 'Televisor 55" 4K UHD Tizen UN55U8000FPCZE Samsung',
      precio: 451.33,
      precio_lista: 988.25,
      disponible: true,
      ean: null,
      modelo: 'UN55U8000FPCZE',
      marca: 'Samsung',
    });
    expect(r.advertencias).toEqual([]);
  });

  it.each([
    ['precio_invalido', { precio: 0 }],
    ['precio_invalido', { precio: null }],
    ['precio_invalido', { precio: 250000 }],
    ['url_fuera_de_tienda', { url: 'https://www.otra-tienda.com/tv/p' }],
    ['url_fuera_de_tienda', { url: 'https://www.comandato.com.malicioso.com/tv' }],
    ['url_fuera_de_tienda', { url: 'http://www.comandato.com/tv/p' }],
    ['titulo_vacio', { titulo: '  ' }],
    ['sku_ausente', { sku_tienda: null }],
    ['moneda_no_usd', { moneda: 'EUR' }],
  ] as const)('regla bloqueante %s → cuarentena (%j)', (regla, cambio) => {
    const r = validar({ ...tv, ...cambio }, comandato);
    const sinSku = 'sku_tienda' in cambio;
    expect(r).toEqual({ tipo: 'cuarentena', sku_tienda: sinSku ? null : '685', reglas: [regla] });
  });

  it('EAN con dígito de control incorrecto: se publica sin EAN y se anota ean_invalido', () => {
    const r = validar({ ...tv, ean: '0195949034573' }, comandato);
    expect(r.tipo === 'valida' && r.oferta.ean).toBeNull();
    expect(r.tipo === 'valida' && r.advertencias)
      .toEqual([{ regla_id: 'ean_invalido', sku_tienda: '685', detalle: { ean: '0195949034573' } }]);
  });

  it('precio de lista menor que el precio: es un dato incoherente, se descarta y se anota', () => {
    const r = validar({ ...tv, precio_lista: 400 }, comandato);
    expect(r.tipo === 'valida' && r.oferta.precio_lista).toBeNull();
    expect(r.tipo === 'valida' && r.advertencias.map(a => a.regla_id)).toEqual(['precio_lista_menor']);
  });

  it('precio de lista igual al precio: significa "sin descuento", se descarta sin advertencia', () => {
    // Así lo envían VTEX y WooCommerce para la mayoría de productos (323 de 611 en la primera corrida real).
    const r = validar({ ...tv, precio_lista: 451.33 }, comandato);
    expect(r.tipo === 'valida' && r.oferta.precio_lista).toBeNull();
    expect(r.tipo === 'valida' && r.advertencias).toEqual([]);
  });

  it('sin imagen y sin clave de producto: se publica con dos advertencias', () => {
    const r = validar({ ...tv, titulo: 'Lámpara LED de escritorio', imagen_url: null }, comandato);
    expect(r.tipo).toBe('valida');
    expect(r.tipo === 'valida' && r.advertencias.map(a => a.regla_id).sort()).toEqual(['sin_emparejar', 'sin_imagen']);
  });

  it('un EAN que no es EAN (código interno) no cuenta como advertencia si no tiene forma de EAN', () => {
    // Comandato pone su código interno de 9 dígitos en el campo EAN.
    const r = validar({ ...tv, ean: '100066273' }, comandato);
    expect(r.tipo === 'valida' && r.advertencias).toEqual([]);
  });

  it.each([
    ['precio 0', { precio: 0 }],
    ['sin precio', { precio: null }],
  ] as const)('sin stock y %s: es una agotada, no va a cuarentena', (_, cambio) => {
    expect(validar({ ...tv, ...cambio, disponible: false }, comandato)).toEqual({ tipo: 'agotada', sku_tienda: '685' });
  });

  it.each([
    ['precio negativo sin stock', { precio: -1, disponible: false }, ['precio_invalido']],
    ['precio 0 con stock', { precio: 0, disponible: true }, ['precio_invalido']],
    ['precio 0 sin dato de stock', { precio: 0, disponible: null }, ['precio_invalido']],
    ['agotada con otro fallo bloqueante', { precio: 0, disponible: false, url: 'https://otra.com/x' }, ['precio_invalido', 'url_fuera_de_tienda']],
  ] as const)('%s: sigue yendo a cuarentena', (_, cambio, reglas) => {
    expect(validar({ ...tv, ...cambio }, comandato)).toEqual({ tipo: 'cuarentena', sku_tienda: '685', reglas });
  });

  it('una oferta con varios fallos los informa todos', () => {
    const r = validar({ ...tv, precio: -1, titulo: '', moneda: 'COP' }, comandato);
    expect(r.tipo === 'cuarentena' && r.reglas.sort()).toEqual(['moneda_no_usd', 'precio_invalido', 'titulo_vacio']);
  });
});
