// Texto de las tiendas: las fichas y las APIs dejan entidades HTML dentro de los nombres ("Oppo&nbsp;Reno",
// "55&#8243;", "Ba&ntilde;o"). Se decodifican en una sola pasada, así "&amp;quot;" queda como el texto literal
// "&quot;" y no se decodifica dos veces.

/** Entidades nombradas que aparecen en catálogos en español. Las desconocidas se dejan tal cual. */
const NOMBRADAS: Record<string, string> = {
  amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü', agrave: 'à', egrave: 'è', ccedil: 'ç', Ccedil: 'Ç',
  iexcl: '¡', iquest: '¿', ordm: 'º', ordf: 'ª', deg: '°', middot: '·', bull: '•', hellip: '…',
  ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', sbquo: '‚', ldquo: '“', rdquo: '”', bdquo: '„', laquo: '«', raquo: '»',
  prime: '′', Prime: '″', times: '×', divide: '÷', plusmn: '±', frac12: '½', frac14: '¼', frac34: '¾',
  sup1: '¹', sup2: '²', sup3: '³', micro: 'µ', reg: '®', copy: '©', trade: '™', euro: '€', cent: '¢', pound: '£',
  shy: '', zwnj: '', zwj: '', ensp: ' ', emsp: ' ', thinsp: ' ',
};

const desdeCodigo = (codigo: number, original: string) =>
  Number.isInteger(codigo) && codigo > 0 && codigo <= 0x10ffff && !(codigo >= 0xd800 && codigo <= 0xdfff)
    ? String.fromCodePoint(codigo) : original;

/** Decodifica entidades HTML nombradas (&nbsp;, &ntilde;…) y numéricas (&#8243;, &#xF1;). &nbsp; pasa a espacio. */
export function decodificarEntidades(texto: string): string {
  return texto.replace(/&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|([a-z][a-z0-9]{1,8}));/gi, (original, dec?: string, hex?: string, nombre?: string) => {
    if (dec) return desdeCodigo(Number(dec), original);
    if (hex) return desdeCodigo(parseInt(hex, 16), original);
    return NOMBRADAS[nombre!] ?? original;
  });
}
