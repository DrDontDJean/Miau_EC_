// Fuente sitemap: para tiendas cuya API de catálogo no se puede leer (su robots.txt la prohíbe, responde 403
// o no existe). Se lee lo que la tienda publica para los buscadores y comparadores: el sitemap.xml con las
// páginas de producto y, en cada página, los datos estructurados del producto (JSON-LD de schema.org o
// metadatos Open Graph). No se lee HTML sin datos estructurados, no se guarda la página, no se siguen
// enlaces y cada URL de producto se comprueba contra el robots.txt de la tienda.
//
// Una página por producto a 1 petición por segundo: cada corrida lee como mucho `paginas_por_corrida`
// páginas, en este orden: URLs nunca vistas, URLs con <lastmod> posterior a la última visita y las
// visitadas hace más tiempo. El precio de una oferta puede tener, por tanto, algunos días.
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import type { OfertaCruda } from '@comparador/dominio';
import type { Http } from '../http.ts';
import { permitido } from '../robots.ts';
import type { ContextoFuente, Fuente, TiendaIngesta } from '../tipos.ts';

const LOTE = 50;
// De cada página solo se lee el principio, hasta que aparece el JSON-LD del producto o se llega a este tope.
// Las fichas VTEX pesan más de 3 MB, pero su JSON-LD está en los primeros 80 KB; las de Artefacta lo traen
// al final de unos 385 KB, con los metadatos Open Graph antes, en la cabecera.
const MAX_BYTES_PAGINA = 600_000;
const MAX_SITEMAPS = 300;
const PROFUNDIDAD = 4;
const ERRORES_SEGUIDOS = 10;        // un 403 o un 429 repetido es una negativa: se detiene la lectura
const MAX_SIN_DATOS = 0.2;

// ── Sitemap ────────────────────────────────────────────────────────────────────────────────────────────

export type EntradaSitemap = { loc: string; lastmod: string | null };

const ENTIDADES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
export const decodificar = (s: string) => s
  .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n: string) => ENTIDADES[n.toLowerCase()] ?? m);

const etiqueta = (bloque: string, nombre: string) => {
  const m = new RegExp(`<${nombre}>\\s*(?:<!\\[CDATA\\[)?\\s*([\\s\\S]*?)\\s*(?:\\]\\]>)?\\s*</${nombre}>`, 'i').exec(bloque);
  return m ? decodificar(m[1]!.trim()) : null;
};

/** Un sitemap (urlset) o un índice de sitemaps (sitemapindex), con sus <loc> y <lastmod>. */
export function analizarSitemap(xml: string): { indice: boolean; entradas: EntradaSitemap[] } {
  const indice = /<sitemapindex[\s>]/i.test(xml);
  const bloque = indice ? 'sitemap' : 'url';
  const entradas: EntradaSitemap[] = [];
  for (const m of xml.matchAll(new RegExp(`<${bloque}>([\\s\\S]*?)</${bloque}>`, 'gi'))) {
    const loc = etiqueta(m[1]!, 'loc');
    if (loc) entradas.push({ loc, lastmod: etiqueta(m[1]!, 'lastmod') });
  }
  return { indice, entradas };
}

const NO_PRODUCTOS = /(image|imagen|categor|brand|marca|blog|cms|pagina|custom|route)/i;

/** De los sitemaps de un índice, los que pueden tener productos: los que lo dicen en su nombre o, si ninguno, todos menos los que no. */
export function elegirHijos(locs: string[]): string[] {
  const nombre = (u: string) => { try { return new URL(u).pathname; } catch { return u; } };
  const conProductos = locs.filter(u => /product/i.test(nombre(u)));
  return conProductos.length ? conProductos : locs.filter(u => !NO_PRODUCTOS.test(nombre(u)));
}

