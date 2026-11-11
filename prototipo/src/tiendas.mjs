// Catálogo de tiendas ecuatorianas soportadas.
// plataforma: 'vtex' usa /api/catalog_system/pub/products/search (catálogo público del storefront)
//             'woo'  usa /wp-json/wc/store/v1/products (Store API pública de WooCommerce)
// activa: false cuando el robots.txt de la tienda prohíbe URLs con parámetros (Disallow: /*?).
//         Actívala solo si la tienda te da permiso (lo ideal es un acuerdo de feed, como hace idealo).
export const TIENDAS = [
  { id: 'comandato',  nombre: 'Comandato',           origen: 'https://www.comandato.com',       plataforma: 'vtex', activa: true },
  { id: 'novicompu',  nombre: 'Novicompu',           origen: 'https://www.novicompu.com',       plataforma: 'vtex', activa: true },
  { id: 'kywi',       nombre: 'Kywi',                origen: 'https://www.kywi.com.ec',         plataforma: 'vtex', activa: true },
  { id: 'pycca',      nombre: 'Pycca',               origen: 'https://www.pycca.com',           plataforma: 'vtex', activa: true },
  { id: 'computron',  nombre: 'Computron',           origen: 'https://www.computron.com.ec',    plataforma: 'woo',  activa: true },
  { id: 'crecos',     nombre: 'Créditos Económicos', origen: 'https://www.crecos.com',          plataforma: 'vtex', activa: false, motivo: 'robots.txt: Disallow: /*?' },
  { id: 'japon',      nombre: 'Almacenes Japón',     origen: 'https://www.almacenesjapon.com',  plataforma: 'vtex', activa: false, motivo: 'robots.txt: Disallow: /*?' },
  { id: 'orve',       nombre: 'Orve Hogar',          origen: 'https://www.orvehogar.com',       plataforma: 'vtex', activa: false, motivo: 'robots.txt: Disallow: /*?' },
  { id: 'marcimex',   nombre: 'Marcimex',            origen: 'https://www.marcimex.com',        plataforma: 'vtex', activa: false, motivo: 'robots.txt: Disallow: /*?' },
];

// Permite activar tiendas extra sin tocar código: TIENDAS_EXTRA=crecos,japon
const extra = new Set((process.env.TIENDAS_EXTRA || '').split(',').map(s => s.trim()).filter(Boolean));
export const tiendasActivas = () => TIENDAS.filter(t => t.activa || extra.has(t.id));
export const tiendaPorId = id => TIENDAS.find(t => t.id === id);
