// Corridas de tiendas de plataforma 'sitemap' contra el SQL real (PGlite): reconciliación y cierre.
import { describe, expect, it } from 'vitest';
import type { OfertaCruda } from '@comparador/dominio';
import { almacenPostgres, ejecutarCorrida, fuentePara, type Fuente } from '../src/index.ts';
import { baseDePrueba } from './base-pglite.ts';
import { fetchFalso, tienda } from './apoyo.ts';

const ORIGEN = 'https://www.comandato.com';
const comandato = tienda({
  id: 'comandato', nombre: 'Comandato', origen: ORIGEN, plataforma: 'sitemap', patron_producto: '/p$', paginas_por_corrida: 2,
});
const ROBOTS = 'User-agent: *\nDisallow: /checkout/*';
const url = (sku: string) => `${ORIGEN}/${sku}/p`;
const oferta = (sku: string, precio = 100): OfertaCruda => ({
  sku_tienda: sku, titulo: `Producto ${sku} ABC${sku.length}${sku}`, url: url(sku), imagen_url: 'https://i.example/i.png',
  precio, precio_lista: null, moneda: 'USD', disponible: true, ean: null, marca: null,
});
/** Una fuente que lee solo `leidas` (el presupuesto del día) y reconcilia contra el sitemap completo. */
const fuente = (leidas: OfertaCruda[], vigentes: string[], retiradas: string[] = []): Fuente => ({
  async *leer() { yield leidas; },
  reconciliar: () => ({ vigentes, retiradas }),
});

async function preparar() {
  const base = await baseDePrueba();
  await base.ejecutar(`update public.tienda set plataforma = 'sitemap', patron_producto = '/p$' where id = 'comandato'`);
  const almacen = almacenPostgres(base.ejecutar);
  const correr = (f: Fuente) => ejecutarCorrida(comandato, { fuente: f, almacen, leerRobots: async () => ROBOTS });
  const activas = async () => (await base.ejecutar(`select sku_tienda from public.oferta where activa order by 1`)).map(o => o.sku_tienda);
  return { ...base, correr, activas };
}
const TODAS = ['A', 'B', 'C', 'D'];

describe('corridas de una tienda sitemap', () => {
  it('no desactiva por no haber visitado todavía: solo lo que sale del sitemap o la tienda retiró', async () => {
    const { correr, activas, ejecutar } = await preparar();
    const r1 = await correr(fuente(TODAS.map(s => oferta(s)), TODAS.map(url)));
    expect(r1).toMatchObject({ estado: 'ok', nuevas: 4, desactivadas: 0 });

    // Dos corridas más que solo visitan A: con la regla de las dos ausencias, B, C y D se habrían desactivado.
    await correr(fuente([oferta('A')], TODAS.map(url)));
    const r3 = await correr(fuente([oferta('A')], TODAS.map(url)));
    expect(r3).toMatchObject({ estado: 'ok', desactivadas: 0 });
    expect(await activas()).toEqual(TODAS);

    // D sale del sitemap y C devuelve 404: se desactivan las dos.
    const r4 = await correr(fuente([], ['A', 'B', 'C'].map(url), [url('C')]));
    expect(r4).toMatchObject({ estado: 'ok', desactivadas: 2 });
    expect(await activas()).toEqual(['A', 'B']);
    expect(await ejecutar(`select desactivadas from calidad.resumen_corrida where corrida_id = $1`, [r4.corrida_id])).toEqual([{ desactivadas: 2 }]);
  });

  it('si el sitemap trae menos de la mitad de las ofertas activas, no desactiva por salir de él y lo anota', async () => {
    const { correr, activas, ejecutar } = await preparar();
    await correr(fuente(TODAS.map(s => oferta(s)), TODAS.map(url)));
    const r = await correr(fuente([], [url('A')], [url('B')]));   // un sitemap de 1 URL para 4 ofertas activas
    expect(r).toMatchObject({ estado: 'ok', desactivadas: 1 });   // solo la retirada (404) se desactiva
    expect(await activas()).toEqual(['A', 'C', 'D']);
    expect(await ejecutar(`select count(*)::int n from calidad.incidencia where regla_id = 'caida_de_volumen' and corrida_id = $1`, [r.corrida_id]))
      .toEqual([{ n: 1 }]);
  });

  it('un sitemap vacío no desactiva nada', async () => {
    const { correr, activas } = await preparar();
    await correr(fuente(TODAS.map(s => oferta(s)), TODAS.map(url)));
    await correr(fuente([], [], [url('A')]));
    expect(await activas()).toEqual(TODAS);
  });

  it('al desactivar, el producto deja de contar esa tienda', async () => {
    const { correr, ejecutar } = await preparar();
    await correr(fuente([oferta('A', 50)], [url('A')]));
    expect(await ejecutar(`select num_tiendas::int n from public.producto`)).toEqual([{ n: 1 }]);
    await correr(fuente([], [url('A')], [url('A')]));
    expect(await ejecutar(`select num_tiendas::int n from public.producto`)).toEqual([{ n: 0 }]);
  });

  it('una tienda de otra plataforma sigue desactivando por dos ausencias seguidas', async () => {
    const base = await baseDePrueba();
    const almacen = almacenPostgres(base.ejecutar);
    const vtex = tienda({ id: 'comandato', nombre: 'Comandato', origen: ORIGEN, plataforma: 'vtex' });
    const correr = (...ofertas: OfertaCruda[]) => ejecutarCorrida(vtex, {
      fuente: { async *leer() { yield ofertas; } }, almacen, leerRobots: async () => ROBOTS });
    await correr(oferta('A'), oferta('B'));
    await correr(oferta('A'), oferta('B'));
    await correr(oferta('A'));
    const r = await correr(oferta('A'));
    expect(r.desactivadas).toBe(1);
  });
});

