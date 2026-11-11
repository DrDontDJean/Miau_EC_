// Adaptadores: traducen la API pública de cada plataforma a una "oferta" normalizada.
// Oferta = { tienda, tiendaNombre, titulo, marca, sku, ean, precio, precioLista, disponible, imagen, url }

export const USER_AGENT = 'ComparadorEC-prototipo/0.1 (proyecto universitario)';
const POR_TIENDA = 24;

async function getJson(url, timeoutMs) {
  const r = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  // VTEX responde 206 (Partial Content) en búsquedas paginadas: también es éxito.
  if (r.status !== 200 && r.status !== 206) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const ENTIDADES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
export function decodificarHtml(s = '') {
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- VTEX ----------
export function normalizarVtex(tienda, productos) {
  const ofertas = [];
  for (const p of productos || []) {
    // Elegimos el SKU/vendedor más barato que tenga stock.
    let mejor = null;
    for (const item of p.items || []) {
      for (const s of item.sellers || []) {
        const o = s.commertialOffer || {};
        if (!(o.Price > 0)) continue;
        const disponible = (o.AvailableQuantity ?? 0) > 0 || o.IsAvailable === true;
        const cand = { item, o, disponible };
        if (!mejor || (cand.disponible && !mejor.disponible) ||
            (cand.disponible === mejor.disponible && o.Price < mejor.o.Price)) mejor = cand;
      }
    }
    if (!mejor || !p.link) continue;
    ofertas.push({
      tienda: tienda.id,
      tiendaNombre: tienda.nombre,
      titulo: decodificarHtml(p.productName),
      marca: decodificarHtml(p.brand || ''),
      sku: String(mejor.item.itemId ?? p.productId),
      ean: String(mejor.item.ean || ''),
      precio: round2(mejor.o.Price),
      precioLista: mejor.o.ListPrice > mejor.o.Price ? round2(mejor.o.ListPrice) : null,
      disponible: mejor.disponible,
      imagen: mejor.item.images?.[0]?.imageUrl || null,
      url: p.link,
    });
  }
  return ofertas;
}

async function buscarVtex(tienda, q, timeoutMs) {
  const url = `${tienda.origen}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(q)}&_from=0&_to=${POR_TIENDA - 1}`;
  return normalizarVtex(tienda, await getJson(url, timeoutMs));
}

// ---------- WooCommerce Store API ----------
export function normalizarWoo(tienda, productos) {
  const ofertas = [];
  for (const p of productos || []) {
    const pr = p.prices || {};
    const div = 10 ** (pr.currency_minor_unit ?? 2);
    const precio = Number(pr.price) / div;
    if (!(precio > 0) || !p.permalink) continue;
    const regular = Number(pr.regular_price) / div;
    const marca = (p.brands?.[0]?.name) || (p.attributes || []).find(a => /marca/i.test(a.name))?.terms?.[0]?.name || '';
    ofertas.push({
      tienda: tienda.id,
      tiendaNombre: tienda.nombre,
      titulo: decodificarHtml(p.name),
      marca: decodificarHtml(marca),
      sku: String(p.sku || p.id),
      ean: '',
      precio: round2(precio),
      precioLista: regular > precio ? round2(regular) : null,
      disponible: p.is_in_stock !== false,
      imagen: p.images?.[0]?.src || null,
      url: p.permalink,
    });
  }
  return ofertas;
}

async function buscarWoo(tienda, q, timeoutMs) {
  const url = `${tienda.origen}/wp-json/wc/store/v1/products?search=${encodeURIComponent(q)}&per_page=${POR_TIENDA}`;
  return normalizarWoo(tienda, await getJson(url, timeoutMs));
}

const ADAPTADORES = { vtex: buscarVtex, woo: buscarWoo };

export async function buscarEnTienda(tienda, q, timeoutMs = 8000) {
  const fn = ADAPTADORES[tienda.plataforma];
  if (!fn) throw new Error(`Plataforma no soportada: ${tienda.plataforma}`);
  return fn(tienda, q, timeoutMs);
}

function round2(n) { return Math.round(n * 100) / 100; }
