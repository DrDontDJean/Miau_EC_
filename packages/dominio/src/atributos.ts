// Atributos de un producto leídos de su título, para los filtros propios de cada categoría.
//
// Cada atributo es una lista de valores normalizados ("ram": ["16"], "tecnologia": ["no-frost", "inverter"]), con
// slugs aptos para la URL. Lo que no se puede leer del título no se guarda: el filtro lo muestra como "No indicado".
// Nunca se adivina: "16GB" suelto puede ser RAM o almacenamiento, y entonces no se asigna a ninguno. La única excepción
// es la tarjeta gráfica de una laptop: un título casi nunca dice "integrada", así que sin NVIDIA, AMD Radeon RX o
// Intel Arc el valor es "integrada", que la web muestra como "Integrada o no indicada".
import type { SlugCategoria } from './categoria.ts';

export type Atributos = Record<string, string[]>;

/** Minúsculas, sin tildes, comillas de pulgadas unificadas en '"'; conserva / + . , para leer cifras. */
function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/(''|´´|¨|[″”“])/g, '"')
    .replace(/\s+/g, ' ');
}

const num = (s: string) => Number(s.replace(',', '.'));
const primera = (n: string, marcas: [RegExp, string][]) => {
  let mejor: { i: number; m: string } | null = null;
  for (const [r, m] of marcas) {
    const x = r.exec(n);
    if (x && (mejor === null || x.index < mejor.i)) mejor = { i: x.index, m };
  }
  return mejor?.m ?? null;
};
const marcasDe = (lista: (string | [string, string])[]): [RegExp, string][] =>
  lista.map(x => (Array.isArray(x) ? [new RegExp(`\\b(${x[0]})\\b`), x[1]] : [new RegExp(`\\b${x}\\b`), x.replace(/\s+/g, '-')]));

const MARCAS_LAPTOP = marcasDe(['hp', 'lenovo', 'asus', 'dell', 'acer', ['apple|macbook', 'apple'], 'msi', 'samsung', 'huawei', 'xiaomi', 'gigabyte', 'lg', 'toshiba', ['microsoft|surface', 'microsoft'], 'infinix', 'chuwi']);
const MARCAS_TV = marcasDe(['samsung', 'lg', 'tcl', 'hisense', 'indurama', 'riviera', 'hyundai', 'motorola', 'stargold', 'sony', 'philips', 'xiaomi', 'panasonic', 'jvc', 'innova', 'zitro', 'mastertech', 'diggio', 'env', 'xtratech', 'rca', 'aiwa', 'challenger', 'prima', 'housetv', 'kalley', 'toshiba', 'daewoo', 'haier', 'sankey']);
const MARCAS_CELULAR = marcasDe([['xiaomi|redmi|poco', 'xiaomi'], ['samsung|galaxy', 'samsung'], ['apple|iphone', 'apple'], 'honor', 'infinix', ['motorola|moto', 'motorola'], ['zte|nubia', 'zte'], 'oppo', 'realme', 'tecno', 'huawei', 'vivo', 'nokia', ['google|pixel', 'google'], 'oneplus', 'doogee', 'blu', 'itel', 'alcatel', 'umidigi']);
const MARCAS_LINEA_BLANCA = marcasDe(['mabe', 'electrolux', 'whirlpool', 'lg', 'samsung', 'indurama', 'oster', 'tcl', 'durex', 'continental', 'smc', 'rca', 'haier', 'frigidaire', 'teka', 'hisense', 'midea', 'ecoline', 'innova', ['white westinghouse|westinghouse', 'westinghouse'], 'challenger', 'daewoo']);

