// Fuente sitemap: sitemaps, datos estructurados de producto, presupuesto diario y negativas de la tienda.
// Las páginas son HTML mínimo escrito a mano: las pruebas nunca leen tiendas reales.
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { fuentePara } from '../src/index.ts';
import {
  analizarSitemap, elegirHijos, elegirPaginas, extraerProducto, skuDe, tieneProducto,
} from '../src/fuentes/sitemap.ts';
import { fetchFalso, tienda, todas, type Respuesta } from './apoyo.ts';

const ORIGEN = 'https://www.crecos.com';
const crecos = tienda({
  id: 'crecos', nombre: 'Créditos Económicos', origen: ORIGEN, plataforma: 'sitemap',
  patron_producto: '/p$', paginas_por_corrida: 2500,
});

const jsonLd = (producto: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(producto)}</script></head><body></body></html>`;
const producto = (extra: Record<string, unknown> = {}) => ({
  '@context': 'https://schema.org', '@type': 'Product', name: 'Encimera a gas Teka GBC 95030', sku: '00008442', gtin: '00008442',
  brand: { '@type': 'Brand', name: 'Teka' }, image: 'https://crecos.vteximg.com.br/i.jpg',
  offers: { '@type': 'Offer', price: 490.55, priceCurrency: 'USD', availability: 'http://schema.org/InStock' }, ...extra,
});
const urlset = (...urls: (string | [string, string])[]) =>
  `<?xml version="1.0"?><urlset>${urls.map(u => {
    const [loc, lastmod] = Array.isArray(u) ? u : [u, null];
    return `<url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
  }).join('')}</urlset>`;
const indice = (...locs: string[]) => `<?xml version="1.0"?><sitemapindex>${locs.map(l => `<sitemap><loc>${l}</loc></sitemap>`).join('')}</sitemapindex>`;

describe('extraerProducto', () => {
  it('lee el JSON-LD de un producto (como las tiendas VTEX): nombre, precio, moneda, stock, SKU, GTIN, imagen y marca', () => {
    expect(extraerProducto(jsonLd(producto()))).toEqual({
      nombre: 'Encimera a gas Teka GBC 95030', precio: 490.55, moneda: 'USD', disponible: true,
      sku: '00008442', ean: '00008442', imagen: 'https://crecos.vteximg.com.br/i.jpg', marca: 'Teka',
    });
  });

  it('encuentra el producto dentro de @graph y con @type como lista', () => {
    const html = jsonLd({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite', name: 'Tienda' }, producto({ '@type': ['Product', 'Thing'] })] });
    expect(extraerProducto(html)).toMatchObject({ nombre: 'Encimera a gas Teka GBC 95030', precio: 490.55 });
  });

  it('con varias ofertas elige la más barata con stock', () => {
    const offers = [
      { '@type': 'Offer', price: '120.00', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
      { '@type': 'Offer', price: '99.00', priceCurrency: 'USD', availability: 'https://schema.org/OutOfStock' },
      { '@type': 'Offer', price: '110,5', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
    ];
    expect(extraerProducto(jsonLd(producto({ offers })))).toMatchObject({ precio: 110.5, disponible: true });
  });

  it('una AggregateOffer usa lowPrice', () => {
    const offers = { '@type': 'AggregateOffer', lowPrice: 45.9, highPrice: 60, priceCurrency: 'USD' };
    expect(extraerProducto(jsonLd(producto({ offers })))).toMatchObject({ precio: 45.9, disponible: null });
  });

  it('un producto OutOfStock conserva su precio y queda sin stock', () => {
    const offers = { '@type': 'Offer', price: 0, priceCurrency: 'USD', availability: 'https://schema.org/OutOfStock' };
    expect(extraerProducto(jsonLd(producto({ offers })))).toMatchObject({ precio: 0, disponible: false });
  });

  it('sin JSON-LD usa los metadatos Open Graph, con cualquier orden de atributos y entidades HTML', () => {
    const html = `<html><head>
      <meta property="og:title" content="Atún ahumado &amp; lata abre fácil 170 g">
      <meta content="2.35" property="product:price:amount">
      <meta property="product:price:currency" content="usd">
      <meta property='og:availability' content='instock'>
      <meta property="og:image" content="https://coral.example/atun.jpg"/>
    </head></html>`;
    expect(extraerProducto(html)).toEqual({
      nombre: 'Atún ahumado & lata abre fácil 170 g', precio: 2.35, moneda: 'USD', disponible: true,
      sku: null, ean: null, imagen: 'https://coral.example/atun.jpg', marca: null,
    });
  });

  it('un JSON-LD inválido se ignora y se usa Open Graph', () => {
    const html = `<script type="application/ld+json">{ no es json </script><meta property="product:price:amount" content="9.99">`;
    expect(extraerProducto(html)).toMatchObject({ precio: 9.99 });
  });

  it('una página sin precio en datos estructurados no es un producto', () => {
    expect(extraerProducto('<html><body><h1>Quiénes somos</h1></body></html>')).toBeNull();
    expect(extraerProducto(jsonLd(producto({ offers: undefined })))).toBeNull();
    expect(extraerProducto(jsonLd({ '@type': 'Organization', name: 'Tienda' }))).toBeNull();
  });
});

describe('lectura parcial de la página', () => {
  it('tieneProducto avisa cuando el JSON-LD del producto ya llegó completo', () => {
    const cabecera = '<html><head><title>x</title></head><body>';
    const ld = JSON.stringify(producto());
    expect(tieneProducto(cabecera)).toBe(false);
    expect(tieneProducto(`${cabecera}<script type="application/ld+json">${ld.slice(0, 40)}`)).toBe(false);   // el bloque no terminó
    expect(tieneProducto(`${cabecera}<script type="application/ld+json">${ld}</script>`)).toBe(true);
    expect(tieneProducto(`<script type="application/ld+json">{"@type": ["Product","Thing"],"name":"x"}</script>`)).toBe(true);
    expect(tieneProducto('<script type="application/ld+json">{"@type":"Organization"}</script>')).toBe(false);
  });

  it('skuDe usa el SKU de la tienda o la ruta, y resume las rutas de más de 100 caracteres', () => {
    expect(skuDe('00008442', '/x/p')).toBe('00008442');
    expect(skuDe(null, '/mini-wafflera-umco-550-w-negro-958263/p')).toBe('mini-wafflera-umco-550-w-negro-958263/p');
    expect(skuDe(null, '/')).toBeNull();
    const largo = skuDe(null, `/${'a'.repeat(150)}/p`)!;
    expect(largo).toMatch(/^h-[0-9a-f]{40}$/);
    expect(largo.length).toBeLessThanOrEqual(100);
    expect(skuDe(null, `/${'a'.repeat(150)}/p`)).toBe(largo);   // estable entre corridas
    expect(skuDe(null, `/${'b'.repeat(150)}/p`)).not.toBe(largo);
  });

  it('una ficha de varios MB se lee igual: lo que importa está al principio', async () => {
    const enorme = `<html><head></head><body><script type="application/ld+json">${JSON.stringify(producto())}</script>${'<div>relleno</div>'.repeat(300_000)}</body></html>`;
    expect(enorme.length).toBeGreaterThan(3_000_000);
    const srv = servidor({ '/sitemap.xml': urlset(`${ORIGEN}/a-p1/p`), '/a-p1/p': enorme });
    const { ofertas } = await leer(srv);
    expect(ofertas).toHaveLength(1);
    expect(ofertas[0]).toMatchObject({ sku_tienda: '00008442', precio: 490.55, disponible: true });
  });

  it('una ficha sin SKU y con una ruta larguísima entrega un SKU que cabe en la base', async () => {
    const ruta = `/${'producto-con-un-nombre-muy-largo-'.repeat(6)}p99/p`;
    const sinSku = jsonLd(producto({ sku: undefined }));
    const srv = servidor({ '/sitemap.xml': urlset(`${ORIGEN}${ruta}`), [ruta]: sinSku });
    const { ofertas } = await leer(srv);
    expect(ofertas[0]!.sku_tienda).toMatch(/^h-[0-9a-f]{40}$/);
  });
});

describe('sitemaps', () => {
  it('analizarSitemap lee <loc> y <lastmod>, con CDATA y entidades, y distingue un índice', () => {
    const xml = `<urlset><url><loc><![CDATA[${ORIGEN}/a-p1/p]]></loc><lastmod>2026-11-01</lastmod></url><url><loc>${ORIGEN}/b?x=1&amp;y=2</loc></url></urlset>`;
    expect(analizarSitemap(xml)).toEqual({
      indice: false,
      entradas: [{ loc: `${ORIGEN}/a-p1/p`, lastmod: '2026-11-01' }, { loc: `${ORIGEN}/b?x=1&y=2`, lastmod: null }],
    });
    expect(analizarSitemap(indice(`${ORIGEN}/sitemap/product-0.xml`)).indice).toBe(true);
  });

  it('de un índice se eligen los sitemaps de productos y se descartan marcas, categorías y páginas', () => {
    const vtex = ['brand-0', 'category-0', 'custom-apps-routes-1', 'product-0', 'product-1'].map(n => `${ORIGEN}/sitemap/${n}.xml`);
    expect(elegirHijos(vtex)).toEqual([`${ORIGEN}/sitemap/product-0.xml`, `${ORIGEN}/sitemap/product-1.xml`]);
    const magento = [1, 2, 3].map(n => `https://coral.example/media/sitemap/coralsitemap-2-${n}.xml`);
    expect(elegirHijos(magento)).toEqual(magento);   // ninguno dice "product": se toman todos
    expect(elegirHijos(['https://t.example/sitemaps/paginas.xml', 'https://t.example/sitemaps/otros.xml'])).toEqual(['https://t.example/sitemaps/otros.xml']);
  });

  it('elegirPaginas lee primero lo nunca visto, luego lo modificado y luego lo más viejo, dentro del presupuesto', () => {
    const entradas = new Map<string, string | null>([
      ['https://t.example/vista-vieja', '2026-01-01'],
      ['https://t.example/modificada-hace-poco', '2026-11-10'],
      ['https://t.example/nueva-1', null],
      ['https://t.example/vista-reciente', '2026-01-01'],
      ['https://t.example/modificada-antes', '2026-10-05'],
      ['https://t.example/nueva-2', '2026-02-01'],
    ]);
    const visitas = new Map([
      ['https://t.example/vista-vieja', '2026-09-01T00:00:00Z'],
      ['https://t.example/vista-reciente', '2026-11-11T00:00:00Z'],
      ['https://t.example/modificada-hace-poco', '2026-11-01T00:00:00Z'],
      ['https://t.example/modificada-antes', '2026-10-01T00:00:00Z'],
    ]);
    expect(elegirPaginas(entradas, visitas, 10)).toEqual([
      'https://t.example/nueva-1', 'https://t.example/nueva-2',
      'https://t.example/modificada-hace-poco', 'https://t.example/modificada-antes',
      'https://t.example/vista-vieja', 'https://t.example/vista-reciente',
    ]);
    expect(elegirPaginas(entradas, visitas, 3)).toEqual(['https://t.example/nueva-1', 'https://t.example/nueva-2', 'https://t.example/modificada-hace-poco']);
  });
});

// Una tienda simulada: sitemaps y páginas por ruta.
function servidor(rutas: Record<string, Respuesta | string>) {
  return fetchFalso(url => {
    const r = rutas[url.pathname];
    return typeof r === 'string' ? { texto: r } : r;
  });
}
const leer = async (srv: ReturnType<typeof servidor>, t = crecos, contexto = {}) => {
  const fuente = fuentePara(t, { fetch: srv.fetch, esperar: async () => {} }, contexto);
  const ofertas = (await todas(fuente.leer())).flat();
  return { fuente, ofertas };
};
const pedidas = (srv: ReturnType<typeof servidor>) => srv.peticiones.map(p => new URL(p.url).pathname);
const pagina = (nombre: string, precio = 10) => jsonLd(producto({ name: nombre, sku: nombre, offers: { price: precio, priceCurrency: 'USD' } }));

describe('fuente sitemap', () => {
  it('recorre el índice (incluido un .xml.gz), salta marcas y URLs ajenas, que no sean producto o que el robots.txt prohíbe', async () => {
    const srv = servidor({
      '/sitemap.xml': indice(`${ORIGEN}/sitemap/brand-0.xml`, `${ORIGEN}/sitemap/product-0.xml`, `${ORIGEN}/sitemap/product-1.xml.gz`),
      '/sitemap/product-0.xml': urlset(`${ORIGEN}/a-p1/p`, `${ORIGEN}/b-p2/p`, `${ORIGEN}/c/`, 'https://otra.com/x-p3/p', `${ORIGEN}/prohibido-p4/p`),
      '/sitemap/product-1.xml.gz': { bytes: gzipSync(urlset(`${ORIGEN}/d-p5/p`)) },
      '/a-p1/p': pagina('a'), '/b-p2/p': pagina('b'), '/d-p5/p': pagina('d'),
    });
    const { fuente, ofertas } = await leer(srv, crecos, { leerRobots: async () => 'User-agent: *\nDisallow: /prohibido' });

    expect(ofertas.map(o => o.sku_tienda)).toEqual(['a', 'b', 'd']);
    expect(pedidas(srv)).not.toContain('/sitemap/brand-0.xml');
    expect(pedidas(srv)).not.toContain('/prohibido-p4/p');
    expect(pedidas(srv)).not.toContain('/c/');
    expect(srv.peticiones.every(p => p.agente?.startsWith('DecideAqui/'))).toBe(true);
    expect(fuente.incompleta?.()).toBeNull();
    expect(fuente.reconciliar?.()).toEqual({ vigentes: [`${ORIGEN}/a-p1/p`, `${ORIGEN}/b-p2/p`, `${ORIGEN}/d-p5/p`], retiradas: [] });
    expect(ofertas[0]).toEqual({
      sku_tienda: 'a', titulo: 'a', url: `${ORIGEN}/a-p1/p`, imagen_url: 'https://crecos.vteximg.com.br/i.jpg',
      precio: 10, precio_lista: null, moneda: 'USD', disponible: null, ean: '00008442', marca: 'Teka',
    });
  });

  it('sin url_sitemap usa la línea Sitemap: del robots.txt', async () => {
    const srv = servidor({ '/mapa-de-la-tienda.xml': urlset(`${ORIGEN}/a-p1/p`), '/a-p1/p': pagina('a') });
    const { ofertas } = await leer(srv, { ...crecos, url_sitemap: null },
      { leerRobots: async () => `User-agent: *\nDisallow: /checkout\nSitemap: ${ORIGEN}/mapa-de-la-tienda.xml` });
    expect(ofertas).toHaveLength(1);
  });

  it('lee como mucho paginas_por_corrida páginas, empezando por las nunca vistas', async () => {
    const urls = ['uno', 'dos', 'tres', 'cuatro'].map(n => `${ORIGEN}/${n}-p/p`);
    const srv = servidor({
      '/sitemap.xml': urlset(...urls),
      ...Object.fromEntries(['uno', 'dos', 'tres', 'cuatro'].map(n => [`/${n}-p/p`, pagina(n)])),
    });
    const visitas = new Map([[urls[0]!, '2026-11-12T00:00:00Z'], [urls[1]!, '2026-11-01T00:00:00Z']]);
    const { ofertas, fuente } = await leer(srv, { ...crecos, paginas_por_corrida: 3 }, { ultimasVisitas: async () => visitas });
    expect(ofertas.map(o => o.sku_tienda)).toEqual(['tres', 'cuatro', 'dos']);   // nuevas, y luego la visitada hace más
    expect(fuente.reconciliar?.()?.vigentes).toHaveLength(4);                    // el sitemap completo sigue vigente
    expect(fuente.incompleta?.()).toBeNull();
  });

  it('una página que da 404 o 410 se anota como retirada y no se carga', async () => {
    const srv = servidor({
      '/sitemap.xml': urlset(`${ORIGEN}/a-p1/p`, `${ORIGEN}/b-p2/p`, `${ORIGEN}/c-p3/p`),
      '/a-p1/p': pagina('a'), '/b-p2/p': { status: 404, texto: 'no existe' }, '/c-p3/p': { status: 410, texto: 'retirada' },
    });
    const { fuente, ofertas } = await leer(srv);
    expect(ofertas.map(o => o.sku_tienda)).toEqual(['a']);
    expect(fuente.reconciliar?.()?.retiradas).toEqual([`${ORIGEN}/b-p2/p`, `${ORIGEN}/c-p3/p`]);
  });

  it('si más del 20 % de las páginas no trae datos de producto, la fuente se declara incompleta', async () => {
    const slugs = Array.from({ length: 25 }, (_, i) => `p${i}`);
    const rutas = (sinDatos: number) => ({
      '/sitemap.xml': urlset(...slugs.map(s => `${ORIGEN}/${s}-x/p`)),
      ...Object.fromEntries(slugs.map((s, i) => [`/${s}-x/p`, i < sinDatos ? '<html><body>otra cosa</body></html>' : pagina(s)])),
    });
    expect((await leer(servidor(rutas(10)))).fuente.incompleta?.()).toMatch(/10 de 25 páginas de crecos no trajeron datos/);
    expect((await leer(servidor(rutas(3)))).fuente.incompleta?.()).toBeNull();
  });

  it('una racha de 403 detiene la lectura sin insistir ni evadir el bloqueo', async () => {
    const slugs = Array.from({ length: 30 }, (_, i) => `p${i}`);
    const srv = servidor({
      '/sitemap.xml': urlset(...slugs.map(s => `${ORIGEN}/${s}-x/p`)),
      ...Object.fromEntries(slugs.map(s => [`/${s}-x/p`, { status: 403, texto: 'bloqueado' }])),
    });
    await expect(leer(srv)).rejects.toThrow(/HTTP 403 repetido en crecos/);
    expect(pedidas(srv).filter(p => p.endsWith('/p'))).toHaveLength(10);
    expect(srv.peticiones.every(p => p.agente?.startsWith('DecideAqui/'))).toBe(true);
  });

  it('un sitemap sin URLs de producto hace fallar la corrida: no se reconcilia contra una lista vacía', async () => {
    const srv = servidor({ '/sitemap.xml': urlset(`${ORIGEN}/quienes-somos`) });
    await expect(leer(srv)).rejects.toThrow(/no tiene URLs de producto/);
  });

  it('si un sitemap hijo falla, la corrida falla: una lista parcial desactivaría ofertas vigentes', async () => {
    const srv = servidor({
      '/sitemap.xml': indice(`${ORIGEN}/sitemap/product-0.xml`),
      '/sitemap/product-0.xml': { status: 500, texto: 'error' },
    });
    await expect(leer(srv)).rejects.toThrow(/HTTP 500 al leer el sitemap/);
  });

  it('si el robots.txt prohíbe el sitemap, no se lee nada', async () => {
    const srv = servidor({ '/sitemap.xml': urlset(`${ORIGEN}/a-p1/p`) });
    await expect(leer(srv, crecos, { leerRobots: async () => 'User-agent: *\nDisallow: /sitemap.xml' })).rejects.toThrow(/prohíbe el sitemap/);
    expect(srv.peticiones).toHaveLength(0);
  });

  it('el patrón de producto es obligatorio', async () => {
    await expect(leer(servidor({}), { ...crecos, patron_producto: null })).rejects.toThrow(/no tiene patron_producto/);
  });
});
