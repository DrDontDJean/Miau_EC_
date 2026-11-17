import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { categoriaDe, type SlugCategoria } from '../src/categoria.ts';

type Etiqueta = { titulo: string; categoria: SlugCategoria | null };
// 846 títulos reales de la web (17 de noviembre de 2026) etiquetados a mano: 535 de las cinco categorías y 311 que no
// lo son, entre ellos los que se cuelan por compartir palabra (mochilas y maletines para laptop, parlantes portátiles,
// controles y soportes de TV, teléfonos fijos, secadoras solas, protectores de voltaje, celulosa).
const DORADO: Etiqueta[] = JSON.parse(readFileSync(new URL('./fixtures/categorias-dorado.json', import.meta.url), 'utf8'));

describe('categoriaDe: conjunto dorado', () => {
  const resultados = DORADO.map(e => ({ ...e, obtenida: categoriaDe({ titulo: e.titulo }) }));
  const asignados = resultados.filter(r => r.obtenida !== null);
  const correctos = asignados.filter(r => r.obtenida === r.categoria);
  const positivos = resultados.filter(r => r.categoria !== null);
  const cubiertos = positivos.filter(r => r.obtenida === r.categoria);

  it('precisión ≥ 95 %: lo que se clasifica, se clasifica bien', () => {
    const errores = asignados.filter(r => r.obtenida !== r.categoria).map(r => `${r.obtenida} ← ${r.titulo} (era ${r.categoria})`);
    expect(correctos.length / asignados.length, errores.join('\n')).toBeGreaterThanOrEqual(0.95);
  });

  it('cobertura ≥ 85 %: casi todos los productos de cada categoría quedan en ella', () => {
    expect(cubiertos.length / positivos.length).toBeGreaterThanOrEqual(0.85);
    for (const c of ['laptops', 'televisores', 'celulares', 'refrigeradoras', 'lavadoras'] as const) {
      const de = positivos.filter(r => r.categoria === c);
      expect(de.filter(r => r.obtenida === c).length / de.length, c).toBeGreaterThanOrEqual(0.8);
    }
  });

  it('informa las cifras', () => {
    console.log(`categoriaDe: precisión ${(100 * correctos.length / asignados.length).toFixed(1)} %, cobertura ${(100 * cubiertos.length / positivos.length).toFixed(1)} % (${DORADO.length} títulos)`);
  });
});

describe('categoriaDe: casos', () => {
  it.each([
    ['Laptop Lenovo IdeaPad Slim 3 15.6" Ryzen 5 16GB 512GB', 'laptops'],
    ['Dell Laptop Touch DC15255 15.6" R7-7730U 16GB | 512GB SSD', 'laptops'],
    ['PORTATIL X1504ZA-BQ1862 CORE I3 8GB 512GB 15.6PLG W11', 'laptops'],
    ['Televisor 55" 4K UHD Tizen UN55U8000FPCZE Samsung', 'televisores'],
    ['Smart TV Samsung LED UHD Tizen - 32"', 'televisores'],
    ['TELEVISOR TV LG 55" 55UA8550PSA 4K UHD', 'televisores'],
    ['Celular Xiaomi Redmi 15C - 4/256GB', 'celulares'],
    ['Apple iPhone 15 128GB Open Box', 'celulares'],
    ['TELEFONO CELULAR REDMI A7 PRO 4GB 128GB', 'celulares'],
    ['Refrigerador Minibar 90 Lt RMF04CV1 Mabe', 'refrigeradoras'],
    ['Electrolux Refrigeradora Bottom Freeze ERB163HS 166L', 'refrigeradoras'],
    ['Lavadora Semiautomática Mabe 11Kg', 'lavadoras'],
    ['Mabe Torre Lavadora / Secadora Eléctrica MCL2440EPDG0', 'lavadoras'],
    ['Torre de Lavado y Secado a Gas Mabe 24 Kilos Blanco', 'lavadoras'],
    ['Torre de lavado 2 en 1 de 24 kg negra Ultra Capacity', 'lavadoras'],
    ['Minibar Croma Ri-150Cr Indurama', 'refrigeradoras'],
    ['Motorola Smart TV 50" | Google TV | 4K UHD', 'televisores'],
    ['Asus Laptop Vivobook Go E1504F 15.6" AMD Ryzen 5', 'laptops'],
  ] as const)('%s → %s', (titulo, esperada) => {
    expect(categoriaDe({ titulo })).toBe(esperada);
  });

  it.each([
    'Mochila P-Laptop Clasica Wine 14plg',
    'Maletín para Laptop 15.6 pulgadas',
    'MEMORIA RAM DDR4 SO-DIMM 8GB KINGSTON LAPTOP',
    'Laptop Didáctica V2',
    'Parlante Portátil Sony Srs-Ult10 Negro',
    'Control de Televisor Samsung universal',
    'Soporte Para TV Vmax 42 hasta 120"',
    'Rack para TV Commodity MDP Blanco',
    'Protector De Voltaje P/Tv Y Refrigerador',
    'Esponja de celulosa para cocina',
    'Tratamiento Capilar Células Madre',
    'Portarrollo Celular Acero inoxidable',
    'Teléfono inalámbrico digital color negro KX-TGB112',
    'Forro Antigolpes Iface iPhone 11 Dorado',
    'Secadora a Gas Samsung Dv22C6370Pw/Ap 22Kg',
    'Manguera Century Lavadora 2M',
    'Congelador Horizontal Whirlpool Dual Cooling 302L Blanco',
    'Dispensador de Agua Whirlpool con Refrigerador Inferior Negro',
    'Tablet Lenovo Idea Tab Pro 12.7" 8Gb Ram 256Gb',
    'Electrolux Lavavajillas Freestanding 8 Servicios',
  ])('%s → ninguna', (titulo) => {
    expect(categoriaDe({ titulo })).toBeNull();
  });

  it('las palabras que coinciden con propiedades de JavaScript no son categorías ("constructor", "toString")', () => {
    for (const titulo of ['Constructor de bloques magnéticos 64 piezas', 'toString hasOwnProperty valueOf', '__proto__ prototype']) {
      expect(categoriaDe({ titulo })).toBeNull();
    }
  });

  it('la categoría que publica la tienda decide cuando el título no alcanza', () => {
    expect(categoriaDe({ titulo: 'Redmi 13 128GB Negro', categoriaTienda: 'Tecnología/Celulares' })).toBe('celulares');
    expect(categoriaDe({ titulo: 'Mochila P-Laptop 14plg', categoriaTienda: 'Computación/Laptops' })).toBeNull();
  });
});
