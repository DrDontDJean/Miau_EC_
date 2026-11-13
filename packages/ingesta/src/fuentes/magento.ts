// Fuente Magento: GraphQL público (/graphql), 100 productos por página según total_count.
// La consulta va por GET, con la consulta en la URL: robots.txt se evalúa sobre la URL que se pide,
// y nunca se pasa a POST para esquivar un Disallow.
import { z } from 'zod';
import type { OfertaCruda } from '@comparador/dominio';
import type { Http } from '../http.ts';
import type { Fuente, TiendaIngesta } from '../tipos.ts';

const POR_PAGINA = 100;

const consulta = (pagina: number) =>
  `{products(search:"",pageSize:${POR_PAGINA},currentPage:${pagina},sort:{name:ASC}){total_count ` +
  `items{sku name url_key url_suffix stock_status image{url} ` +
  `price_range{minimum_price{final_price{value currency} regular_price{value}}}}}}`;

const Item = z.object({
  sku: z.string(),
  name: z.string(),
  url_key: z.string().nullish(),
  url_suffix: z.string().nullish(),
  stock_status: z.string().nullish(),
  image: z.object({ url: z.string().nullish() }).nullish(),
  price_range: z.object({
    minimum_price: z.object({
      final_price: z.object({ value: z.number().nullish(), currency: z.string().nullish() }),
      regular_price: z.object({ value: z.number().nullish() }).nullish(),
    }),
  }),
});
type Item = z.infer<typeof Item>;

// GraphQL responde 200 aunque la consulta falle: los errores vienen en `errors`.
const Respuesta = z.object({
  errors: z.array(z.object({ message: z.string() })).optional(),
  data: z.object({ products: z.object({ total_count: z.number().int(), items: z.array(Item) }) }).nullish(),
});

/** Magento calcula el precio con decimales de más (27.370001). */
const aDolares = (v: number | null | undefined) => (typeof v === 'number' ? Math.round(v * 100) / 100 : null);

export function aOferta(i: Item, origen: string): OfertaCruda {
  const final = i.price_range.minimum_price.final_price;
  return {
    sku_tienda: i.sku,
    titulo: i.name,
    url: i.url_key ? `${origen}/${i.url_key}${i.url_suffix ?? ''}` : null,
    imagen_url: i.image?.url ?? null,
    precio: aDolares(final.value),
    precio_lista: aDolares(i.price_range.minimum_price.regular_price?.value),
    moneda: final.currency ?? null,
    disponible: i.stock_status === 'IN_STOCK' ? true : i.stock_status === 'OUT_OF_STOCK' ? false : null,
    ean: null,
    marca: null,
  };
}

export function fuenteMagento(tienda: TiendaIngesta, http: Http): Fuente {
  let motivo: string | null = null;

  return {
    incompleta: () => motivo,
    async *leer() {
      motivo = null;
      let totalInicial: number | null = null;
      let paginas = 1;
      for (let pagina = 1; pagina <= paginas; pagina++) {
        const { datos } = await http.json<unknown>(`${tienda.origen}/graphql?query=${encodeURIComponent(consulta(pagina))}`);
        const r = Respuesta.safeParse(datos);
        if (!r.success) throw new Error(`Forma inesperada en Magento (${tienda.id}): ${r.error.issues[0]?.message}`);
        if (r.data.errors?.length) throw new Error(`Magento (${tienda.id}) rechazó la consulta: ${r.data.errors[0]!.message.slice(0, 200)}`);
        if (!r.data.data) throw new Error(`Magento (${tienda.id}) respondió sin datos de productos`);
        const { total_count: total, items } = r.data.data.products;
        if (totalInicial === null) { totalInicial = total; paginas = Math.ceil(total / POR_PAGINA); }
        if (total !== totalInicial) motivo = `El total de ${tienda.id} cambió durante la lectura (de ${totalInicial} a ${total})`;
        if (items.length < Math.min(POR_PAGINA, totalInicial - (pagina - 1) * POR_PAGINA)) {
          motivo ??= `La página ${pagina} de ${tienda.id} llegó incompleta (${items.length} productos)`;
        }
        if (items.length) yield items.map(i => aOferta(i, tienda.origen));
      }
    },
  };
}
