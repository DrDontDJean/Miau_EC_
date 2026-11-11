import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eanValido, codigosModelo, claveProducto, agruparOfertas } from '../src/agrupar.mjs';
import { normalizarVtex, normalizarWoo, decodificarHtml } from '../src/adaptadores.mjs';
import { crearIdOferta, resolverIdOferta } from '../src/redireccion.mjs';
import { crearServidor } from '../src/servidor.mjs';
import { tiendaPorId } from '../src/tiendas.mjs';

const comandato = tiendaPorId('comandato');
const computron = tiendaPorId('computron');

test('valida EAN-13 con dígito de control', () => {
  assert.equal(eanValido('0195949034572'), true);   // EAN real del iPhone 15 visto en idealo
  assert.equal(eanValido('0195949034573'), false);
  assert.equal(eanValido('100066273'), false);      // código interno de Comandato, no es EAN
});

test('extrae códigos de modelo e ignora specs genéricas', () => {
  assert.deepEqual(codigosModelo('Televisor 65" UHD Google TV 65MNUHD Motorola'), ['65MNUHD']);
  assert.deepEqual(codigosModelo('Laptop 16GB 512GB 120HZ i5'), []);
  assert.ok(codigosModelo('Televisor Samsung Qled Qn65Q7Faapcze Uhd4Ktz 65"').includes('QN65Q7FAAPCZE'));
});

test('normaliza VTEX: elige el vendedor más barato con stock', () => {
  const [o] = normalizarVtex(comandato, [{
    productId: '1', productName: 'TV 55&quot; ABC55XYZ', brand: 'Marca', link: 'https://www.comandato.com/tv/p',
    items: [{ itemId: '9', ean: '', images: [{ imageUrl: 'https://img/x.png' }], sellers: [
      { commertialOffer: { Price: 300, ListPrice: 400, AvailableQuantity: 0 } },
      { commertialOffer: { Price: 350, ListPrice: 400, AvailableQuantity: 5 } },
    ] }],
  }]);
  assert.equal(o.precio, 350);
  assert.equal(o.precioLista, 400);
  assert.equal(o.disponible, true);
  assert.equal(o.titulo, 'TV 55" ABC55XYZ');
});

test('normaliza WooCommerce: precios en centavos y entidades HTML', () => {
  const [o] = normalizarWoo(computron, [{ id: 1, name: 'Televisor-tv 75&#8243; X &#8211; Y', permalink: 'https://www.computron.com.ec/producto/x/',
    prices: { price: '98867', regular_price: '99899', currency_minor_unit: 2 }, is_in_stock: true, images: [] }]);
  assert.equal(o.precio, 988.67);
  assert.equal(o.precioLista, 998.99);
  assert.equal(o.titulo, 'Televisor-tv 75″ X – Y');
  assert.equal(decodificarHtml('a&amp;b'), 'a&b');
});

test('agrupa la misma referencia de distintas tiendas y ordena por precio', () => {
  const base = { marca: 'LG', ean: '', disponible: true, imagen: null, precioLista: null };
  const grupos = agruparOfertas([
    { ...base, tienda: 'comandato', sku: '1', titulo: 'Televisor LG 65UA7500PSA', precio: 650, url: 'https://www.comandato.com/a/p' },
    { ...base, tienda: 'novicompu', sku: '2', titulo: 'TV LG Led 65Ua7500Psa Negro 65"', precio: 616.52, url: 'https://www.novicompu.com/b/p' },
    { ...base, tienda: 'kywi', sku: '3', titulo: 'Otro producto', precio: 10, url: 'https://www.kywi.com.ec/c/p' },
  ]);
  assert.equal(grupos[0].clave, 'modelo:65UA7500PSA');
  assert.equal(grupos[0].numTiendas, 2);
  assert.equal(grupos[0].desde, 616.52);
  assert.equal(grupos[0].ofertas[0].tienda, 'novicompu');
  assert.equal(claveProducto(grupos[1].ofertas[0]), 'oferta:kywi:3');
});

