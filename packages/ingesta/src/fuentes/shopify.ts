// Fuente Shopify: listado público /products.json, 250 productos por página hasta una página vacía.
// El listado no declara total ni moneda. La moneda se lee de /meta.json (no de /cart.js: los robots.txt
// de estas tiendas prohíben /cart.js). Una oferta por variante: el precio, el stock y el SKU son de la variante.
import { z } from 'zod';
import type { OfertaCruda } from '@comparador/dominio';
import type { Http } from '../http.ts';
import { permitido } from '../robots.ts';
import type { ContextoFuente, Fuente, TiendaIngesta } from '../tipos.ts';

const POR_PAGINA = 250;
const MAX_PAGINAS = 1000;

const Variante = z.object({
  id: z.number(),
  title: z.string().nullish(),
  available: z.boolean().nullish(),
  price: z.string(),
  compare_at_price: z.string().nullish(),
  featured_image: z.object({ src: z.string() }).nullish(),
});

const Producto = z.object({
  id: z.number(),
  title: z.string(),
  handle: z.string(),
  vendor: z.string().nullish(),
  variants: z.array(Variante),
  images: z.array(z.object({ src: z.string() })).default([]),
});
type Producto = z.infer<typeof Producto>;

const Pagina = z.object({ products: z.array(Producto) });
const Meta = z.object({ currency: z.string() });

export function aOfertas(p: Producto, origen: string, moneda: string): OfertaCruda[] {
  const varias = p.variants.length > 1;
  return p.variants.map(v => {
    const nombreVariante = v.title?.trim() ?? '';
    return {
      sku_tienda: String(v.id),   // v.sku puede venir vacío o repetido; el id de la variante es estable
      titulo: nombreVariante && nombreVariante !== 'Default Title' ? `${p.title} ${nombreVariante}` : p.title,
      url: `${origen}/products/${p.handle}${varias ? `?variant=${v.id}` : ''}`,
      imagen_url: v.featured_image?.src ?? p.images[0]?.src ?? null,
      precio: Number(v.price),
      precio_lista: v.compare_at_price ? Number(v.compare_at_price) : null,
      moneda,
      disponible: v.available ?? null,
      ean: null,   // products.json no expone el código de barras
      marca: p.vendor?.trim() || null,
    };
  });
}

export function fuenteShopify(tienda: TiendaIngesta, http: Http, contexto: ContextoFuente = {}): Fuente {
  let motivo: string | null = null;

  async function moneda(): Promise<string> {
    if (contexto.leerRobots && !permitido(await contexto.leerRobots(), '/meta.json')) {
      throw new Error(`El robots.txt de ${tienda.id} prohíbe /meta.json, con el que se comprueba la moneda`);
    }
    const { datos } = await http.json<unknown>(`${tienda.origen}/meta.json`);
    const meta = Meta.safeParse(datos);
    if (!meta.success) throw new Error(`Forma inesperada en Shopify (${tienda.id}): /meta.json sin moneda`);
    return meta.data.currency.toUpperCase();
  }

  return {
    incompleta: () => motivo,
    async *leer() {
      motivo = null;
      const monedaTienda = await moneda();   // si no es USD, validar() manda las ofertas a cuarentena
      let primerIdAnterior: number | null = null;
      for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
        const { datos } = await http.json<unknown>(`${tienda.origen}/products.json?limit=${POR_PAGINA}&page=${pagina}`);
        const r = Pagina.safeParse(datos);
        if (!r.success) throw new Error(`Forma inesperada en Shopify (${tienda.id}): ${r.error.issues[0]?.message}`);
        const productos = r.data.products;
        if (!productos.length) return;
        // Shopify puede limitar el parámetro page y repetir la última página disponible.
        if (productos[0]!.id === primerIdAnterior) {
          motivo = `Shopify repitió la página ${pagina - 1}: el recorrido se cortó antes del final del catálogo`;
          return;
        }
        primerIdAnterior = productos[0]!.id;
        yield productos.flatMap(p => aOfertas(p, tienda.origen, monedaTienda));
      }
      motivo = `Se alcanzó el límite de ${MAX_PAGINAS} páginas sin llegar al final del catálogo`;
    },
  };
}
