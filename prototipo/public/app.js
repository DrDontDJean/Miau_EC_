const $ = s => document.querySelector(s);
const usd = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });

// Crea elementos con textContent (los títulos vienen de las tiendas: nunca usamos innerHTML con ellos).
function el(tag, props = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const h of hijos.flat()) if (h != null) n.append(h);
  return n;
}

async function cargarTiendas() {
  const tiendas = await fetch('/api/tiendas').then(r => r.json());
  const cont = $('#tiendas');
  cont.replaceChildren(el('span', { class: 'tiendas-titulo', text: 'Tiendas:' }),
    ...tiendas.map(t => el('span', {
      class: `chip ${t.activa ? '' : 'chip-off'}`, id: `chip-${t.id}`,
      title: t.activa ? t.origen : `Desactivada (${t.motivo})`,
      text: t.nombre,
    })));
}

function marcarTiendas(estado) {
  for (const t of estado) {
    const chip = $(`#chip-${t.id}`);
    if (!chip) continue;
    chip.classList.toggle('chip-error', t.estado === 'error');
    chip.classList.toggle('chip-ok', t.estado === 'ok');
    chip.title = t.estado === 'ok' ? `${t.ofertas} ofertas encontradas` : `Error: ${t.error}`;
  }
}

function tarjeta(p) {
  const multiples = p.numTiendas > 1;
  const filas = p.ofertas.map((o, i) => el('li', { class: `oferta ${i === 0 ? 'oferta-mejor' : ''}` },
    el('div', { class: 'oferta-tienda' },
      el('strong', { text: o.tiendaNombre }),
      el('span', { class: o.disponible ? 'stock' : 'stock stock-no', text: o.disponible ? 'En stock' : 'Sin stock' })),
    el('div', { class: 'oferta-titulo', text: o.titulo }),
    el('div', { class: 'oferta-precio' },
      el('span', { class: 'precio', text: usd.format(o.precio) }),
      o.precioLista ? el('s', { class: 'precio-lista', text: usd.format(o.precioLista) }) : null,
      i === 0 && multiples ? el('span', { class: 'etiqueta', text: 'Mejor precio' }) : null),
    o.ir ? el('a', { class: 'boton', href: o.ir, target: '_blank', rel: 'noopener nofollow', text: 'Ver oferta' }) : null,
  ));

  return el('article', { class: 'producto' },
    el('div', { class: 'producto-img' }, p.imagen ? el('img', { src: p.imagen, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : null),
    el('div', { class: 'producto-info' },
      p.marca ? el('div', { class: 'marca', text: p.marca }) : null,
      el('h2', { text: p.titulo }),
      el('div', { class: 'producto-resumen' },
        el('span', { class: 'desde', text: `${multiples ? 'desde ' : ''}${usd.format(p.desde)}` }),
        el('span', { class: 'n-tiendas', text: multiples ? `${p.numTiendas} tiendas · hasta ${usd.format(p.hasta)}` : '1 tienda' }),
        p.ahorroPct > 0 ? el('span', { class: 'ahorro', text: `-${p.ahorroPct}%` }) : null),
      el('details', { open: multiples ? '' : null },
        el('summary', { text: multiples ? 'Comparar ofertas' : 'Ver oferta' }),
        el('ul', { class: 'ofertas' }, filas))));
}

let ultima = '';
async function buscar(q) {
  q = q.trim();
  if (q.length < 2) return;
  ultima = q;
  const orden = $('#orden').value;
  history.replaceState(null, '', `?q=${encodeURIComponent(q)}${orden !== 'relevancia' ? `&orden=${orden}` : ''}`);
  $('#estado').replaceChildren(el('p', { class: 'cargando', text: `Consultando tiendas por "${q}"…` }));
  $('#estado').hidden = false;
  $('#resultados').replaceChildren();
  try {
    const r = await fetch(`/api/buscar?q=${encodeURIComponent(q)}&orden=${orden}`);
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Error');
    if (q !== ultima) return;
    marcarTiendas(d.tiendas);
    const ok = d.tiendas.filter(t => t.estado === 'ok').length;
    const comparables = d.productos.filter(p => p.numTiendas > 1).length;
    $('#resumen').textContent = `${d.productos.length} productos (${comparables} en varias tiendas) · ${d.totalOfertas} ofertas de ${ok}/${d.tiendas.length} tiendas · ${d.desdeCache ? 'caché' : `${(d.tiempoMs / 1000).toFixed(1)} s`}`;
    $('#barra').hidden = false;
    if (!d.productos.length) {
      $('#estado').replaceChildren(el('p', { text: `No encontramos "${q}" en las tiendas consultadas.` }));
      return;
    }
    $('#estado').hidden = true;
    $('#resultados').replaceChildren(...d.productos.map(tarjeta));
  } catch (e) {
    $('#estado').replaceChildren(el('p', { class: 'error', text: `No se pudo buscar: ${e.message}` }));
  }
}

$('#form-busqueda').addEventListener('submit', e => { e.preventDefault(); buscar($('#q').value); });
$('#orden').addEventListener('change', () => ultima && buscar(ultima));
document.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { $('#q').value = b.dataset.q; buscar(b.dataset.q); }));

await cargarTiendas();
const params = new URLSearchParams(location.search);
if (params.get('orden')) $('#orden').value = params.get('orden');
if (params.get('q')) { $('#q').value = params.get('q'); buscar(params.get('q')); }
