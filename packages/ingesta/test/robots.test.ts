import { describe, expect, it } from 'vitest';
import { permitido } from '../src/robots.ts';

const BUSQUEDA_VTEX = '/api/catalog_system/pub/products/search?fq=C:/12/&_from=0&_to=49';

// Extractos reales de los robots.txt consultados el 6/11/2026.
const CRECOS = `User-agent: *
Disallow: /*OrderBy
Disallow: /account/*
User-agent: *
Disallow: /*?`;
const KYWI = `User-agent: *
Disallow: /img/*
Disallow: /busca/*
Disallow: /checkout/*`;
const COMANDATO = `User-agent: *`;

describe('permitido', () => {
  it('Disallow: /*? prohíbe la búsqueda del catálogo (Créditos Económicos, Marcimex…)', () => {
    expect(permitido(CRECOS, BUSQUEDA_VTEX)).toBe(false);
  });

  it('sin reglas que la cubran, la búsqueda está permitida (Kywi, Comandato)', () => {
    expect(permitido(KYWI, BUSQUEDA_VTEX)).toBe(true);
    expect(permitido(COMANDATO, BUSQUEDA_VTEX)).toBe(true);
    expect(permitido(KYWI, '/busca/tv')).toBe(false);
  });

  it('gana la regla más larga, un grupo propio reemplaza al de *, y $ ancla el final', () => {
    const robots = `User-agent: *
Disallow: /
User-agent: DecideAqui
Disallow: /api/
Allow: /api/catalog_system/pub/
Disallow: /*.json$`;
    expect(permitido(robots, BUSQUEDA_VTEX)).toBe(true);           // Allow más largo que Disallow /api/
    expect(permitido(robots, '/api/checkout/pub/orderForm')).toBe(false);
    expect(permitido(robots, '/tv-samsung/p')).toBe(true);          // el Disallow: / de * no aplica
    expect(permitido(robots, '/feed.json')).toBe(false);
    expect(permitido(robots, '/feed.json?v=2')).toBe(true);
    expect(permitido(robots, '/tv-samsung/p', 'OtroBot')).toBe(false);
  });

  it('un grupo aplica solo si su user-agent es igual al nombre del robot (RFC 9309 §2.2.1)', () => {
    // "a" y "deci" están dentro de "decideaqui", pero no son su nombre: manda el grupo de *.
    for (const otro of ['a', 'deci', 'aqui']) {
      const robots = `User-agent: ${otro}\nDisallow: /\n\nUser-agent: *\nDisallow: /checkout/`;
      expect(permitido(robots, BUSQUEDA_VTEX), `grupo "${otro}"`).toBe(true);
    }
    // Y al revés: un grupo de otro robot no puede abrirnos lo que el grupo de * cierra.
    expect(permitido(`User-agent: d\nAllow: /\n\nUser-agent: *\nDisallow: /`, BUSQUEDA_VTEX)).toBe(false);
  });

  it('el nombre del robot no distingue mayúsculas', () => {
    const robots = `User-agent: *\nAllow: /\n\nUser-agent: DECIDEAQUI\nDisallow: /api/`;
    expect(permitido(robots, BUSQUEDA_VTEX)).toBe(false);
    expect(permitido(robots, '/tv-samsung/p')).toBe(true);
  });
});