test('redirector: ida y vuelta, con UTM y sin redirección abierta', () => {
  const id = crearIdOferta({ tienda: 'comandato', url: 'https://www.comandato.com/tv-65/p?skuId=9' });
  const r = resolverIdOferta(id, { posicion: 2 });
  const destino = new URL(r.destino);
  assert.equal(destino.origin, 'https://www.comandato.com');
  assert.equal(destino.pathname, '/tv-65/p');
  assert.equal(destino.searchParams.get('skuId'), '9');
  assert.equal(destino.searchParams.get('utm_source'), 'comparador-ec');
  assert.equal(destino.searchParams.get('utm_content'), 'pos-2');
  // Una URL de otro dominio no genera id, y un id manipulado no redirige fuera.
  assert.equal(crearIdOferta({ tienda: 'comandato', url: 'https://malicioso.example/x' }), null);
  const malo = `comandato~${Buffer.from('//malicioso.example/x').toString('base64url')}`;
  assert.equal(resolverIdOferta(malo), null);
  assert.equal(resolverIdOferta('desconocida~Lw'), null);
});

test('API de extremo a extremo con tiendas simuladas: busca, agrupa y redirige registrando el clic', async () => {
  const { mkdtemp, readFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  process.env.ARCHIVO_CLICS = join(await mkdtemp(join(tmpdir(), 'clics-')), 'clics.jsonl');
  const { crearServidor: crear } = await import(`../src/servidor.mjs?e2e=${Date.now()}`);

  const falso = async (t, q) => {
    if (t.id === 'kywi') throw new Error('tiempo agotado');
    return [{ tienda: t.id, tiendaNombre: t.nombre, titulo: `Refrigeradora ${q.toUpperCase()} RI480XYZ`, marca: 'Indurama', sku: t.id, ean: '',
      precio: { comandato: 700, novicompu: 650, pycca: 720, computron: 699 }[t.id] ?? 800, precioLista: 900, disponible: true, imagen: null, url: `${t.origen}/refri-${t.id}/p` }];
  };
  const srv = crear({ buscarFn: falso }).listen(0);
  await new Promise(r => srv.once('listening', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    const d = await fetch(`${base}/api/buscar?q=prueba`).then(r => r.json());
    assert.equal(d.productos.length, 1, 'todas las tiendas deberían agruparse en un solo producto');
    const p = d.productos[0];
    assert.equal(p.numTiendas, 4);
    assert.equal(p.desde, 650);
    assert.equal(p.ofertas[0].tiendaNombre, 'Novicompu');
    assert.equal(d.tiendas.find(t => t.id === 'kywi').estado, 'error');

    const r = await fetch(base + p.ofertas[0].ir, { redirect: 'manual' });
    assert.equal(r.status, 302);
    assert.match(r.headers.get('location'), /^https:\/\/www\.novicompu\.com\/refri-novicompu\/p\?utm_source=comparador-ec/);
    const log = (await readFile(process.env.ARCHIVO_CLICS, 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(log.length, 1);
    assert.equal(log[0].tienda, 'novicompu');
    assert.equal(log[0].precio, 650);

    const malo = await fetch(`${base}/ir?o=x`, { redirect: 'manual' });
    assert.equal(malo.status, 400);
    const corto = await fetch(`${base}/api/buscar?q=a`);
    assert.equal(corto.status, 400);
  } finally {
    srv.close();
  }
});

test('el servidor no sirve archivos fuera de /public', async () => {
  const srv = crearServidor().listen(0);
  await new Promise(r => srv.once('listening', r));
  try {
    const r = await fetch(`http://127.0.0.1:${srv.address().port}/..%2fpackage.json`);
    assert.notEqual(r.status, 200);
  } finally { srv.close(); }
});
