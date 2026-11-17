// Revisor de rutas: recorre los enlaces internos de la web y falla si alguno está roto.
//
// Uso: node scripts/revisar-rutas.mjs <url base> [--fichas 50] [--espera 300]
//   node scripts/revisar-rutas.mjs http://localhost:3000
//   node scripts/revisar-rutas.mjs https://miau-ec.vercel.app --espera 1000
// Para una vista previa protegida de Vercel, la variable VERCEL_BYPASS con el secreto de bypass.
//
// Recorre: portada, tiendas, privacidad, las categorías y 5 búsquedas con sus enlaces de orden, filtro y página, y hasta
// N fichas de producto (50 por defecto) con lo que enlazan. Además comprueba tres respuestas esperadas (400 y 404).
// Falla ante: cualquier 5xx; un enlace interno que lleva a "no encontrado" (404, o la página de no encontrado servida
// en streaming con 200); un enlace a /ir/ que no sea /ir/<número>[?pos=<número>]. Nunca sigue /ir/: registraría
// salidas falsas a las tiendas. Una petición a la vez, con espera entre peticiones.
const args = process.argv.slice(2);
const opcion = (n, def) => { const i = args.indexOf(n); if (i < 0) return def; const v = args[i + 1]; args.splice(i, 2); return v; };
const FICHAS = Number(opcion('--fichas', '50'));
const ESPERA = Number(opcion('--espera', '300'));
const BASE = (args[0] ?? '').replace(/\/$/, '');
if (!/^https?:\/\//.test(BASE)) { console.error('Uso: node scripts/revisar-rutas.mjs <url base> [--fichas 50] [--espera 300]'); process.exit(2); }

const BUSQUEDAS = ['laptop', 'televisor', 'celular', 'refrigeradora', 'lavadora'];
const cabeceras = { 'user-agent': 'DecideAqui-revisor-de-rutas', ...(process.env.VERCEL_BYPASS ? { 'x-vercel-protection-bypass': process.env.VERCEL_BYPASS } : {}) };
const espera = (ms) => new Promise(r => setTimeout(r, ms));
const errores = [];
const visitadas = new Map();          // ruta → estado
const IR = /^\/ir\/\d{1,18}(\?pos=\d{1,3})?$/;

/** Rutas internas que enlaza un HTML (href="/…"), sin anclas y con &amp; decodificado. */
function enlaces(html) {
  const r = new Set();
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const h = m[1].replace(/&amp;/g, '&');
    if (h.startsWith('/') && !h.startsWith('//') && !h.startsWith('/_next/')) r.add(h.split('#')[0]);
  }
  return [...r];
}

/** Pide una ruta (sin seguir redirecciones automáticamente) y devuelve estado, cuerpo y adónde redirige. */
async function pedir(ruta) {
  await espera(ESPERA);
  try {
    const r = await fetch(BASE + ruta, { headers: cabeceras, redirect: 'manual' });
    const cuerpo = (r.headers.get('content-type') ?? '').includes('text/html') ? await r.text() : (await r.arrayBuffer(), '');
    // Redirección en streaming (dentro de <Suspense>): Next la escribe como meta refresh.
    const meta = /<meta[^>]+http-equiv="refresh"[^>]+content="\d+;\s*url=([^"]+)"/i.exec(cuerpo)?.[1]?.replace(/&amp;/g, '&');
    const destino = r.headers.get('location') ?? meta ?? null;
    // Una ficha que no existe, la primera vez que se pide, llega en streaming: Next responde 200 con noindex (desde la
    // segunda, ya en caché, 404). Se reconoce por su título. El texto "Página no encontrada" no sirve: viaja en los
    // datos de todas las páginas.
    const noEncontrada = r.status === 404 || /<title>[^<]*no encontrad[oa][^<]*<\/title>/i.test(cuerpo);
    return { estado: r.status, cuerpo, destino, noEncontrada };
  } catch (e) {
    return { estado: 'red', cuerpo: '', destino: null, noEncontrada: false, error: e.message };
  }
}

