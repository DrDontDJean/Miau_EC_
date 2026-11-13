import { crearHttp, type Http, type OpcionesHttp } from './http.ts';
import { fuenteVtex } from './fuentes/vtex.ts';
import { fuenteWoocommerce } from './fuentes/woocommerce.ts';
import { fuenteFeed } from './fuentes/feed.ts';
import type { Fuente, TiendaIngesta } from './tipos.ts';

export { permitido } from './robots.ts';
export { ejecutarCorrida, origenDeRobots, rutaDeLectura, type DependenciasCorrida } from './corrida.ts';
export { almacenPostgres, type Almacen, type Ejecutar, type ResumenCorrida } from './almacen/postgres.ts';
export { crearHttp, AGENTE } from './http.ts';
export type { Fuente, TiendaIngesta } from './tipos.ts';

/** La fuente adecuada para la plataforma de la tienda, con su propio ritmo de peticiones. */
export function fuentePara(tienda: TiendaIngesta, opciones: OpcionesHttp = {}): Fuente {
  return fuenteCon(tienda, crearHttp({ peticionesPorSegundo: tienda.peticiones_por_segundo, ...opciones }));
}

/** Igual que fuentePara, pero reutilizando un cliente HTTP (y su ritmo) ya creado. */
export function fuenteCon(tienda: TiendaIngesta, http: Http): Fuente {
  switch (tienda.plataforma) {
    case 'vtex': return fuenteVtex(tienda, http);
    case 'woocommerce': return fuenteWoocommerce(tienda, http);
    case 'feed': return fuenteFeed(tienda, http);
    default: throw new Error(`Plataforma sin fuente: ${tienda.plataforma}`);
  }
}