/** Cifras en GB o TB que no son de la tarjeta gráfica ("RTX 5060 8GB"). */
function capacidades(n: string): { gb: number; i: number; ram: boolean }[] {
  const r: { gb: number; i: number; ram: boolean }[] = [];
  for (const m of n.matchAll(/(\d{1,4}(?:[.,]\d)?) ?(gb|g|tb)\b( ?(de )?(ram|ddr\d?x?|lpddr\d?x?))?/g)) {
    if (m[2] === 'g' && !m[3]) continue;                          // "5g" (red) o "16g" sin "ram"
    const antes = n.slice(Math.max(0, m.index! - 16), m.index);
    if (/(rtx|gtx|geforce|radeon|rx|arc|vram|grafic)[^,|]*$/.test(antes)) continue;
    const gb = m[2] === 'tb' ? num(m[1]!) * 1000 : num(m[1]!);
    r.push({ gb, i: m.index!, ram: Boolean(m[3]) });
  }
  return r;
}

const RAM_VALIDA = new Set([2, 3, 4, 6, 8, 12, 16, 18, 20, 24, 32, 36, 48, 64]);

/** RAM y almacenamiento (en GB) de una laptop o un celular. */
function memoria(n: string, ramMax: number): { ram?: number; alm?: number } {
  const res: { ram?: number; alm?: number } = {};
  // "16/512GB", "8gb+512gb", "8 + 256 GB", "32GB+1TB", "4/128GB".
  const par = /\b(\d{1,2}) ?(?:gb)? ?[/+] ?(\d{1,4}) ?(gb|tb)?\b/.exec(n);
  if (par) {
    const a = num(par[1]!), b = par[3] === 'tb' ? num(par[2]!) * 1000 : num(par[2]!);
    if (RAM_VALIDA.has(a) && a <= ramMax && (b >= 32 || par[3] === 'tb')) { res.ram = a; res.alm = b < 10 ? b * 1000 : b; }
  }
  // "16GB RAM" antes que "RAM 16G": en "4GB RAM 64GB EMMC" la cifra tras "RAM" es el almacenamiento.
  const caps = capacidades(n);
  const explicita = caps.find(c => c.ram && RAM_VALIDA.has(c.gb) && c.gb <= ramMax);
  if (res.ram === undefined && explicita) res.ram = explicita.gb;
  const ramPrimero = /\bram:? ?(\d{1,2}) ?g/.exec(n);
  if (res.ram === undefined && ramPrimero && RAM_VALIDA.has(num(ramPrimero[1]!))) res.ram = num(ramPrimero[1]!);
  if (res.alm === undefined) {
    // Almacenamiento: cifras de 32 GB o más que no son la RAM.
    const grandes = [...new Set(caps.filter(c => !c.ram && c.gb >= 32 && c.gb !== res.ram).map(c => c.gb))];
    if (grandes.length === 1) res.alm = grandes[0];
    else if (grandes.length > 1) res.alm = Math.max(...grandes);
  }
  if (res.ram === undefined && res.alm !== undefined) {
    // "4GB 128GB": una cifra pequeña sola, junto a un almacenamiento ya leído, es la RAM.
    const chicas = [...new Set(caps.filter(c => !c.ram && c.gb < 32 && RAM_VALIDA.has(c.gb) && c.gb <= ramMax).map(c => c.gb))];
    if (chicas.length === 1) res.ram = chicas[0];
  }
  return res;
}

const tramoAlmacenamiento = (gb: number, minimo: number) =>
  gb <= minimo ? `${minimo}gb-o-menos` : gb <= 300 && gb > 160 ? '256gb' : gb <= 160 ? '128gb' : gb <= 700 ? '512gb' : gb <= 1500 ? '1tb' : '2tb-o-mas';

