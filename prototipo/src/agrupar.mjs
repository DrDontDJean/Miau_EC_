// Agrupa ofertas de distintas tiendas que corresponden al mismo producto,
// igual que idealo muestra "N ofertas desde $X" por producto.
// Estrategia de emparejamiento (de más a menos fiable):
//   1. EAN/UPC válido (dígito de control correcto)
//   2. Código de modelo del fabricante extraído del título (p. ej. 65MNUHD, QN65Q7FAAPCZE)
//   3. Sin coincidencia: la oferta queda como producto propio.

export function eanValido(code) {
  const s = String(code || '').trim();
  if (!/^\d{12,14}$/.test(s)) return false;
  const digitos = s.split('').map(Number);
  const control = digitos.pop();
  const suma = digitos.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (suma % 10)) % 10 === control;
}

const NO_MODELO = [
  /^\d+(GB|TB|MB|HZ|MAH|W|MP|CM|MM|KG|LB|LBS|BTU|V|PULG|PULGADAS|L|ML|G|X)$/,
  /^(4K|8K|5G|4G|3G|2K|HD|FHD|UHD|USB|HDMI|WIFI\d?|BT\d)$/,
  /^(I[3579]|RYZEN\d?|GEN\d+|DDR\d|LPDDR\d+X?|M[1-4]|A1\d)$/,
];

export function codigosModelo(titulo = '') {
  return String(titulo)
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^A-Z0-9]+/)
    .filter(t => t.length >= 6 && t.length <= 20 && /[A-Z]/.test(t) && /\d/.test(t))
    .filter(t => !NO_MODELO.some(re => re.test(t)));
}

export function claveProducto(oferta) {
  if (eanValido(oferta.ean)) return `ean:${oferta.ean.replace(/^0+/, '')}`;
  const codigos = codigosModelo(oferta.titulo);
  if (codigos.length) return `modelo:${codigos.sort((a, b) => b.length - a.length)[0]}`;
  return `oferta:${oferta.tienda}:${oferta.sku}`;
}

const porPrecio = (a, b) => (b.disponible - a.disponible) || (a.precio - b.precio);

export function agruparOfertas(ofertas, orden = 'relevancia') {
  const grupos = new Map();
  ofertas.forEach((o, posicion) => {
    const clave = claveProducto(o);
    if (!grupos.has(clave)) grupos.set(clave, { clave, ofertas: [], rango: posicion });
    const g = grupos.get(clave);
    // Una tienda aparece una sola vez por producto: nos quedamos con su oferta más barata.
    const previa = g.ofertas.findIndex(x => x.tienda === o.tienda);
    if (previa === -1) g.ofertas.push(o);
    else if (porPrecio(o, g.ofertas[previa]) < 0) g.ofertas[previa] = o;
    g.rango = Math.min(g.rango, posicion);
  });

  const lista = [...grupos.values()].map(g => {
    g.ofertas.sort(porPrecio);
    const conStock = g.ofertas.filter(o => o.disponible);
    const precios = (conStock.length ? conStock : g.ofertas).map(o => o.precio);
    const ref = g.ofertas[0];
    const maxLista = Math.max(0, ...g.ofertas.map(o => o.precioLista || 0));
    return {
      clave: g.clave,
      titulo: ref.titulo,
      marca: g.ofertas.find(o => o.marca)?.marca || '',
      imagen: g.ofertas.find(o => o.imagen)?.imagen || null,
      desde: Math.min(...precios),
      hasta: Math.max(...precios),
      ahorroPct: maxLista > 0 ? Math.round((1 - Math.min(...precios) / maxLista) * 100) : 0,
      numTiendas: g.ofertas.length,
      rango: g.rango,
      ofertas: g.ofertas,
    };
  });

  const comparadores = {
    relevancia: (a, b) => (b.numTiendas > 1) - (a.numTiendas > 1) || a.rango - b.rango,
    precio_asc: (a, b) => a.desde - b.desde,
    precio_desc: (a, b) => b.desde - a.desde,
    ahorro: (a, b) => b.ahorroPct - a.ahorroPct || a.desde - b.desde,
  };
  return lista.sort(comparadores[orden] || comparadores.relevancia);
}
