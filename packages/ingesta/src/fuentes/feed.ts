// Fuente feed: archivo que la tienda publica para nosotros por acuerdo (como con idealo).
// Formato: CSV con cabecera o JSON (array de objetos), con estos campos:
//   sku, titulo, url, precio, precio_lista, disponible, ean, imagen, marca
// Obligatorias: sku, titulo, url y precio. Las claves no distinguen mayúsculas.
import { z } from 'zod';
import type { OfertaCruda } from '@comparador/dominio';
import type { Http } from '../http.ts';
import type { Fuente, TiendaIngesta } from '../tipos.ts';

const LOTE = 500;

/** CSV según RFC 4180: comillas dobles, "" como comilla escapada y saltos de línea dentro de comillas. */
export function leerCsv(texto: string): Record<string, string>[] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]!;
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') entreComillas = false;
      else campo += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo); campo = '';
      if (fila.some(v => v !== '')) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  fila.push(campo);
  if (fila.some(v => v !== '')) filas.push(fila);
  const [cabecera, ...datos] = filas;
  if (!cabecera) return [];
  const claves = cabecera.map(c => c.trim().toLowerCase());
  return datos.map(f => Object.fromEntries(claves.map((k, j) => [k, f[j] ?? ''])));
}

const texto = (v: unknown) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());

/**
 * Número con separadores de cualquier convención: 1299.90, 1,299.90, 1.299,90, $ 1 299.90, 1299,9.
 * Con los dos separadores, el último es el decimal. Con uno solo, es de miles si separa grupos exactos de tres
 * cifras, y decimal en otro caso. Lo que no se entiende da NaN, que validar() manda a cuarentena.
 */
export function numero(v: unknown): number | null {
  if (typeof v === 'number') return v;
  const t = texto(v);
  if (t === null) return null;
  const s = t.replace(/[^\d.,-]/g, '');   // símbolo de moneda y espacios de miles
  const ultimaComa = s.lastIndexOf(',');
  const ultimoPunto = s.lastIndexOf('.');
  if (ultimaComa >= 0 && ultimoPunto >= 0) {
    const decimal = ultimaComa > ultimoPunto ? ',' : '.';
    const miles = decimal === ',' ? '.' : ',';
    return Number(s.split(miles).join('').replace(decimal, '.'));
  }
  const sep = ultimaComa >= 0 ? ',' : ultimoPunto >= 0 ? '.' : null;
  if (sep === null) return s ? Number(s) : Number.NaN;
  if (new RegExp(`^-?\\d{1,3}(\\${sep}\\d{3})+$`).test(s)) return Number(s.split(sep).join(''));
  return s.split(sep).length === 2 ? Number(s.replace(sep, '.')) : Number.NaN;
}

const SI = new Set(['si', 'true', '1', 'yes', 'disponible', 'en stock', 'in stock', 'instock']);
const NO = new Set(['no', 'false', '0', 'agotado', 'sin stock', 'out of stock', 'outofstock']);

/** Disponibilidad: vacía, ausente o desconocida queda en null, que validar() trata como disponible. */
export function booleano(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  const t = texto(v)?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
  if (t === undefined) return null;
  return SI.has(t) ? true : NO.has(t) ? false : null;
}

const OBLIGATORIAS = ['sku', 'titulo', 'url', 'precio'];
const FeedJson = z.array(z.record(z.string(), z.unknown()));

function leerJson(cuerpo: string, tiendaId: string): Record<string, unknown>[] {
  let datos: unknown;
  try { datos = JSON.parse(cuerpo); } catch { throw new Error(`El feed JSON de ${tiendaId} no es JSON válido`); }
  const filas = FeedJson.safeParse(datos);
  if (!filas.success) throw new Error(`El feed JSON de ${tiendaId} debe ser una lista de objetos: ${filas.error.issues[0]?.message}`);
  // Claves en minúsculas, igual que la cabecera del CSV.
  return filas.data.map(f => Object.fromEntries(Object.entries(f).map(([k, v]) => [k.trim().toLowerCase(), v])));
}

function aOferta(f: Record<string, unknown>): OfertaCruda {
  return {
    sku_tienda: texto(f.sku),
    titulo: texto(f.titulo),
    url: texto(f.url),
    precio: numero(f.precio),
    precio_lista: numero(f.precio_lista),
    moneda: texto(f.moneda) ?? 'USD',
    disponible: booleano(f.disponible),
    ean: texto(f.ean),
    imagen_url: texto(f.imagen ?? f.imagen_url),
    marca: texto(f.marca),
  };
}

export function fuenteFeed(tienda: TiendaIngesta, http: Http): Fuente {
  return {
    async *leer() {
      if (!tienda.url_feed) throw new Error(`La tienda ${tienda.id} no tiene url_feed`);
      const { texto: cuerpo, status } = await http.texto(tienda.url_feed);
      if (status !== 200) throw new Error(`HTTP ${status} al leer el feed de ${tienda.id}`);
      const esJson = /^\s*[[{]/.test(cuerpo);
      const filas: Record<string, unknown>[] = esJson ? leerJson(cuerpo, tienda.id) : leerCsv(cuerpo);
      const columnas = new Set(filas.flatMap(f => Object.keys(f)));
      const faltan = OBLIGATORIAS.filter(c => !columnas.has(c));
      if (filas.length && faltan.length) throw new Error(`Al feed de ${tienda.id} le faltan columnas obligatorias: ${faltan.join(', ')}`);
      for (let i = 0; i < filas.length; i += LOTE) yield filas.slice(i, i + LOTE).map(aOferta);
    },
  };
}
