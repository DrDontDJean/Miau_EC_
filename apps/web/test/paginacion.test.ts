import { describe, expect, it } from 'vitest';
import { numerosVisibles } from '../src/components/paginacion';
import { leerPagina, MAX_PAGINA } from '../src/lib/catalogo';

describe('numerosVisibles', () => {
  it('con pocas páginas las muestra todas', () => {
    expect(numerosVisibles(1, 1)).toEqual([1]);
    expect(numerosVisibles(2, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(numerosVisibles(5, 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('con muchas páginas deja la primera, la última y las vecinas de la actual, con puntos suspensivos donde salta', () => {
    expect(numerosVisibles(9, 20)).toEqual([1, '…', 7, 8, 9, 10, 11, '…', 20]);
    expect(numerosVisibles(1, 20)).toEqual([1, 2, 3, '…', 20]);
    expect(numerosVisibles(2, 20)).toEqual([1, 2, 3, 4, '…', 20]);
    expect(numerosVisibles(20, 20)).toEqual([1, '…', 18, 19, 20]);
    expect(numerosVisibles(19, 20)).toEqual([1, '…', 17, 18, 19, 20]);
  });

  it('no pone puntos suspensivos entre números consecutivos', () => {
    for (const total of [10, 17, 40, 416]) {
      for (let actual = 1; actual <= total; actual++) {
        const v = numerosVisibles(actual, total);
        expect(v[0]).toBe(1);
        expect(v.at(-1)).toBe(total);
        expect(v).toContain(actual);
        v.forEach((n, i) => {
          if (n !== '…') return;
          expect(typeof v[i - 1] === 'number' && typeof v[i + 1] === 'number' && (v[i + 1] as number) - (v[i - 1] as number) > 2).toBe(true);
        });
      }
    }
  });
});

describe('leerPagina', () => {
  it('acepta enteros desde 1 hasta el máximo y devuelve 1 para todo lo demás', () => {
    expect(leerPagina('1')).toBe(1);
    expect(leerPagina('7')).toBe(7);
    expect(leerPagina(String(MAX_PAGINA))).toBe(MAX_PAGINA);
    expect(leerPagina(String(MAX_PAGINA + 50))).toBe(MAX_PAGINA);
    for (const malo of ['0', '-1', '1.5', 'x', '', null, undefined]) expect(leerPagina(malo as string | null | undefined)).toBe(1);
  });
});
