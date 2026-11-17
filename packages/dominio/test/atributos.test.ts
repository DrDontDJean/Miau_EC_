import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { atributosDe } from '../src/atributos.ts';
import type { SlugCategoria } from '../src/categoria.ts';

describe('atributosDe: laptops', () => {
  it.each([
    ['LAPTOP LENOVO IDEAPAD SLIM 3 15.6" FHD AMD RYZEN 5 7520U 16GB DDR5 512GB SSD', { marca: ['lenovo'], procesador: ['amd'], ram: ['16'], almacenamiento: ['512gb'], pantalla: ['15-6'], gpu: ['integrada'] }],
    ['Laptop Asus Core i5 13va, 8gb+512gb, w11', { marca: ['asus'], procesador: ['intel'], ram: ['8'], almacenamiento: ['512gb'], gpu: ['integrada'] }],
    ['Laptop Lenovo R5-8645Hs Nb Ip 5 14Ahp9 R5-8Hs - 14" | 16/512GB', { procesador: ['amd'], ram: ['16'], almacenamiento: ['512gb'], pantalla: ['14-a-15-5'] }],
    ['LAPTOP ASUS GAMING V16 INTEL CORE 7 240H 16GB 1TB SSD RTX 5060 8GB 16" WUXGA', { procesador: ['intel'], ram: ['16'], almacenamiento: ['1tb'], pantalla: ['16-o-mas'], gpu: ['nvidia'] }],
    ['LAPTOP ASUS E410 14" FULL HD INTEL CELERON N4500 4GB RAM 64GB EMMC WINDOWS 11', { procesador: ['intel'], ram: ['4'], almacenamiento: ['128gb-o-menos'], pantalla: ['14-a-15-5'] }],
    ['Laptop Asus Ultra 7, 16gb, 1tb, | 15.6 pulgadas 2880x1620 16 GB RAM 1 TB SSD', { ram: ['16'], almacenamiento: ['1tb'], pantalla: ['15-6'] }],
    ['LAPTOP ASUS ROG STRIX G18 18" 2.5K 240HZ INTEL CORE ULTRA 9 275HX 64GB RAM 2TB SSD', { ram: ['64'], almacenamiento: ['2tb-o-mas'], pantalla: ['16-o-mas'] }],
    ['Laptop Lenovo AMD R5 7520 8+256, w11', { procesador: ['amd'], ram: ['8'], almacenamiento: ['256gb'] }],
    ['PORTATIL X1504ZA-BQ1862 CORE I3 8GB 512GB 15.6PLG W11 SILVER', { procesador: ['intel'], ram: ['8'], almacenamiento: ['512gb'], pantalla: ['15-6'] }],
  ] as const)('%s', (titulo, esperado) => {
    expect(atributosDe('laptops', titulo)).toMatchObject(esperado);
  });

  it('no adivina: sin dato, la clave no está; la GPU sin nombrar es "integrada o no indicada"', () => {
    const a = atributosDe('laptops', 'Laptop Didáctica Básica');
    expect(a).toEqual({ gpu: ['integrada'] });
  });

  it('"16GB" solo, sin otra cifra que lo aclare, no se asigna ni a RAM ni a almacenamiento', () => {
    expect(atributosDe('laptops', 'Laptop HP 16GB Negra')).not.toHaveProperty('ram');
    expect(atributosDe('laptops', 'Laptop HP 16GB Negra')).not.toHaveProperty('almacenamiento');
  });
});

