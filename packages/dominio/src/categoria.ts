// Categoría de un producto a partir de su título (y, si la hay, de la categoría que publica la tienda).
//
// Regla: la palabra que dice qué es el producto ("Laptop", "Televisor", "Celular", "Refrigeradora", "Lavadora") tiene que
// estar entre las tres primeras del título, y antes de ella solo puede haber marcas o calificativos ("Dell Laptop",
// "Smart TV", "Teléfono Celular", "Mabe - Refrigeradora"), nunca otro sustantivo: "Mochila P-Laptop", "Soporte para TV",
// "Forro … iPhone" o "Memoria RAM … laptop" no son de la categoría. Una búsqueda por palabras (tsquery) no sirve para
// esto: el analizador reduce "celular" a "celul", la raíz de celulosa, y no distingue la mochila de la laptop.
// Medido con 846 títulos reales etiquetados a mano (test/fixtures/categorias-dorado.json).

export type SlugCategoria = 'laptops' | 'televisores' | 'celulares' | 'refrigeradoras' | 'lavadoras';
export const SLUGS_CATEGORIA: SlugCategoria[] = ['laptops', 'televisores', 'celulares', 'refrigeradoras', 'lavadoras'];

/** Minúsculas, sin tildes, separadores como espacios; "p/", "p-" y "porta" (de "porta laptop") pasan a "para". */
export function normalizarTitulo(titulo: string): string {
  return titulo
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\bp\s?[/-]\s?/g, ' para ')
    .replace(/\bporta\s/g, ' para ')
    .replace(/[|,;:()[\]{}"“”″'´`¨!¡?¿*+–—_/\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Palabra principal → categoría. Es un Map: un objeto común heredaría "constructor" o "toString" como si fueran palabras. */
const NUCLEOS = new Map<string, SlugCategoria>(Object.entries({
  laptop: 'laptops', laptops: 'laptops', notebook: 'laptops', macbook: 'laptops', chromebook: 'laptops', ultrabook: 'laptops',
  televisor: 'televisores', televisores: 'televisores', television: 'televisores', tv: 'televisores', smarttv: 'televisores',
  celular: 'celulares', celulares: 'celulares', smartphone: 'celulares', iphone: 'celulares',
  refrigerador: 'refrigeradoras', refrigeradora: 'refrigeradoras', refrigeradoras: 'refrigeradoras', refrigeradores: 'refrigeradoras',
  minibar: 'refrigeradoras', frigobar: 'refrigeradoras', nevera: 'refrigeradoras',
  lavadora: 'lavadoras', lavadoras: 'lavadoras', lavasecadora: 'lavadoras',
} satisfies Record<string, SlugCategoria>));

/** Sustantivos que, si van antes de la palabra principal, dicen que el producto es otra cosa. */
const OTRA_COSA = new Set([
  'mochila', 'mochilas', 'maletin', 'maletines', 'estuche', 'estuches', 'funda', 'fundas', 'carcasa', 'carcasas', 'forro',
  'forros', 'case', 'soporte', 'soportes', 'base', 'bases', 'rack', 'racks', 'mueble', 'muebles', 'mesa', 'control',
  'controlador', 'protector', 'protectores', 'cable', 'cables', 'cargador', 'adaptador', 'memoria', 'disco', 'ssd',
  'display', 'pantalla', 'teclado', 'mouse', 'parlante', 'audifono', 'audifonos', 'caja', 'cuchilla', 'manguera', 'panio',
  'pano', 'toallita', 'toallitas', 'juego', 'set', 'repuesto', 'repuestos', 'bateria', 'antena', 'kit', 'lamina', 'mica',
  'vidrio', 'tapa', 'filtro', 'bandeja', 'organizador', 'portarrollo', 'enchufe', 'interruptor', 'foco', 'gamepad',
  'lampara', 'sticker', 'cubierta', 'cobertor', 'bolso', 'bolsa', 'cooler', 'ventilador', 'secadora', 'para', 'con',
  'box', 'stick', 'esquinero', 'esquineros', 'centro', 'pedestal', 'brazo', 'limpiador', 'desodorante', 'playset',
]);

/** Señales de que no es el aparato sino un juguete, un accesorio o un aparato distinto con el mismo nombre. */
const EXCLUSIONES = [
  /\bdidactic[oa]\b|\bjuguete\b|\binfantil\b/,
  /\btv box\b|\bfire tv\b|\bstick\b/,
  /\bnevera portatil\b|\bnevera (de )?playa\b/,
  /\blavadora de (platos|vajilla)|\blavavajilla/,
  /^telefono (inalambrico|fijo)/,
];

/** Series de laptops que identifican una "computadora" o "computador" como portátil. */
const SERIES_LAPTOP = /\b(vivobook|zenbook|ideapad|thinkpad|thinkbook|probook|elitebook|pavilion|victus|omen|aspire|nitro|inspiron|latitude|vostro|swift|tuf|rog|loq|legion)\b|\b(m1502|x1504|e1504|e1404)\w*/;

/** La categoría de la tienda ("Tecnología/Celulares", "Computación > Laptops"), si dice una de las cinco. */
function deCategoriaTienda(c: string | null | undefined): SlugCategoria | null {
  if (!c) return null;
  const n = normalizarTitulo(c);
  if (/\b(celular|celulares|smartphones?|telefonia movil)\b/.test(n)) return 'celulares';
  if (/\b(laptops?|notebooks?|portatiles)\b/.test(n)) return 'laptops';
  if (/\b(televisores?|televisión|television|tv|smart tv)\b/.test(n)) return 'televisores';
  if (/\b(refrigerador(a|as|es)?|refrigeracion)\b/.test(n)) return 'refrigeradoras';
  if (/\b(lavadoras?|lavado)\b/.test(n)) return 'lavadoras';
  return null;
}

export function categoriaDe({ titulo, categoriaTienda }: { titulo: string; categoriaTienda?: string | null }): SlugCategoria | null {
  const n = normalizarTitulo(titulo);
  if (EXCLUSIONES.some(r => r.test(n))) return null;
  const palabras = n.split(' ');

  // Torre de lavado y secado ("Torre Lav/Sec Eléctrica", "Torre de Lavado y Secado a Gas", "Torre de lavado 2 en 1").
  if (/^torre (de )?lav(ado|adora)?\b/.test(n)) return 'lavadoras';
  // "Portátil …" y "Computador(a) portátil / Computador Asus Vivobook…" al principio del título.
  if (palabras[0] === 'portatil' || palabras[0] === 'portatiles') return 'laptops';
  if (/^computador(a)?\b/.test(n) && !/\b(escritorio|all in one|aio|desktop|torre)\b/.test(n) && (/^computador(a)? portatil\b/.test(n) || SERIES_LAPTOP.test(n))) return 'laptops';

  for (let i = 0; i < Math.min(3, palabras.length); i++) {
    const w = palabras[i]!;
    if (OTRA_COSA.has(w)) break; // antes de la palabra principal apareció otra cosa: no es de la categoría
    const c = NUCLEOS.get(w);
    if (c) {
      if (w === 'tv' && /^tv (box|stick)/.test(palabras.slice(i).join(' '))) return null;
      if (w === 'nevera' && /\b(portatil|coleman|cooler|playa)\b/.test(n)) return null;
      return c;
    }
  }
  // Sin palabra principal al inicio: decide la categoría de la tienda, salvo que el título empiece por otra cosa.
  if (OTRA_COSA.has(palabras[0] ?? '')) return null;
  return deCategoriaTienda(categoriaTienda);
}
