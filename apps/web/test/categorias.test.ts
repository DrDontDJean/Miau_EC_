import { describe, expect, it } from 'vitest';
import { CATEGORIAS, categoria, leerFiltros, leerPrecio, rutaCatalogo } from '../src/lib/categorias';

describe('taxonomía de la web', () => {
  it('las cinco categorías, con sus filtros propios', () => {
    expect(CATEGORIAS.map(c => c.slug)).toEqual(['televisores', 'refrigeradoras', 'laptops', 'lavadoras', 'celulares']);
    expect(categoria('laptops')!.atributos.map(a => a.clave)).toEqual(['procesador', 'ram', 'gpu', 'almacenamiento', 'pantalla', 'marca']);
    expect(categoria('no-existe')).toBeNull();
  });

  it('la GPU sin nombrar se muestra como "Integrada o no indicada", nunca como "Integrada"', () => {
    const gpu = categoria('laptops')!.atributos.find(a => a.clave === 'gpu')!;
    expect(gpu.etiqueta('integrada')).toBe('Integrada o no indicada');
  });
});

describe('leerFiltros', () => {
  const laptops = categoria('laptops')!;

  it('lee los parámetros de la categoría, en orden estable y sin repetidos', () => {
    expect(leerFiltros(laptops, { procesador: 'intel,amd,intel', ram: '32,16', q: 'hp', orden: 'precio_asc' }))
      .toEqual({ procesador: ['amd', 'intel'], ram: ['16', '32'] });
  });

  it('descarta valores desconocidos, claves de otra categoría y texto con caracteres raros', () => {
    expect(leerFiltros(laptops, { procesador: 'intel,<script>,zzz', pulgadas: '50-a-55', ram: '' })).toEqual({ procesador: ['intel'] });
  });

  it('acepta "no-indicado" y cualquier marca con forma de slug', () => {
    expect(leerFiltros(laptops, { ram: 'no-indicado', marca: 'lenovo,marca-nueva' })).toEqual({ ram: ['no-indicado'], marca: ['lenovo', 'marca-nueva'] });
  });

  it('acepta un parámetro repetido (?ram=8&ram=16) como lista', () => {
    expect(leerFiltros(laptops, { ram: ['16', '8'] })).toEqual({ ram: ['16', '8'] });
  });
});

describe('leerPrecio', () => {
  it('números positivos con hasta dos decimales; lo demás se ignora', () => {
    expect(leerPrecio('300')).toBe(300);
    expect(leerPrecio('99.5')).toBe(99.5);
    expect(leerPrecio('-4')).toBeNull();
    expect(leerPrecio('abc')).toBeNull();
    expect(leerPrecio('')).toBeNull();
  });
});

describe('rutaCatalogo', () => {
  it('parámetros legibles y estables: ?procesador=amd,intel&ram=16,32&precio_max=800', () => {
    expect(rutaCatalogo('/categoria/laptops', { filtros: { ram: ['32', '16'], procesador: ['intel', 'amd'] }, precioMax: 800 }))
      .toBe('/categoria/laptops?procesador=amd,intel&ram=16,32&precio_max=800');
  });

  it('el orden de los parámetros no depende de cómo llegan', () => {
    const a = rutaCatalogo('/buscar', { q: 'hp', filtros: { ram: ['16'], procesador: ['intel'] }, stock: true, pagina: 2 });
    const b = rutaCatalogo('/buscar', { pagina: 2, stock: true, filtros: { procesador: ['intel'], ram: ['16'] }, q: 'hp' });
    expect(a).toBe(b);
    expect(a).toBe('/buscar?q=hp&procesador=intel&ram=16&stock=1&pagina=2');
  });

  it('sin nada más que la base, la ruta queda limpia', () => {
    expect(rutaCatalogo('/categoria/celulares', {})).toBe('/categoria/celulares');
    expect(rutaCatalogo('/categoria/celulares', { orden: 'relevancia', pagina: 1, filtros: { ram: [] } })).toBe('/categoria/celulares');
  });
});
