// Fuente VTEX: catálogo público del storefront, recorrido por categorías.
// VTEX no deja pasar de _from = 2500 en una búsqueda: si una categoría tiene más,
// se recorre por sus subcategorías.
import { z } from 'zod';
import type { OfertaCruda } from '@comparador/dominio';
import type { Http } from '../http.ts';
import type { Fuente, TiendaIngesta } from '../tipos.ts';

export const TAM_PAGINA = 50;
export const TOPE_VTEX = 2500;

const Categoria: z.ZodType<{ id: number; children?: Categoria[] }> = z.lazy(() =>
  z.object({ id: z.number(), children: z.array(Categoria).optional() }));
type Categoria = z.infer<typeof Categoria>;

const Producto = z.object({
  productId: z.string(),
  productName: z.string(),
  brand: z.string().nullish(),
  link: z.string(),
  items: z.array(z.object({
    itemId: z.string(),
    name: z.string().nullish(),
    ean: z.string().nullish(),
    images: z.array(z.object({ imageUrl: z.string() })).default([]),
    sellers: z.array(z.object({
      commertialOffer: z.object({
        Price: z.number(),
        ListPrice: z.number().nullish(),
        AvailableQuantity: z.number().nullish(),
        IsAvailable: z.boolean().nullish(),
      }),
    })),
  })),
});
type Producto = z.infer<typeof Producto>;

function aOfertas(p: Producto, vistos: Set<string>): OfertaCruda[] {
  const variantes = p.items.length > 1;
  const ofertas: OfertaCruda[] = [];
  for (const item of p.items) {
    if (vistos.has(item.itemId)) continue;
    vistos.add(item.itemId);
    const conStock = item.sellers.map(s => s.commertialOffer).filter(o => (o.AvailableQuantity ?? 0) > 0 && o.Price > 0);
    const oferta = [...conStock].sort((a, b) => a.Price - b.Price)[0] ?? item.sellers[0]?.commertialOffer;
    const nombreItem = item.name?.trim() ?? '';
    ofertas.push({
      sku_tienda: item.itemId,
      titulo: variantes && nombreItem && !p.productName.includes(nombreItem) ? `${p.productName} ${nombreItem}` : p.productName,
      url: variantes ? `${p.link}?skuId=${item.itemId}` : p.link,
      imagen_url: item.images[0]?.imageUrl ?? null,
      precio: oferta?.Price ?? null,
      precio_lista: oferta?.ListPrice ?? null,
      moneda: 'USD',
      disponible: conStock.length > 0,
      ean: item.ean?.trim() || null,
      marca: p.brand ?? null,
    });
  }
  return ofertas;
}

export function fuenteVtex(tienda: TiendaIngesta, http: Http): Fuente {
  const base = `${tienda.origen}/api/catalog_system/pub`;

  async function buscar(ruta: string, desde: number) {
    const url = `${base}/products/search?fq=C:${ruta}&_from=${desde}&_to=${desde + TAM_PAGINA - 1}`;
    const { datos, cabeceras } = await http.json<unknown>(url);
    const productos = z.array(Producto).safeParse(datos);
    if (!productos.success) throw new Error(`Forma inesperada en VTEX (${tienda.id}): ${productos.error.issues[0]?.message}`);
    const total = Number(/\/(\d+)$/.exec(cabeceras.get('resources') ?? '')?.[1] ?? productos.data.length);
    return { productos: productos.data, total };
  }

  return {
    async *leer() {
      const arbol = z.array(Categoria).parse((await http.json(`${base}/category/tree/3`)).datos);
      const vistos = new Set<string>();

      async function* recorrer(cat: Categoria, ruta: string): AsyncGenerator<OfertaCruda[]> {
        const primera = await buscar(ruta, 0);
        if (primera.total > TOPE_VTEX && cat.children?.length) {
          for (const hija of cat.children) yield* recorrer(hija, `${ruta}${hija.id}/`);
          return;
        }
        const pagina = primera.productos.flatMap(p => aOfertas(p, vistos));
        if (pagina.length) yield pagina;
        for (let desde = TAM_PAGINA; desde < Math.min(primera.total, TOPE_VTEX); desde += TAM_PAGINA) {
          const { productos } = await buscar(ruta, desde);
          const siguiente = productos.flatMap(p => aOfertas(p, vistos));
          if (siguiente.length) yield siguiente;
        }
      }

      for (const raiz of arbol) yield* recorrer(raiz, `/${raiz.id}/`);
    },
  };
}