describe('atributosDe: televisores', () => {
  it.each([
    ['Televisor 55" 4K UHD Tizen UN55U8000FPCZE Samsung', { marca: ['samsung'], pulgadas: ['50-a-55'], resolucion: ['4k'], sistema: ['tizen'] }],
    ['Televisor Motorola Led 32Mkgfhd Google Tv Negro 32"', { marca: ['motorola'], pulgadas: ['hasta-32'], panel: ['led'], sistema: ['google-tv'] }],
    ['Televisor Hyundai Qled Hyled4029Qg Googletv 40"', { pulgadas: ['40-a-43'], panel: ['qled'], sistema: ['google-tv'] }],
    ['Televisor OLED EVO Smart LG OLED55C3P P8760 | 55" 4K ThinQ Color Negro', { marca: ['lg'], panel: ['oled'], resolucion: ['4k'], sistema: ['webos'] }],
    ['Televisor 75" 4K QLED Google TV 75TIKIQMINLED Indurama', { pulgadas: ['70-o-mas'], panel: ['qled'], marca: ['indurama'] }],
    ['Televisor QLED Smart Samsung QN800A P8878 | 85" 8K UHD', { resolucion: ['8k'], pulgadas: ['70-o-mas'] }],
    ['Televisor-tv 43″ QLED 1080P HYLED4326QG Smart – Google-tv Hyundai', { pulgadas: ['40-a-43'], resolucion: ['full-hd'], sistema: ['google-tv'] }],
    ['Televisor-tv 55″ QLED 4K UHD Smart TV Vidaa U9 Hisense', { sistema: ['otro'], marca: ['hisense'] }],
    ['Televisor LG QNED 50" 4K UHD | webOS 25 50QNED73ASA', { panel: ['qled'], sistema: ['webos'], pulgadas: ['50-a-55'] }],
    ['TELEVISOR HD 32" LG - MODELO 32LR650BPSA', { resolucion: ['hd'], pulgadas: ['hasta-32'] }],
    ['Televisor Hyundai Qled Hyled5813Qg Googletv 58"', { pulgadas: ['58-a-65'] }],
  ] as const)('%s', (titulo, esperado) => {
    expect(atributosDe('televisores', titulo)).toMatchObject(esperado);
  });
});

describe('atributosDe: celulares', () => {
  it.each([
    ['Celular Xiaomi Redmi 15C - 4/256GB', { marca: ['xiaomi'], ram: ['4'], almacenamiento: ['256gb'] }],
    ['Celular Zte Nubia Air 5G - 8/256GB', { marca: ['zte'], red: ['5g'], ram: ['8'], almacenamiento: ['256gb'] }],
    ['Celular Samsung A07 Negro 128GB 4G LTE Dual SIM', { marca: ['samsung'], almacenamiento: ['128gb'], red: ['4g'] }],
    ['Celular Honor Play 9C | 256 GB, 6 GB RAM, MediaTek', { marca: ['honor'], ram: ['6'], almacenamiento: ['256gb'] }],
    ['Apple iPhone 15 128GB Open Box | Chip A16 Bionic · 5G', { marca: ['apple'], almacenamiento: ['128gb'], red: ['5g'] }],
    ['Celular Xiaomi Redmi 15C de 8GB + 256GB', { ram: ['8'], almacenamiento: ['256gb'] }],
    ['Celular Poco C85 8 + 256 GB', { marca: ['xiaomi'], ram: ['8'], almacenamiento: ['256gb'] }],
    ['Celular Motorola Signature | 1 TB almacenamiento, 16 GB RAM', { marca: ['motorola'], almacenamiento: ['1tb'], ram: ['16'] }],
  ] as const)('%s', (titulo, esperado) => {
    expect(atributosDe('celulares', titulo)).toMatchObject(esperado);
  });
});

