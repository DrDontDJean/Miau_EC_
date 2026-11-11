// Fuente feed: archivo que la tienda publica para nosotros por acuerdo (como con idealo).
// Formato: CSV con cabecera o JSON (array de objetos), con estos campos:
//   sku, titulo, url, precio, precio_lista, disponible, ean, imagen, marca
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
const numero = (v: unknown) => { const t = texto(v); return t === null ? null : Number(t.replace(',', '.')); };
const booleano = (v: unknown) => typeof v === 'boolean' ? v : /^(si|sí|true|1|yes|en stock)$/i.test(String(v ?? '').trim());

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
      const filas = cuerpo.trimStart().startsWith('[')
        ? (JSON.parse(cuerpo) as Record<string, unknown>[])
        : leerCsv(cuerpo);
      for (let i = 0; i < filas.length; i += LOTE) yield filas.slice(i, i + LOTE).map(aOferta);
    },
  };
}
