// Fuente Frecuento: API REST que usa su propia web (app.frecuento.com/products/), 500 productos por página.
// El parámetro offset se ignora: hay que paginar con page. La respuesta no trae moneda (USD, Ecuador).
// Un producto con variantes puede llegar con amount_total 0: validar() lo trata como agotado si no tiene
// stock, o lo manda a cuarentena si dice tenerlo. La lista de productos nunca trae las variantes (has_variants
// es verdadero pero variants viene vacío): se publica una oferta por producto.
//
// Descuentos (confirmado con 122 productos con descuento de la API, el 12 de noviembre de 2026): amount_total es
// el precio final y, cuando hay descuento, amount_incl_tax es el precio de antes con IVA (9,99 y 5,00 son un 50 %;
// 30,80 y 9,24, un 70 %). Sin descuento los dos son iguales. has_offer nunca se activa. El precio de lista es
// amount_incl_tax cuando es mayor que amount_total.
import { z } from 'zod';
import type { OfertaCruda } from '@comparador/dominio';
import type { Http } from '../http.ts';
import type { Fuente, TiendaIngesta } from '../tipos.ts';

const POR_PAGINA = 500;
const TOLERANCIA = 0.99;   // el catálogo cambia mientras se lee: menos del 1 % de diferencia no cuenta

const Item = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string(),
  brand: z.string().nullish(),
  has_stock: z.boolean().nullish(),
  amount_total: z.union([z.string(), z.number()]),
  amount_incl_tax: z.union([z.string(), z.number()]).nullish(),
  photos: z.array(z.unknown()).nullish(),
});
type Item = z.infer<typeof Item>;

const Pagina = z.object({
  count: z.number().int().nonnegative(),
  pages: z.number().int().nonnegative(),
  results: z.array(Item),
});

export function aOferta(i: Item): OfertaCruda {
  const foto = i.photos?.find((f): f is string => typeof f === 'string') ?? null;
  const precio = Number(i.amount_total);
  const antes = i.amount_incl_tax == null ? null : Number(i.amount_incl_tax);
  return {
    sku_tienda: String(i.id),
    titulo: i.name,
    url: i.url,
    imagen_url: foto,
    precio,
    precio_lista: antes !== null && antes > precio ? antes : null,
    moneda: 'USD',
    disponible: i.has_stock ?? null,
    ean: null,
    marca: i.brand?.trim() || null,
  };
}

export function fuenteFrecuento(tienda: TiendaIngesta, http: Http): Fuente {
  const api = tienda.origen_api ?? tienda.origen;
  let motivo: string | null = null;

  return {
    incompleta: () => motivo,
    async *leer() {
      motivo = null;
      let declarado = 0;
      let leidos = 0;
      let paginas = 1;
      for (let pagina = 1; pagina <= paginas; pagina++) {
        const { datos } = await http.json<unknown>(`${api}/products/?limit=${POR_PAGINA}&page=${pagina}`);
        const r = Pagina.safeParse(datos);
        if (!r.success) throw new Error(`Forma inesperada en la API de ${tienda.id}: ${r.error.issues[0]?.message}`);
        if (pagina === 1) { declarado = r.data.count; paginas = r.data.pages; }
        leidos += r.data.results.length;
        if (r.data.results.length) yield r.data.results.map(aOferta);
      }
      if (leidos < declarado * TOLERANCIA) motivo = `se leyeron ${leidos} de los ${declarado} productos que declara la tienda`;
    },
  };
}