describe('atributosDe: refrigeradoras', () => {
  it.each([
    ['Refrigeradora 419L Side by Side ERS45F3Q5EB Electrolux', { tipo: ['side-by-side'], capacidad: ['301-a-450'], marca: ['electrolux'] }],
    ['Refrigerador Minibar 90 Lt RMF04CV1 Puerta Reversible Black Glass Mabe', { tipo: ['minibar'], capacidad: ['hasta-150'], marca: ['mabe'] }],
    ['Refrigeradora No Frost Top Freezer 257L Inverter, dispensador 3L', { tipo: ['dos-puertas'], capacidad: ['151-a-300'], tecnologia: ['no-frost', 'inverter'] }],
    ['Refrigeradora French Door Samsung Sm-Rf18A5104Sr/Ed 495 Litros', { tipo: ['french-door'], capacidad: ['451-a-600'] }],
    ['Refrigeradora Electrolux Side by Side Inverter Inox 430 L 15 Pies', { capacidad: ['301-a-450'], tecnologia: ['inverter'] }],
    ['Refrigeradora SMC SMC17RFFD | 17\' 492 Litros Color Silver', { capacidad: ['451-a-600'] }],
    ['Refrigeradora Side By Side Electrolux Ers65F1Q5Bi 611 Litros', { capacidad: ['mas-de-600'] }],
  ] as const)('%s', (titulo, esperado) => {
    expect(atributosDe('refrigeradoras', titulo)).toMatchObject(esperado);
  });

  it('pies cúbicos sin litros se convierten (18 pies ≈ 510 L)', () => {
    expect(atributosDe('refrigeradoras', 'Refrigeradora LG 18 pies Plateada')).toMatchObject({ capacidad: ['451-a-600'] });
  });
});

describe('atributosDe: lavadoras', () => {
  it.each([
    ['Lavadora Semiautomática Mabe Lmdx1123Hbab0 11Kg', { tipo: ['semiautomatica'], capacidad: ['hasta-12'], marca: ['mabe'] }],
    ['Lavadora Doble Tina WWTT15M7USUZX 15kg Onix White Westinghouse', { tipo: ['semiautomatica'], capacidad: ['13-a-17'] }],
    ['Lavadora Automática Whirlpool Ww20Nnahla 20KG', { tipo: ['automatica'], capacidad: ['18-a-21'], marca: ['whirlpool'] }],
    ['Lavadora LG Carga Superior 20 Kg Inverter WT20EWTX6T', { carga: ['superior'], capacidad: ['18-a-21'] }],
    ['Whirlpool Lavadora Carga Frontal 7MWFW6605MW Blanco con 37 Ciclos', { carga: ['frontal'] }],
    ['Lavadora Automática Indurama LRI-17DGR 37 Libras', { tipo: ['automatica'], capacidad: ['13-a-17'] }],
    ['Lavadora Secadora 2 en 1 LG Wd13Mvc4S6 13Kg', { tipo: ['lavasecadora'], capacidad: ['13-a-17'] }],
    ['Mabe Torre Lavadora / Secadora Eléctrica MCL2440EPDG0 Grafito 53lb', { tipo: ['lavasecadora'], capacidad: ['22-o-mas'] }],
    ['Lavadora Automática Whirlpool 7MWTW8127LC P8768 | 28 Kg 61 Libras', { capacidad: ['22-o-mas'] }],
  ] as const)('%s', (titulo, esperado) => {
    expect(atributosDe('lavadoras', titulo)).toMatchObject(esperado);
  });
});

describe('atributosDe: cobertura con el conjunto dorado', () => {
  const DORADO: { titulo: string; categoria: SlugCategoria | null }[] =
    JSON.parse(readFileSync(new URL('./fixtures/categorias-dorado.json', import.meta.url), 'utf8'));
  it('informa qué parte de cada categoría trae cada atributo', () => {
    const lineas: string[] = [];
    for (const c of ['laptops', 'televisores', 'celulares', 'refrigeradoras', 'lavadoras'] as const) {
      const de = DORADO.filter(d => d.categoria === c).map(d => atributosDe(c, d.titulo));
      const claves = [...new Set(de.flatMap(a => Object.keys(a)))].sort();
      lineas.push(`${c} (${de.length}): ` + claves.map(k => `${k} ${Math.round(100 * de.filter(a => k in a).length / de.length)} %`).join(', '));
    }
    console.log(lineas.join('\n'));
    expect(lineas).toHaveLength(5);
  });
});
