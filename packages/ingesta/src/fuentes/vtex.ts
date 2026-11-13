// Fuente VTEX: catálogo público del storefront, recorrido por categorías.
//
// VTEX no deja pasar de _from = 2500 en una búsqueda. Si una categoría tiene más:
//   - con subcategorías, se recorre por ellas;
//   - sin subcategorías, se lee ordenada por nombre ascendente (hasta 2500) y descendente (hasta otros
//     2500), lo que cubre hasta 5000 productos. Si la tienda prohíbe en su robots.txt el parámetro de
//     orden, o la categoría tiene más de 5000, la fuente lo anota y la corrida cierra 'parcial'.
// Un tramo que da error de servidor (500 o 503) se pide en bloques de 10 y de 1; un bloque que sigue
// fallando se omite y también deja la corrida en 'parcial': nunca se omite en silencio.
// Al final se compara lo leído con el total que declara la tienda y, si faltan productos (los que no están
// en el árbol de categorías), se complementa con lecturas generales ordenadas por nombre.
import { z } from 'zod';
import type { OfertaCruda } from '@comparador/dominio';
import type { Http } from '../http.ts';
import { permitido } from '../robots.ts';
import type { ContextoFuente, Fuente, TiendaIngesta } from '../tipos.ts';

export const TAM_PAGINA = 50;
export const TOPE_VTEX = 2500;
const RUTA_API = '/api/catalog_system/pub';
const ASC = 'OrderByNameASC';
const DESC = 'OrderByNameDESC';

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
    // Con stock: el vendedor más barato con stock. Sin stock: el más barato con precio, porque VTEX suele
    // mandar Price 0 para un SKU agotado. Si ninguno tiene precio, la oferta va sin precio y validar() la
    // trata como agotada (conserva su último precio publicado).
    const comerciales = item.sellers.map(s => s.commertialOffer);
    const conStock = comerciales.filter(o => (o.AvailableQuantity ?? 0) > 0 && o.Price > 0);
    const masBarata = (lista: typeof comerciales) => [...lista].sort((a, b) => a.Price - b.Price)[0];
    const oferta = masBarata(conStock) ?? masBarata(comerciales.filter(o => o.Price > 0));
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

const esErrorDeServidor = (e: unknown) => e instanceof Error && /^HTTP 5\d\d /.test(e.message);