/** Visita una ruta enlazada desde `desde`; devuelve sus enlaces internos. */
async function visitar(ruta, desde) {
  if (visitadas.has(ruta)) return [];
  if (ruta.startsWith('/ir/')) {
    visitadas.set(ruta, 'no se sigue');
    if (!IR.test(ruta)) errores.push(`${ruta}: enlace de salida mal formado (en ${desde})`);
    return [];
  }
  const r = await pedir(ruta);
  visitadas.set(ruta, r.estado);
  if (r.estado === 'red' || r.estado >= 500) errores.push(`${ruta}: ${r.estado}${r.error ? ' ' + r.error : ''} (enlazada desde ${desde})`);
  else if (r.noEncontrada) errores.push(`${ruta}: no encontrada (enlazada desde ${desde})`);
  if (r.destino) {
    const interno = r.destino.startsWith(BASE) ? r.destino.slice(BASE.length) : r.destino;
    if (interno.startsWith('/')) return [interno, ...enlaces(r.cuerpo)];
  }
  return enlaces(r.cuerpo);
}

// 1) Respuestas esperadas que no son 200.
for (const [ruta, esperado] of [['/api/buscar?q=a', 400], ['/p/no-es-uuid', 404], ['/no-existe', 404]]) {
  const r = await pedir(ruta);
  const ok = r.estado === esperado || (esperado === 404 && r.noEncontrada);
  visitadas.set(ruta, r.estado);
  if (!ok) errores.push(`${ruta}: se esperaba ${esperado} y respondió ${r.estado}`);
}
// Una página de resultados que no existe lleva a la última que sí existe.
{
  const ruta = '/buscar?q=laptop&pagina=999';
  const r = await pedir(ruta);
  visitadas.set(ruta, r.estado);
  const ultima = Number(/[?&]pagina=(\d+)/.exec(r.destino ?? '')?.[1] ?? NaN);
  if (!(ultima >= 1 && ultima < 999)) errores.push(`${ruta}: debía llevar a la última página y respondió ${r.estado} sin redirección`);
}

// 2) Portada, páginas fijas y lo que enlazan (categorías, pie, destacados).
const pendientes = [];
for (const ruta of ['/', '/tiendas', '/privacidad']) for (const e of await visitar(ruta, 'inicio')) pendientes.push([e, ruta]);

// 3) Cinco búsquedas, con sus enlaces de orden, filtros y páginas (un nivel).
for (const q of BUSQUEDAS) {
  const ruta = `/buscar?q=${encodeURIComponent(q)}`;
  for (const e of await visitar(ruta, 'búsquedas')) {
    if (e.startsWith('/buscar?')) for (const e2 of await visitar(e, ruta)) pendientes.push([e2, e]);
    else pendientes.push([e, ruta]);
  }
}

// 4) Lo pendiente: fichas de producto (hasta FICHAS) y cualquier otra ruta interna no visitada, sin abrir búsquedas nuevas.
let fichas = 0;
while (pendientes.length) {
  const [ruta, desde] = pendientes.shift();
  if (visitadas.has(ruta)) continue;
  if (ruta.startsWith('/p/')) { if (fichas >= FICHAS) continue; fichas++; }
  else if (ruta.startsWith('/buscar?') && !BUSQUEDAS.some(q => ruta.startsWith(`/buscar?q=${encodeURIComponent(q)}`))) {
    // Búsquedas que enlazan otras páginas (pestañas, "quizás buscaba"): se comprueba que respondan, sin recorrerlas.
    await visitar(ruta, desde);
    continue;
  }
  for (const e of await visitar(ruta, desde)) if (!visitadas.has(e)) pendientes.push([e, ruta]);
}

const salidas = [...visitadas.values()].filter(v => v === 'no se sigue').length;
console.log(`${visitadas.size} rutas revisadas (${fichas} fichas, ${salidas} enlaces de salida comprobados sin seguir) en ${BASE}`);
if (errores.length) {
  console.log(`\n✖ ${errores.length} error(es):`);
  for (const e of errores) console.log('  ' + e);
  process.exitCode = 1;
} else {
  console.log('✔ Sin errores');
}
