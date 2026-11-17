// Categorías de la web y sus filtros propios. Los valores son los slugs que guarda la base en producto.atributos
// (paquete dominio: atributosDe); aquí solo van los nombres que ve el usuario y la forma de la URL.
// URL legible y estable: ?procesador=amd,intel&ram=16,32&precio_min=200&precio_max=800 (valores ordenados).

export type Filtros = Record<string, string[]>;
export type Atributo = { clave: string; nombre: string; valores: string[]; etiqueta: (v: string) => string; abierto?: boolean };
export type Categoria = { slug: string; nombre: string; singular: string; atributos: Atributo[] };

const NO_INDICADO = 'no-indicado';
const conEtiquetas = (clave: string, nombre: string, pares: [string, string][]): Atributo => {
  const mapa = new Map(pares);
  return { clave, nombre, valores: pares.map(p => p[0]), etiqueta: v => (v === NO_INDICADO ? 'No indicado' : mapa.get(v) ?? v) };
};
/** Marcas: cualquier slug que traiga la base; la etiqueta es el slug con mayúsculas ("lg" → LG, "white-westinghouse"). */
const MARCA_ESPECIAL: Record<string, string> = { lg: 'LG', hp: 'HP', tcl: 'TCL', zte: 'ZTE', msi: 'MSI', rca: 'RCA', jvc: 'JVC', smc: 'SMC', env: 'ENV' };
const marca: Atributo = {
  clave: 'marca', nombre: 'Marca', valores: [], abierto: true,
  etiqueta: v => (v === NO_INDICADO ? 'No indicada' : MARCA_ESPECIAL[v] ?? v.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')),
};
const gb = (v: string) => `${v} GB`;

export const CATEGORIAS: Categoria[] = [
  { slug: 'televisores', nombre: 'Televisores', singular: 'televisor', atributos: [
    conEtiquetas('pulgadas', 'Pulgadas', [['hasta-32', 'Hasta 32"'], ['40-a-43', '40" a 43"'], ['50-a-55', '50" a 55"'], ['58-a-65', '58" a 65"'], ['70-o-mas', '70" o más']]),
    conEtiquetas('resolucion', 'Resolución', [['hd', 'HD'], ['full-hd', 'Full HD'], ['4k', '4K'], ['8k', '8K']]),
    conEtiquetas('panel', 'Tipo de pantalla', [['led', 'LED'], ['qled', 'QLED o Mini LED'], ['oled', 'OLED']]),
    conEtiquetas('sistema', 'Sistema', [['google-tv', 'Google TV'], ['android-tv', 'Android TV'], ['webos', 'webOS'], ['tizen', 'Tizen'], ['otro', 'Otro']]),
    marca,
  ] },
  { slug: 'refrigeradoras', nombre: 'Refrigeradoras', singular: 'refrigeradora', atributos: [
    conEtiquetas('tipo', 'Tipo', [['una-puerta', 'Una puerta'], ['dos-puertas', 'Dos puertas'], ['side-by-side', 'Side by side'], ['french-door', 'French door'], ['minibar', 'Minibar']]),
    conEtiquetas('capacidad', 'Capacidad', [['hasta-150', 'Hasta 150 L'], ['151-a-300', '151 a 300 L'], ['301-a-450', '301 a 450 L'], ['451-a-600', '451 a 600 L'], ['mas-de-600', 'Más de 600 L']]),
    conEtiquetas('tecnologia', 'Tecnología', [['no-frost', 'No Frost'], ['inverter', 'Inverter']]),
    marca,
  ] },
  { slug: 'laptops', nombre: 'Laptops', singular: 'laptop', atributos: [
    conEtiquetas('procesador', 'Procesador', [['amd', 'AMD'], ['intel', 'Intel'], ['apple', 'Apple'], ['qualcomm', 'Qualcomm']]),
    conEtiquetas('ram', 'RAM', ['4', '8', '12', '16', '24', '32', '64'].map(v => [v, gb(v)])),
    conEtiquetas('gpu', 'Tarjeta gráfica', [['nvidia', 'NVIDIA'], ['amd', 'AMD dedicada'], ['intel-arc', 'Intel Arc'], ['integrada', 'Integrada o no indicada']]),
    conEtiquetas('almacenamiento', 'Almacenamiento', [['128gb-o-menos', '128 GB o menos'], ['256gb', '256 GB'], ['512gb', '512 GB'], ['1tb', '1 TB'], ['2tb-o-mas', '2 TB o más']]),
    conEtiquetas('pantalla', 'Pantalla', [['hasta-13-9', 'Hasta 13,9"'], ['14-a-15-5', '14" a 15,5"'], ['15-6', '15,6"'], ['16-o-mas', '16" o más']]),
    marca,
  ] },
  { slug: 'lavadoras', nombre: 'Lavadoras', singular: 'lavadora', atributos: [
    conEtiquetas('tipo', 'Tipo', [['automatica', 'Automática'], ['semiautomatica', 'Semiautomática'], ['lavasecadora', 'Lavasecadora']]),
    conEtiquetas('carga', 'Carga', [['superior', 'Superior'], ['frontal', 'Frontal']]),
    conEtiquetas('capacidad', 'Capacidad', [['hasta-12', 'Hasta 12 kg'], ['13-a-17', '13 a 17 kg'], ['18-a-21', '18 a 21 kg'], ['22-o-mas', '22 kg o más']]),
    marca,
  ] },
  { slug: 'celulares', nombre: 'Celulares', singular: 'celular', atributos: [
    marca,
    conEtiquetas('almacenamiento', 'Almacenamiento', [['64gb-o-menos', '64 GB o menos'], ['128gb', '128 GB'], ['256gb', '256 GB'], ['512gb', '512 GB'], ['1tb', '1 TB']]),
    conEtiquetas('ram', 'RAM', ['2', '3', '4', '6', '8', '12', '16'].map(v => [v, gb(v)])),
    conEtiquetas('red', 'Red', [['4g', '4G'], ['5g', '5G']]),
  ] },
];

export const categoria = (slug: string): Categoria | null => CATEGORIAS.find(c => c.slug === slug) ?? null;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Filtros de la categoría que vienen en la URL: solo sus claves, valores conocidos (o una marca con forma de slug). */
export function leerFiltros(cat: Categoria, sp: Record<string, string | string[] | undefined>): Filtros {
  const f: Filtros = {};
  for (const a of cat.atributos) {
    const crudo = sp[a.clave];
    const lista = (Array.isArray(crudo) ? crudo : crudo ? [crudo] : []).flatMap(v => v.split(','));
    const validos = [...new Set(lista.map(v => v.trim().slice(0, 40)).filter(v =>
      v === NO_INDICADO || (a.clave === 'marca' ? SLUG.test(v) : a.valores.includes(v))))].sort().slice(0, 10);
    if (validos.length) f[a.clave] = validos;
  }
  return f;
}

/** Un precio de la URL: número positivo, hasta dos decimales; cualquier otra cosa, ninguno. */
export function leerPrecio(v: string | undefined | null): number | null {
  if (!v || !/^\d{1,6}(\.\d{1,2})?$/.test(v.trim())) return null;
  const n = Number(v);
  return n > 0 ? n : null;
}

export type EstadoCatalogo = {
  q?: string; orden?: string; filtros?: Filtros; precioMin?: number | null; precioMax?: number | null;
  stock?: boolean; varias?: boolean; tienda?: string; pagina?: number;
};

/** URL de /buscar o de una categoría con su estado, siempre en el mismo orden (una sola entrada de caché por estado). */
export function rutaCatalogo(base: string, e: EstadoCatalogo): string {
  const partes: string[] = [];
  const poner = (k: string, v: string) => partes.push(`${k}=${encodeURIComponent(v).replace(/%2C/g, ',')}`);
  if (e.q) poner('q', e.q);
  for (const k of Object.keys(e.filtros ?? {}).sort()) {
    const valores = [...new Set(e.filtros![k])].sort();
    if (valores.length) poner(k, valores.join(','));
  }
  if (e.precioMin) poner('precio_min', String(e.precioMin));
  if (e.precioMax) poner('precio_max', String(e.precioMax));
  if (e.orden && e.orden !== 'relevancia') poner('orden', e.orden);
  if (e.stock) poner('stock', '1');
  if (e.varias) poner('varias', '1');
  if (e.tienda) poner('tienda', e.tienda);
  if (e.pagina && e.pagina > 1) poner('pagina', String(e.pagina));
  return partes.length ? `${base}?${partes.join('&')}` : base;
}