describe('de punta a punta: sitemap, páginas y base', () => {
  const pagina = (sku: string, precio: number, disponibilidad = 'InStock') =>
    `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Product', name: `Producto ${sku} XYZ${sku}1`, sku,
      offers: { price: precio, priceCurrency: 'USD', availability: `https://schema.org/${disponibilidad}` } })}</script>`;

  it('lee según el presupuesto, empieza por lo nunca visto y separa las agotadas', async () => {
    const { ejecutar, correr: _ } = await preparar();
    const almacen = almacenPostgres(ejecutar);
    const slugs = ['a', 'b', 'c'];
    const srv = fetchFalso(u => {
      if (u.pathname === '/sitemap.xml') return { texto: `<urlset>${slugs.map(s => `<url><loc>${url(s)}</loc></url>`).join('')}</urlset>` };
      if (u.pathname === '/a/p') return { texto: pagina('a', 120) };
      if (u.pathname === '/b/p') return { texto: pagina('b', 0, 'OutOfStock') };   // agotada y sin precio: no se publica
      if (u.pathname === '/c/p') return { texto: pagina('c', 80) };
    });
    const ultimasVisitas = async () => new Map(
      (await ejecutar(`select url, visto_ultima_vez::text visto from public.oferta where tienda_id = 'comandato'`))
        .map(f => [String(f.url), String(f.visto)] as const));
    const correr = () => ejecutarCorrida(comandato, {
      fuente: fuentePara(comandato, { fetch: srv.fetch, esperar: async () => {} }, { leerRobots: async () => ROBOTS, ultimasVisitas }),
      almacen, leerRobots: async () => ROBOTS,
    });

    const r1 = await correr();   // presupuesto 2: a y b
    expect(r1).toMatchObject({ estado: 'ok', nuevas: 1, agotadas: 1, en_cuarentena: 0 });
    expect(await ejecutar(`select sku_tienda from public.oferta order by 1`)).toEqual([{ sku_tienda: 'a' }]);

    srv.peticiones.length = 0;
    const r2 = await correr();   // la nunca vista (c) va primero y completa el presupuesto con la visitada hace más (a)
    expect(r2).toMatchObject({ estado: 'ok', nuevas: 1 });
    const paginasLeidas = srv.peticiones.map(p => new URL(p.url).pathname).filter(p => p.endsWith('/p'));
    expect(paginasLeidas).toEqual(['/b/p', '/c/p']);   // b nunca llegó a publicarse, así que sigue "nunca vista"
    expect(await ejecutar(`select sku_tienda, precio::float8 precio from public.oferta order by 1`))
      .toEqual([{ sku_tienda: 'a', precio: 120 }, { sku_tienda: 'c', precio: 80 }]);
  });

  it('si el robots.txt prohíbe el sitemap, la tienda queda sin permiso y no se lee nada más', async () => {
    const { ejecutar } = await preparar();
    const srv = fetchFalso(() => ({ texto: '' }));
    const r = await ejecutarCorrida(comandato, {
      fuente: fuentePara(comandato, { fetch: srv.fetch, esperar: async () => {} }),
      almacen: almacenPostgres(ejecutar), leerRobots: async () => 'User-agent: *\nDisallow: /sitemap.xml',
    });
    expect(r).toMatchObject({ estado: 'sin_permiso' });
    expect(srv.peticiones).toHaveLength(0);
  });
});
