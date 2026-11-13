import type { OfertaCruda, Tienda } from '@comparador/dominio';

export type TiendaIngesta = Tienda & {
  plataforma: 'vtex' | 'woocommerce' | 'feed' | 'shopify' | 'magento' | 'frecuento' | 'sitemap';
  peticiones_por_segundo: number;
  url_feed: string | null;
  /** Host de la API si no es el de la tienda (Frecuento: app.frecuento.com). */
  origen_api?: string | null;
  /** Fuente 'sitemap': sitemap raíz o índice de productos (null: las líneas Sitemap: del robots.txt). */
  url_sitemap?: string | null;
  /** Fuente 'sitemap': expresión regular que distingue las URLs de producto. */
  patron_producto?: string | null;
  /** Fuente 'sitemap': presupuesto diario de páginas de producto. */
  paginas_por_corrida?: number;
};

/** Lo que una fuente puede necesitar de la corrida además del cliente HTTP. */
export type ContextoFuente = {
  /** robots.txt del host de lectura. Una fuente que pide URLs variables lo usa para comprobar cada una. */
  leerRobots?: () => Promise<string>;
  /** Fuente 'sitemap': URL → última vez que se vio la oferta (ISO), para decidir qué páginas leer hoy. */
  ultimasVisitas?: () => Promise<Map<string, string>>;
};

/** Seam 1 de la ingesta: de dónde salen las ofertas. Una página por iteración. */
export interface Fuente {
  leer(): AsyncIterable<OfertaCruda[]>;
  /**
   * Después de leer: por qué no se cubrió todo el catálogo, o null si se cubrió.
   * Una corrida incompleta cierra como 'parcial' y no desactiva ofertas.
   */
  incompleta?(): string | null;
}
