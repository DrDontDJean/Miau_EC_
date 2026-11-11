// Fuente WooCommerce: Store API pública (/wp-json/wc/store/v1/products).
// Los precios vienen como texto en la unidad menor de la moneda (centavos).
import { z } from 'zod';
import type { OfertaCruda } from '@comparador/dominio';
import type { Http } from '../http.ts';
import type { Fuente, TiendaIngesta } from '../tipos.ts';

const POR_PAGINA = 100;

const Producto = z.object({
  id: z.number(),
  name: z.string(),
  sku: z.string().nullish(),
  permalink: z.string(),
  is_in_stock: z.boolean().nullish(),
  prices: z.object({
    price: z.string(),
    regular_price: z.string().nullish(),
    currency_code: z.string().nullish(),
    currency_minor_unit: z.number().default(2),
  }),
  images: z.array(z.object({ src: z.string() })).default([]),
  brands: z.array(z.object({ name: z.string() })).nullish(),
});

const ENTIDADES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
export const decodificarHtml = (s: string) => s
  .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n: string) => ENTIDADES[n.toLowerCase()] ?? m);

function aOferta(p: z.infer<typeof Producto>): OfertaCruda {
  const div = 10 ** p.prices.currency_minor_unit;
  const precio = Number(p.prices.price) / div;
  const regular = p.prices.regular_price ? Number(p.prices.regular_price) / div : null;
  return {
    sku_tienda: p.sku?.trim() || String(p.id),
    titulo: decodificarHtml(p.name),
    url: p.permalink,
    imagen_url: p.images[0]?.src ?? null,
    precio,
    precio_lista: regular,
    moneda: p.prices.currency_code ?? 'USD',
    disponible: p.is_in_stock !== false,
    ean: null,
    marca: p.brands?.[0]?.name ? decodificarHtml(p.brands[0].name) : null,
  };
}

export function fuenteWoocommerce(tienda: TiendaIngesta, http: Http): Fuente {
  return {
    async *leer() {
      let totalPaginas = 1;
      for (let pagina = 1; pagina <= totalPaginas; pagina++) {
        const { datos, cabeceras } = await http.json<unknown>(
          `${tienda.origen}/wp-json/wc/store/v1/products?page=${pagina}&per_page=${POR_PAGINA}`);
        const productos = z.array(Producto).safeParse(datos);
        if (!productos.success) throw new Error(`Forma inesperada en WooCommerce (${tienda.id}): ${productos.error.issues[0]?.message}`);
        totalPaginas = Number(cabeceras.get('x-wp-totalpages') ?? totalPaginas);
        if (productos.data.length) yield productos.data.map(aOferta);
      }
    },
  };
}
