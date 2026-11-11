import { describe, expect, it } from 'vitest';
import { claveDeProducto } from '../src/index.ts';

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

  it('sin EAN ni código de modelo, no hay clave', () => {
    expect(claveDeProducto({ titulo: 'Laptop 16GB 512GB 120HZ i5 4K' })).toEqual({ ean: null, modelo: null });
  });
});
