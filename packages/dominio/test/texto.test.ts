import { describe, expect, it } from 'vitest';
import { decodificarEntidades } from '../src/texto.ts';

describe('decodificarEntidades', () => {
  it('decodifica entidades nombradas comunes en títulos de tiendas', () => {
    expect(decodificarEntidades('Celular Oppo&nbsp;Reno 11 5G')).toBe('Celular Oppo Reno 11 5G');
    expect(decodificarEntidades('Monitor 24&quot; Full HD')).toBe('Monitor 24" Full HD');
    expect(decodificarEntidades('Ba&ntilde;o &amp; cocina')).toBe('Baño & cocina');
    expect(decodificarEntidades('Plancha a vapor &ndash; 1200W')).toBe('Plancha a vapor – 1200W');
    expect(decodificarEntidades('Cami&oacute;n &Aacute;guila')).toBe('Camión Águila');
    expect(decodificarEntidades('Samsung&reg; Galaxy&trade;')).toBe('Samsung® Galaxy™');
  });

  it('decodifica entidades numéricas decimales y hexadecimales', () => {
    expect(decodificarEntidades('TV 55&#8243; 4K')).toBe('TV 55″ 4K');
    expect(decodificarEntidades('Tom&#225;s &#x00F1;and&#xFA;')).toBe('Tomás ñandú');
    expect(decodificarEntidades('Rock&#39;n roll')).toBe("Rock'n roll");
  });

  it('no decodifica dos veces: &amp;quot; es el texto literal &quot;', () => {
    expect(decodificarEntidades('Escriba &amp;quot; aquí')).toBe('Escriba &quot; aquí');
    expect(decodificarEntidades('&#38;nbsp;')).toBe('&nbsp;');
  });

  it('deja intacto lo que no es una entidad conocida o válida', () => {
    expect(decodificarEntidades('Precio & más &noexiste; &#xZZ; &#0; R&D')).toBe('Precio & más &noexiste; &#xZZ; &#0; R&D');
    expect(decodificarEntidades('&#99999999;')).toBe('&#99999999;');
  });

  it('respeta mayúsculas en las nombradas (&Ntilde; ≠ &ntilde;)', () => {
    expect(decodificarEntidades('&Ntilde;and&ntilde;')).toBe('Ñandñ');
  });
});
