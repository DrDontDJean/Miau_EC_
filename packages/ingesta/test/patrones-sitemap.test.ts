// Los patrones de producto del seed, contra rutas reales vistas en los sitemaps (12 de noviembre de 2026):
// distinguen la ficha de un producto de una categoría o una página de contenido.
import { describe, expect, it } from 'vitest';
import { baseDePrueba } from './base-pglite.ts';

const CASOS: Record<string, { producto: string[]; otra: string[] }> = {
  crecos: { producto: ['/encimera-a-gas-teka-gbc-95030kbbbk-p88646-5-quemadores/p'], otra: ['/activision', '/electrodomesticos'] },
  japon: { producto: ['/microfono-profesional-wharfedale-dm5-0-pro-p8924-dinam/p'], otra: ['/jonnesway'] },
  orve: { producto: ['/juego-de-cama-mercader593-p66524-2-5-plazas-color-azul/p'], otra: ['/nutrex'] },
  artefacta: { producto: ['/mini-wafflera-umco-550-w-negro-958263/p'], otra: ['/blog/playstation-5-comprar-en-2026'] },
  coral: {
    producto: ['/refrigeradora-tcl-520l-sbs-trf-520-444.html', '/aceitunas-cocktail-vidrio-340g-x88a31f-un.html', '/shampoo-happy-baby-aloe-vera-400ml-2780.html'],
    otra: ['/audio-y-video.html', '/hogar/cocina.html'],
  },
  tia: {
    producto: ['/combo-gel-hidratante-neutrogena-hydro-boost-50-g-x-2-163684000.html',
      '/deportes/gimnasio/ligas-y-accesorios/mancuerna-tpu-5-lb-active-life-192429000.html'],
    otra: ['/hogar/cocina-y-comedor', '/campa-as-marketing/precyber-papa'],
  },
  sukasa: { producto: ['/productos/black-decker-licuadora-bl1140mb-negro-con-12'], otra: ['/departamentos/electrodomesticos/62fd18ff'] },
  tventas: { producto: ['/hogar/65789-brazo-extensor-jobar-ret7440blk-0178740526.html'], otra: ['/hogar', '/contactenos'] },
  boyaca: {
    producto: ['/bano/cabinas-de-hidromasaje/cabina-90-x-90-x-215-cm-con-jets-63975', '/navidad/santas-tale/bola-navidena-de-8cm-6-piezas-rojo-111679'],
    otra: ['/bano', '/bano/cabinas-de-hidromasaje'],
  },
  fybeca: { producto: ['/dayamineral-jarabe-f240-ml/ECFY_4.html', '/zymaran-sol.-oftalm-.3--f-5ml-/ECFY_94271.html'], otra: ['/farmacia.html', '/medicinas/ofertas'] },
};

describe('patrones de producto del seed', async () => {
  const { ejecutar } = await baseDePrueba();
  const filas = await ejecutar(`select id, url_sitemap, patron_producto from public.tienda where plataforma = 'sitemap' and estado = 'activa'`);

  it('cada tienda sitemap activa tiene su caso de prueba y su sitemap', () => {
    expect(filas.map(f => f.id).sort()).toEqual(Object.keys(CASOS).sort());
    expect(filas.every(f => String(f.url_sitemap).startsWith('https://'))).toBe(true);
  });

  it.each(Object.entries(CASOS))('%s: acepta fichas de producto y rechaza categorías y páginas de contenido', (id, { producto, otra }) => {
    const patron = new RegExp(String(filas.find(f => f.id === id)!.patron_producto));
    for (const ruta of producto) expect(patron.test(ruta), `${id} debería aceptar ${ruta}`).toBe(true);
    for (const ruta of otra) expect(patron.test(ruta), `${id} debería rechazar ${ruta}`).toBe(false);
  });
});