export function fuenteVtex(tienda: TiendaIngesta, http: Http, contexto: ContextoFuente = {}): Fuente {
  const truncadas: string[] = [];   // categorías con más productos de los que se pueden alcanzar
  const omitidos: string[] = [];    // tramos que siguieron fallando con error de servidor
  let faltantes: string | null = null;
  const idsProducto = new Set<string>();
  let robots: Promise<string> | null = null;

  const rutaBusqueda = (fq: string | null, desde: number, hasta: number, orden?: string) =>
    `${RUTA_API}/products/search?${fq ? `fq=${fq}&` : ''}_from=${desde}&_to=${hasta}${orden ? `&O=${orden}` : ''}`;

  /** ¿Permite el robots.txt de la tienda pedir esta búsqueda con parámetro de orden? */
  async function ordenPermitido(fq: string | null, orden: string): Promise<boolean> {
    if (!contexto.leerRobots) return true;
    robots ??= contexto.leerRobots();
    return permitido(await robots, rutaBusqueda(fq, 0, TAM_PAGINA - 1, orden));
  }

  async function pedir(fq: string | null, desde: number, hasta: number, orden?: string) {
    const { datos, cabeceras } = await http.json<unknown>(tienda.origen + rutaBusqueda(fq, desde, hasta, orden));
    const productos = z.array(Producto).safeParse(datos);
    if (!productos.success) throw new Error(`Forma inesperada en VTEX (${tienda.id}): ${productos.error.issues[0]?.message}`);
    const total = Number(/\/(\d+)$/.exec(cabeceras.get('resources') ?? '')?.[1] ?? productos.data.length);
    return { productos: productos.data, total };
  }

  /** Un tramo de la búsqueda; ante un error de servidor lo pide en bloques menores. total es null si nada respondió. */
  async function tramo(fq: string | null, desde: number, hasta: number, orden?: string):
    Promise<{ productos: Producto[]; total: number | null }> {
    try {
      return await pedir(fq, desde, hasta, orden);
    } catch (e) {
      if (!esErrorDeServidor(e)) throw e;
      if (hasta <= desde) {
        omitidos.push(`${fq ?? 'general'} desde ${desde}${orden ? ` (${orden})` : ''}`);
        return { productos: [], total: null };
      }
      const ancho = hasta - desde + 1 > 10 ? 10 : 1;
      const productos: Producto[] = [];
      let total: number | null = null;
      for (let d = desde; d <= hasta; d += ancho) {
        const r = await tramo(fq, d, Math.min(d + ancho - 1, hasta), orden);
        productos.push(...r.productos);
        total = r.total ?? total;
        if (total !== null && d + ancho >= total) break; // no pedir más allá del final
      }
      return { productos, total };
    }
  }

  return {
    incompleta() {
      const motivos: string[] = [];
      if (truncadas.length) motivos.push(`VTEX solo deja leer ${TOPE_VTEX} productos por búsqueda; categorías truncadas: ${truncadas.join(', ')}`);
      if (omitidos.length) motivos.push(`${omitidos.length} tramo(s) con error del servidor se omitieron: ${omitidos.slice(0, 3).join(', ')}`);
      if (faltantes) motivos.push(faltantes);
      return motivos.length ? motivos.join('; ') : null;
    },
    async *leer() {
      truncadas.length = 0; omitidos.length = 0; faltantes = null; idsProducto.clear();
      // Árbol de 10 niveles: con menos, más categorías grandes quedan sin hijas conocidas.
      const arbol = z.array(Categoria).parse((await http.json(`${tienda.origen}${RUTA_API}/category/tree/10`)).datos);
      const vistos = new Set<string>();   // SKUs ya entregados

      const procesar = (productos: Producto[]) => productos.flatMap(p => { idsProducto.add(p.productId); return aOfertas(p, vistos); });

      /** Lee `cuantos` productos de una búsqueda, de 50 en 50, con el orden dado. */
      async function* paginas(fq: string | null, orden: string | undefined, cuantos: number): AsyncGenerator<OfertaCruda[]> {
        for (let desde = 0; desde < cuantos; desde += TAM_PAGINA) {
          const { productos } = await tramo(fq, desde, desde + TAM_PAGINA - 1, orden);
          const pagina = procesar(productos);
          if (pagina.length) yield pagina;
        }
      }

      async function* leerTruncada(fq: string, total: number): AsyncGenerator<OfertaCruda[]> {
        if (!(await ordenPermitido(fq, ASC))) {
          truncadas.push(`${fq} (${total} productos; el robots.txt de la tienda prohíbe el orden por nombre)`);
          yield* paginas(fq, undefined, TOPE_VTEX);
          return;
        }
        yield* paginas(fq, ASC, TOPE_VTEX);
        yield* paginas(fq, DESC, Math.min(total - TOPE_VTEX, TOPE_VTEX));
        if (total > 2 * TOPE_VTEX) truncadas.push(`${fq} (${total} productos; solo se alcanzan ${2 * TOPE_VTEX})`);
      }

      async function* recorrer(cat: Categoria, ruta: string): AsyncGenerator<OfertaCruda[]> {
        const fq = `C:${ruta}`;
        const primera = await tramo(fq, 0, TAM_PAGINA - 1);
        if (primera.total === null) throw new Error(`No se pudo leer la categoría ${fq} de ${tienda.id}`);
        if (primera.total > TOPE_VTEX && cat.children?.length) {
          for (const hija of cat.children) yield* recorrer(hija, `${ruta}${hija.id}/`);
          return;
        }
        if (primera.total > TOPE_VTEX) { yield* leerTruncada(fq, primera.total); return; }
        const pagina = procesar(primera.productos);
        if (pagina.length) yield pagina;
        for (let desde = TAM_PAGINA; desde < primera.total; desde += TAM_PAGINA) {
          const { productos } = await tramo(fq, desde, desde + TAM_PAGINA - 1);
          const siguiente = procesar(productos);
          if (siguiente.length) yield siguiente;
        }
      }

      for (const raiz of arbol) yield* recorrer(raiz, `/${raiz.id}/`);

      // ¿Se leyó todo lo que la tienda declara? Los productos fuera del árbol de categorías no aparecen arriba.
      const global = await tramo(null, 0, 0);
      const primeros = procesar(global.productos);
      if (primeros.length) yield primeros;
      const declarado = global.total;
      if (declarado !== null && idsProducto.size < declarado) {
        for (const orden of [ASC, DESC]) {
          if (idsProducto.size >= declarado) break;
          if (!(await ordenPermitido(null, orden))) continue;
          for (let desde = 0; desde < Math.min(declarado, TOPE_VTEX) && idsProducto.size < declarado; desde += TAM_PAGINA) {
            const { productos } = await tramo(null, desde, desde + TAM_PAGINA - 1, orden);
            const pagina = procesar(productos);
            if (pagina.length) yield pagina;
          }
        }
        if (idsProducto.size < declarado) faltantes = `se leyeron ${idsProducto.size} de los ${declarado} productos que declara la tienda`;
      }
      // Si se leyó todo lo que la tienda declara, lo que falló o no alcanzó por categoría se recuperó por otra vía.
      if (declarado !== null && idsProducto.size >= declarado) { omitidos.length = 0; truncadas.length = 0; }
    },
  };
}
