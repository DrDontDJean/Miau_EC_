import type { OfertaCruda, Tienda } from '@comparador/dominio';

export type TiendaIngesta = Tienda & {
  plataforma: 'vtex' | 'woocommerce' | 'feed';
  peticiones_por_segundo: number;
  url_feed: string | null;
};

/** Seam 1 de la ingesta: de dónde salen las ofertas. Una página por iteración. */
export interface Fuente {
  leer(): AsyncIterable<OfertaCruda[]>;
}