/** Qué páginas leer hoy: nunca vistas, luego las modificadas desde la última visita y luego las más viejas. */
export function elegirPaginas(entradas: Map<string, string | null>, visitas: Map<string, string>, presupuesto: number): string[] {
  const hora = (iso: string | null | undefined) => { const t = iso ? Date.parse(iso) : NaN; return Number.isNaN(t) ? null : t; };
  const nuevas: string[] = [];
  const modificadas: { url: string; lastmod: number }[] = [];
  const antiguas: { url: string; visita: number }[] = [];
  for (const [url, lastmod] of entradas) {
    const visita = hora(visitas.get(url));
    if (visita === null) { nuevas.push(url); continue; }
    const modificacion = hora(lastmod);
    if (modificacion !== null && modificacion > visita) modificadas.push({ url, lastmod: modificacion });
    else antiguas.push({ url, visita });
  }
  modificadas.sort((a, b) => b.lastmod - a.lastmod);
  antiguas.sort((a, b) => a.visita - b.visita);
  return [...nuevas, ...modificadas.map(m => m.url), ...antiguas.map(a => a.url)].slice(0, presupuesto);
}

// ── Datos estructurados de una página de producto ──────────────────────────────────────────────────────

export type ProductoPagina = {
  nombre: string | null; precio: number; moneda: string | null; disponible: boolean | null;
  sku: string | null; ean: string | null; imagen: string | null; marca: string | null;
};

type Nodo = Record<string, unknown>;
const esObjeto = (v: unknown): v is Nodo => typeof v === 'object' && v !== null && !Array.isArray(v);
const texto = (v: unknown): string | null => {
  if (typeof v === 'number') return String(v);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};
const numero = (v: unknown): number | null => {
  if (typeof v === 'number') return v;
  const t = texto(v);
  if (!t) return null;
  const n = Number(t.replace(',', '.'));
  return Number.isNaN(n) ? null : n;
};

function nodosDe(v: unknown, salida: Nodo[] = []): Nodo[] {
  if (Array.isArray(v)) v.forEach(x => nodosDe(x, salida));
  else if (esObjeto(v)) { salida.push(v); if (v['@graph']) nodosDe(v['@graph'], salida); }
  return salida;
}
const esTipo = (n: Nodo, tipo: string) => n['@type'] === tipo || (Array.isArray(n['@type']) && n['@type'].includes(tipo));

function ofertasDe(v: unknown): Nodo[] {
  const salida: Nodo[] = [];
  for (const o of Array.isArray(v) ? v : [v]) {
    if (!esObjeto(o)) continue;
    if (o['offers']) salida.push(...ofertasDe(o['offers']));
    salida.push(o);
  }
  return salida;
}

