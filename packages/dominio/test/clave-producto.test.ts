import { describe, expect, it } from 'vitest';
import { claveDeProducto, codigosModelo } from '../src/index.ts';

describe('claveDeProducto', () => {
  it('usa el EAN cuando su dígito de control es válido', () => {
    // EAN real del iPhone 15 128 GB azul visto en idealo.es
    expect(claveDeProducto({ titulo: 'Apple iPhone 15 128GB azul', ean: '0195949034572' }))
      .toEqual({ ean: '0195949034572', modelo: null });
  });

  it('sin EAN válido, toma el código de modelo del título (el más largo) e ignora specs', () => {
    // Títulos reales de Comandato y Marcimex
    expect(claveDeProducto({ titulo: 'Televisor 55" 4K UHD Tizen UN55U8000FPCZE Samsung', ean: '100066273' }))
      .toEqual({ ean: null, modelo: 'UN55U8000FPCZE' });
    expect(claveDeProducto({ titulo: 'Televisor Samsung Qled Qn65Q7Faapcze Uhd4Ktz 65"' }).modelo)
      .toBe('QN65Q7FAAPCZE');
  });

  it('con EAN válido conserva también el código de modelo, para unir ofertas de tiendas sin EAN', () => {
    expect(claveDeProducto({ titulo: 'Smart TV LG 65UA7500PSA 65"', ean: '8806091234568' }))
      .toEqual({ ean: '8806091234568', modelo: '65UA7500PSA' });
  });

  it('una resolución de pantalla no es un código de modelo', () => {
    // Título real de Novicompu que agrupó 5 monitores distintos en la primera corrida.
    expect(claveDeProducto({ titulo: 'Monitor ENV Gaming FHD IPS 144Hz | 24 pulgadas 1920x1080' }).modelo).toBeNull();
    expect(claveDeProducto({ titulo: 'Monitor 27" 2560X1440 VG27AQ3A Asus' }).modelo).toBe('VG27AQ3A');
  });

  it('un modelo escrito con guion o pegado es el mismo (títulos reales de Pycca, Novicompu y Marcimex)', () => {
    const modelo = (titulo: string) => claveDeProducto({ titulo }).modelo;
    expect(modelo('Lavadora Semiautomática 11Kg Indurama LRI-11BLSAP')).toBe('LRI11BLSAP');
    expect(modelo('LAVADORA SEMIAUT LRI11BLSAP')).toBe('LRI11BLSAP');
    expect(modelo('Encimera a Gas 60cm Indurama EGI-604VDNE')).toBe(modelo('ENCIMERA EGI604VDNE'));
    expect(modelo('Tostadora 2 Rebanadas 7V Indurama ITSNE-24')).toBe(modelo('Tostadora Indurama Itsne24 Cr 750W'));
    expect(modelo('Laptop HP 15-fc0287la AMD Ryzen 7 7730U')).toBe('15FC0287LA');   // el "15-" solo no sirve
    expect(modelo('Batidora de Mano HM9105E-GEB | Blanco')).toBe('HM9105EGEB');
  });

  it('no une medidas ni rangos: llantas, especificaciones y revoluciones no son modelos', () => {
    expect(codigosModelo('Llanta 185/60R14 Kumho')).not.toContain('18560R14');
    expect(codigosModelo('UPS 1000VA/500W Forza')).not.toContain('1000VA500W');
    expect(codigosModelo('Lijadora Orbital 5" 320W 8000-13000OPM Porten')).not.toContain('800013000OPM');
    expect(codigosModelo('Parlante con Wi-Fi 6 y 3-5 horas')).toEqual([]);
  });

  it('ignora la puntuación pegada al código y no repite candidatos', () => {
    expect(codigosModelo('Cocina Mabe (EM-7625FX0), gris')).toContain('EM7625FX0');
    expect(codigosModelo('LRI-11BLSAP LRI-11BLSAP').filter(c => c === 'LRI11BLSAP')).toHaveLength(1);
  });

  it('sin EAN ni código de modelo, no hay clave', () => {
    expect(claveDeProducto({ titulo: 'Laptop 16GB 512GB 120HZ i5 4K' })).toEqual({ ean: null, modelo: null });
  });
});