function pulgadasDe(n: string, min: number, max: number): number | null {
  for (const m of n.matchAll(/(\d{1,3}(?:[.,]\d{1,2})?) ?("|pulgadas|pulgada|pulg|plg|in\b)/g)) {
    const v = num(m[1]!);
    if (v >= min && v <= max) return v;
  }
  return null;
}

function laptops(n: string): Atributos {
  const a: Atributos = {};
  const marca = primera(n, MARCAS_LAPTOP); if (marca) a.marca = [marca];
  if (/\b(ryzen|athlon)\b|\br[3579][- ]?\d{3,4}|\br[3579]-\d{1,2}\b/.test(n)) a.procesador = ['amd'];
  else if (/\b(intel|celeron|pentium|core ?i[3579]|ci[3579]|i[3579][- ]\d{3,5}|core (ultra )?[3579]\b|core ultra|n100|n150|n200|n4500|n4020|i3-n305)/.test(n)) a.procesador = ['intel'];
  else if (/\bamd\b/.test(n)) a.procesador = ['amd'];
  else if (/\b(macbook|apple m[1-4]|m[1-4] (pro|max))\b/.test(n)) a.procesador = ['apple'];
  else if (/\b(snapdragon|qualcomm)\b/.test(n)) a.procesador = ['qualcomm'];
  a.gpu = [/\b(rtx|gtx|geforce|nvidia)\b/.test(n) ? 'nvidia' : /radeon rx|\brx ?\d{4}\b/.test(n) ? 'amd' : /\barc a\d|intel arc\b/.test(n) ? 'intel-arc' : 'integrada'];
  const { ram, alm } = memoria(n, 64);
  if (ram !== undefined && ram >= 4) a.ram = [String(ram)];
  if (alm !== undefined) a.almacenamiento = [tramoAlmacenamiento(alm, 128)];
  const p = pulgadasDe(n, 10, 18.9);
  if (p !== null) a.pantalla = [p < 14 ? 'hasta-13-9' : p < 15.6 ? '14-a-15-5' : p < 16 ? '15-6' : '16-o-mas'];
  return a;
}

function televisores(n: string): Atributos {
  const a: Atributos = {};
  const marca = primera(n, MARCAS_TV); if (marca) a.marca = [marca];
  let p = pulgadasDe(n, 19, 110);
  if (p === null) {
    const modelo = /\b(?:un|qn|oled)(\d{2})[a-z]/.exec(n) ?? /\b(\d{2})(?:ua|ur|uq|up|nu|nano|qned|lr|lq|lm)\d/.exec(n);
    if (modelo) { const v = num(modelo[1]!); if (v >= 24 && v <= 100) p = v; }
  }
  if (p !== null) a.pulgadas = [p <= 32 ? 'hasta-32' : p <= 45 ? '40-a-43' : p <= 55 ? '50-a-55' : p <= 65 ? '58-a-65' : '70-o-mas'];
  if (/\b8k\b/.test(n)) a.resolucion = ['8k'];
  else if (/\b(4k|uhd|ultra hd|3840|2160p?)\b/.test(n)) a.resolucion = ['4k'];
  else if (/\b(fhd|full ?hd|1080p?)\b/.test(n)) a.resolucion = ['full-hd'];
  else if (/\bhd\b/.test(n)) a.resolucion = ['hd'];
  if (/\b(qd-?)?oled\b/.test(n)) a.panel = ['oled'];
  else if (/\b(qled|mini ?led|miniled|qned|quantum)/.test(n)) a.panel = ['qled'];
  else if (/\b(led|lcd|nano|nanocell|crystal)\b/.test(n)) a.panel = ['led'];
  if (/google ?-?tv|googletv|\bgtv\b/.test(n)) a.sistema = ['google-tv'];
  else if (/\bandroid\b/.test(n)) a.sistema = ['android-tv'];
  else if (/\bweb ?os\b|\bthinq\b/.test(n)) a.sistema = ['webos'];
  else if (/\btizen\b/.test(n)) a.sistema = ['tizen'];
  else if (/\b(vidaa|roku|fire ?tv|linux|saphi|netcast)\b/.test(n)) a.sistema = ['otro'];
  return a;
}

function celulares(n: string): Atributos {
  const a: Atributos = {};
  const marca = primera(n, MARCAS_CELULAR); if (marca) a.marca = [marca];
  const { ram, alm } = memoria(n, 24);
  if (ram !== undefined && ram <= 24) a.ram = [String(ram)];
  if (alm !== undefined) a.almacenamiento = [alm <= 64 ? '64gb-o-menos' : alm <= 160 ? '128gb' : alm <= 300 ? '256gb' : alm <= 700 ? '512gb' : '1tb'];
  if (/\b5g\b/.test(n)) a.red = ['5g'];
  else if (/\b(4g|lte)\b/.test(n)) a.red = ['4g'];
  return a;
}

function refrigeradoras(n: string): Atributos {
  const a: Atributos = {};
  const marca = primera(n, MARCAS_LINEA_BLANCA); if (marca) a.marca = [marca];
  if (/\b(minibar|mini bar|frigobar)\b/.test(n)) a.tipo = ['minibar'];
  else if (/side ?by ?side|\bsxs\b/.test(n)) a.tipo = ['side-by-side'];
  else if (/french ?door|cross ?door|multi ?door|\b4 puertas\b/.test(n)) a.tipo = ['french-door'];
  else if (/\btop ?(mount|freezer)|\bbottom ?(mount|freezer|freeze)|\b2 puertas\b|\bdos puertas\b/.test(n)) a.tipo = ['dos-puertas'];
  else if (/\b(1|una) puerta\b|\bone door\b/.test(n)) a.tipo = ['una-puerta'];
  const litros = [...n.matchAll(/(\d{2,3}) ?(l|lt|lts|litros?)\b/g)].map(m => num(m[1]!)).filter(v => v >= 40);
  let l: number | null = litros.length ? Math.max(...litros) : null;
  if (l === null) {
    const pies = /(\d{1,2}(?:[.,]\d)?) ?(pies|')/.exec(n);
    if (pies && num(pies[1]!) >= 2 && num(pies[1]!) <= 40) l = Math.round(num(pies[1]!) * 28.3168);
  }
  if (l !== null) a.capacidad = [l <= 150 ? 'hasta-150' : l <= 300 ? '151-a-300' : l <= 450 ? '301-a-450' : l <= 600 ? '451-a-600' : 'mas-de-600'];
  const tec = [/\bno ?frost\b|\bfrost ?free\b/.test(n) && 'no-frost', /\binverter\b/.test(n) && 'inverter'].filter((x): x is string => Boolean(x));
  if (tec.length) a.tecnologia = tec;
  return a;
}

function lavadoras(n: string): Atributos {
  const a: Atributos = {};
  const marca = primera(n, MARCAS_LINEA_BLANCA); if (marca) a.marca = [marca];
  if (/lavasecadora|lavadora ?(y |\/ ?)?secadora|secadora 2 en 1|\blav ?\/? ?sec\b|^torre (de )?lav/.test(n)) a.tipo = ['lavasecadora'];
  else if (/semi ?-?automatica|doble tina|tina doble|twin tub/.test(n)) a.tipo = ['semiautomatica'];
  else if (/\b(automatica|atutomatica)\b/.test(n)) a.tipo = ['automatica'];
  if (/carga superior|top load/.test(n)) a.carga = ['superior'];
  else if (/carga frontal|front load/.test(n)) a.carga = ['frontal'];
  const kg = /(\d{1,2}(?:[.,]\d)?) ?(kg|kilos|kilogramos)\b/.exec(n);
  const lb = /(\d{2,3}) ?(lb|lbs|libras)\b/.exec(n);
  const k = kg ? num(kg[1]!) : lb ? num(lb[1]!) / 2.2046 : null;
  if (k !== null && k >= 3 && k <= 40) a.capacidad = [k < 12.5 ? 'hasta-12' : k < 17.5 ? '13-a-17' : k < 21.5 ? '18-a-21' : '22-o-mas'];
  return a;
}

const POR_CATEGORIA: Record<SlugCategoria, (n: string) => Atributos> = { laptops, televisores, celulares, refrigeradoras, lavadoras };

export function atributosDe(categoria: SlugCategoria, titulo: string): Atributos {
  return POR_CATEGORIA[categoria](normalizar(titulo));
}