/** schema.org/ItemAvailability: la última parte de la URL (InStock, OutOfStock…). */
function disponibilidad(v: unknown): boolean | null {
  const t = texto(v)?.split(/[/#]/).pop()?.toLowerCase().replace(/[\s_-]/g, '');
  if (!t) return null;
  if (/^(outofstock|soldout|discontinued|oos|nodisponible)$/.test(t)) return false;
  if (/^(instock|instoreonly|onlineonly|limitedavailability|preorder|presale|backorder|availablefororder|disponible|available)$/.test(t)) return true;
  return null;
}

const primero = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);
const imagenDe = (v: unknown): string | null => {
  const p = primero(v);
  return esObjeto(p) ? texto(p['url']) : texto(p);
};

function desdeJsonLd(html: string): Partial<ProductoPagina> | null {
  for (const m of html.matchAll(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let datos: unknown;
    try { datos = JSON.parse(m[1]!); } catch { continue; }
    const producto = nodosDe(datos).find(n => esTipo(n, 'Product'));
    if (!producto) continue;
    const ofertas = ofertasDe(producto['offers'])
      .map(o => ({ precio: numero(o['price'] ?? o['lowPrice']), moneda: texto(o['priceCurrency']), disp: disponibilidad(o['availability']) }))
      .filter((o): o is { precio: number; moneda: string | null; disp: boolean | null } => o.precio !== null);
    // La más barata con stock; si ninguna tiene, la más barata.
    const porPrecio = (a: { precio: number }, b: { precio: number }) => a.precio - b.precio;
    const elegida = ofertas.filter(o => o.disp === true).sort(porPrecio)[0] ?? [...ofertas].sort(porPrecio)[0];
    const marca = producto['brand'];
    return {
      nombre: texto(producto['name']),
      precio: elegida?.precio,
      moneda: elegida?.moneda ?? null,
      disponible: ofertas.some(o => o.disp === true) ? true : ofertas.some(o => o.disp === false) ? false : null,
      sku: texto(producto['sku']) ?? texto(producto['productID']) ?? texto(producto['mpn']),
      ean: texto(producto['gtin13']) ?? texto(producto['gtin']) ?? texto(producto['gtin12']) ?? texto(producto['gtin14']) ?? texto(producto['gtin8']),
      imagen: imagenDe(producto['image']),
      marca: esObjeto(marca) ? texto(marca['name']) : texto(marca),
    };
  }
  return null;
}

function desdeOpenGraph(html: string): Partial<ProductoPagina> {
  const metas = [...html.matchAll(/<meta\s+([^>]*?)\/?>/gi)].map(m => {
    const atributos: Record<string, string> = {};
    for (const a of m[1]!.matchAll(/([a-zA-Z:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) atributos[a[1]!.toLowerCase()] = a[2] ?? a[3] ?? '';
    return atributos;
  });
  const meta = (...claves: string[]) => {
    for (const c of claves) {
      const a = metas.find(x => (x['property'] ?? x['name'])?.toLowerCase() === c);
      if (a?.['content']) return decodificar(a['content'].trim());
    }
    return null;
  };
  return {
    nombre: meta('og:title'),
    precio: numero(meta('product:price:amount', 'og:price:amount')) ?? undefined,
    moneda: meta('product:price:currency', 'og:price:currency')?.toUpperCase() ?? null,
    disponible: disponibilidad(meta('product:availability', 'og:availability')),
    imagen: meta('og:image'),
  };
}

/** ¿Ya llegó completo el JSON-LD de un producto? Con eso se deja de descargar la página. */
export function tieneProducto(leido: string): boolean {
  const m = /"@type"\s*:\s*(?:\[\s*)?"Product"/.exec(leido);
  return m !== null && leido.indexOf('</script>', m.index) >= 0;
}

/** SKU de la oferta: el de la tienda o, sin él, la ruta; si pasa de 100 caracteres (límite de la base), un resumen estable. */
export function skuDe(sku: string | null, ruta: string): string | null {
  const crudo = sku ?? (decodeURIComponent(ruta).replace(/^\/+|\/+$/g, '') || null);
  if (crudo === null || crudo.length <= 100) return crudo;
  return `h-${createHash('sha1').update(crudo).digest('hex')}`;
}

/** El producto de una página, o null si no trae un precio en datos estructurados. */
export function extraerProducto(html: string): ProductoPagina | null {
  const ld = desdeJsonLd(html);
  const og = desdeOpenGraph(html);
  const precio = ld?.precio ?? og.precio;
  if (precio === undefined || precio === null) return null;
  return {
    nombre: ld?.nombre ?? og.nombre ?? null,
    precio,
    moneda: ld?.precio !== undefined ? (ld.moneda ?? og.moneda ?? null) : (og.moneda ?? null),
    disponible: ld?.disponible ?? og.disponible ?? null,
    sku: ld?.sku ?? null,
    ean: ld?.ean ?? null,
    imagen: ld?.imagen ?? og.imagen ?? null,
    marca: ld?.marca ?? null,
  };
}

// ── La fuente ──────────────────────────────────────────────────────────────────────────────────────────

export function fuenteSitemap(tienda: TiendaIngesta, http: Http, contexto: ContextoFuente = {}): Fuente {
  const presupuesto = tienda.paginas_por_corrida ?? 2500;
  let motivo: string | null = null;
  let vigentes: string[] | null = null;
  const retiradas: string[] = [];

  return {
    incompleta: () => motivo,
    reconciliar: () => (vigentes ? { vigentes, retiradas: [...retiradas] } : null),
    async *leer() {
      motivo = null; vigentes = null; retiradas.length = 0;
      if (!tienda.patron_producto) throw new Error(`La tienda ${tienda.id} no tiene patron_producto`);
      const patron = new RegExp(tienda.patron_producto);
      const origen = new URL(tienda.origen).origin;
      const robots = contexto.leerRobots ? await contexto.leerRobots() : null;
      const rutaPermitida = (u: URL) => robots === null || permitido(robots, u.pathname + u.search);

      async function leerMapa(url: string): Promise<string> {
        const u = new URL(url);
        if (!rutaPermitida(u)) throw new Error(`El robots.txt de ${tienda.id} prohíbe el sitemap ${u.pathname}`);
        if (/\.gz$/i.test(u.pathname)) {
          const { datos, status } = await http.binario(url);
          if (status !== 200) throw new Error(`HTTP ${status} al leer el sitemap ${url}`);
          return gunzipSync(datos).toString('utf8');
        }
        const { texto: cuerpo, status } = await http.texto(url);
        if (status !== 200) throw new Error(`HTTP ${status} al leer el sitemap ${url}`);
        return cuerpo;
      }

      // Raíz: la configurada o las líneas "Sitemap:" del robots.txt.
      const delRobots = robots === null ? [] : [...robots.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map(m => m[1]!);
      let pendientes: { url: string; nivel: number }[] =
        (tienda.url_sitemap ? [tienda.url_sitemap] : delRobots.length ? delRobots : [`${origen}/sitemap.xml`]).map(url => ({ url, nivel: 0 }));
      const productos = new Map<string, string | null>();
      const leidos = new Set<string>();
      while (pendientes.length) {
        const { url, nivel } = pendientes.shift()!;
        if (leidos.has(url)) continue;
        if (leidos.size >= MAX_SITEMAPS) throw new Error(`El sitemap de ${tienda.id} tiene más de ${MAX_SITEMAPS} archivos`);
        leidos.add(url);
        const { indice, entradas } = analizarSitemap(await leerMapa(url));
        if (indice) {
          if (nivel + 1 >= PROFUNDIDAD) throw new Error(`El sitemap de ${tienda.id} tiene más de ${PROFUNDIDAD} niveles`);
          const hijos = new Set(elegirHijos(entradas.map(e => e.loc)));
          pendientes.push(...entradas.filter(e => hijos.has(e.loc)).map(e => ({ url: e.loc, nivel: nivel + 1 })));
          continue;
        }
        for (const e of entradas) {
          let u: URL;
          try { u = new URL(e.loc); } catch { continue; }
          if (u.origin === origen && patron.test(u.pathname) && rutaPermitida(u)) productos.set(u.toString(), e.lastmod);
        }
      }
      // Sin URLs no hay nada que reconciliar: desactivaría todo el catálogo por un sitemap vacío o mal leído.
      if (!productos.size) throw new Error(`El sitemap de ${tienda.id} no tiene URLs de producto que cumplan ${tienda.patron_producto}`);

      const elegidas = elegirPaginas(productos, contexto.ultimasVisitas ? await contexto.ultimasVisitas() : new Map(), presupuesto);
      let lote: OfertaCruda[] = [];
      let leidas = 0, sinDatos = 0, erroresSeguidos = 0;
      for (const url of elegidas) {
        const { texto: pagina, status } = await http.inicio(url, tieneProducto, MAX_BYTES_PAGINA);
        leidas++;
        if (status === 404 || status === 410) { retiradas.push(url); erroresSeguidos = 0; continue; }
        if (status !== 200) {
          // 403, 429 repetido, 5xx: no se insiste ni se evade. Una racha de errores detiene la lectura.
          if (++erroresSeguidos >= ERRORES_SEGUIDOS) throw new Error(`HTTP ${status} repetido en ${tienda.id}: se detiene la lectura`);
          sinDatos++;
          continue;
        }
        erroresSeguidos = 0;
        const p = extraerProducto(pagina);
        if (!p) { sinDatos++; continue; }
        const u = new URL(url);
        lote.push({
          sku_tienda: skuDe(p.sku, u.pathname),
          titulo: p.nombre,
          url,   // la del sitemap: es la canónica y con ella se sabe cuándo se vio por última vez
          imagen_url: p.imagen,
          precio: p.precio,
          precio_lista: null,
          moneda: p.moneda,
          disponible: p.disponible,
          ean: p.ean,
          marca: p.marca,
        });
        if (lote.length >= LOTE) { yield lote; lote = []; }
      }
      if (lote.length) yield lote;

      vigentes = [...productos.keys()];
      if (leidas >= 20 && sinDatos / leidas > MAX_SIN_DATOS) {
        motivo = `${sinDatos} de ${leidas} páginas de ${tienda.id} no trajeron datos de producto: puede haber cambiado su formato`;
      }
    },
  };
}
