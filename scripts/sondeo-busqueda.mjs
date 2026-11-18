// Sondeo de la búsqueda pública: estado, tiempo, total y primeros títulos de cada consulta.
// Solo usa la API pública (sin credenciales) y espera entre peticiones.
//
// Uso:
//   node scripts/sondeo-busqueda.mjs [--base URL] [--simultaneas] consulta1 consulta2 ...
//   (sin consultas usa las 20 del plan: 10 normales, 5 con una letra de más o de menos y 5 inexistentes)
// --simultaneas lanza todas a la vez (prueba de concurrencia); si no, una cada 1,5 s.
// Variable opcional VERCEL_BYPASS: secreto de protección de las vistas previas de Vercel.
const args = process.argv.slice(2);
const opcion = (n) => { const i = args.indexOf(n); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const bandera = (n) => { const i = args.indexOf(n); if (i < 0) return false; args.splice(i, 1); return true; };
const BASE = (opcion('--base') ?? 'https://miau-ec.vercel.app').replace(/\/$/, '');
const SIMULTANEAS = bandera('--simultaneas');
const VEINTE = [
  'laptop', 'televisor', 'refrigeradora', 'lavadora', 'celular', 'samsung galaxy', 'tv 55', 'mouse', 'zapatos', 'cafetera',
  'refrigeradorx', 'licuadoraa', 'cafeteraa', 'lapto', 'celulares',
  'xyzqwe', 'qqqwwweee', 'zzkkxx', 'plmokn', 'wqzxv',
];
const consultas = args.length ? args : VEINTE;
const espera = (ms) => new Promise(r => setTimeout(r, ms));
const cabeceras = process.env.VERCEL_BYPASS ? { 'x-vercel-protection-bypass': process.env.VERCEL_BYPASS } : {};

async function una(q) {
  const t = performance.now();
  try {
    const r = await fetch(`${BASE}/api/buscar?q=${encodeURIComponent(q)}`, { headers: cabeceras });
    const ms = Math.round(performance.now() - t);
    let cuerpo = null; try { cuerpo = await r.json(); } catch { /* sin JSON */ }
    return { q, estado: r.status, ms, total: cuerpo?.total ?? null,
      primeros: (cuerpo?.productos ?? []).slice(0, 5).map(p => p.titulo.slice(0, 60)), error: cuerpo?.error ?? null };
  } catch (e) {
    return { q, estado: 'red', ms: Math.round(performance.now() - t), total: null, primeros: [], error: e.message };
  }
}

const filas = [];
if (SIMULTANEAS) filas.push(...await Promise.all(consultas.map(una)));
else for (const q of consultas) { filas.push(await una(q)); await espera(1500); }

for (const f of filas) {
  console.log(`${String(f.estado).padEnd(4)} ${String(f.ms).padStart(5)} ms  total=${String(f.total ?? '-').padEnd(5)} ${f.q}`);
  if (f.error) console.log(`      error: ${f.error}`);
  f.primeros.forEach((t, i) => console.log(`      ${i + 1}. ${t}`));
}
const tiempos = filas.filter(f => f.estado === 200).map(f => f.ms).sort((a, b) => a - b);
const p95 = tiempos.length ? tiempos[Math.min(tiempos.length - 1, Math.ceil(tiempos.length * 0.95) - 1)] : null;
const fallos = filas.filter(f => f.estado !== 200).length;
console.log(`\n${filas.length} consultas · ${fallos} con error · p95 (de las correctas) ${p95 ?? '-'} ms · ${BASE}`);
process.exitCode = fallos ? 1 : 0;
