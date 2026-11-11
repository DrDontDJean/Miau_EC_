// Emparejamiento (GLOSSARY): EAN válido primero, luego código de modelo.

export function eanValido(codigo: string | null | undefined): boolean {
  const s = String(codigo ?? '').trim();
  if (!/^\d{12,14}$/.test(s)) return false;
  const digitos = s.split('').map(Number);
  const control = digitos.pop();
  const suma = digitos.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (suma % 10)) % 10 === control;
}

// Fragmentos con letras y números que son especificaciones, no referencias del fabricante.
const NO_MODELO = [
  /^\d+(GB|TB|MB|HZ|MAH|W|MP|CM|MM|KG|LB|LBS|BTU|V|PULG|PULGADAS|L|ML|G|X)$/,
  /^(4K|8K|5G|4G|3G|2K|HD|FHD|UHD|USB|HDMI|WIFI\d?|BT\d)$/,
  /^(I[3579]|RYZEN\d?|GEN\d+|DDR\d|LPDDR\d+X?|M[1-4]|A1\d)$/,
  /^\d{3,4}X\d{3,4}$/, // resoluciones: 1920X1080, 2560X1440
];

/** Códigos de modelo candidatos: 6 a 20 caracteres con letras y números (GLOSSARY: Código de modelo). */
export function codigosModelo(titulo: string): string[] {
  return titulo
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^A-Z0-9]+/)
    .filter(t => t.length >= 6 && t.length <= 20 && /[A-Z]/.test(t) && /\d/.test(t))
    .filter(t => !NO_MODELO.some(re => re.test(t)));
}

export type ClaveProducto = { ean: string | null; modelo: string | null };

export function claveDeProducto(o: { titulo: string; ean?: string | null }): ClaveProducto {
  const ean = eanValido(o.ean) ? String(o.ean).trim() : null;
  const modelo = codigosModelo(o.titulo).sort((a, b) => b.length - a.length)[0] ?? null;
  return { ean, modelo };
}
