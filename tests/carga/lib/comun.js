// Utilidades compartidas por las pruebas k6.
// Contrato probado (igual en el prototipo y en la web Next.js):
//   GET /api/buscar?q=&orden=  → 200 { productos: [{ ofertas: [{ ir }] }] }
//   GET <ir>                   → 302 hacia la tienda (nunca lo seguimos)
import http from 'k6/http';
import { check, fail } from 'k6';
import { SharedArray } from 'k6/data';

export const BASE_URL = (__ENV.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

// Nunca apuntar a producción sin querer: las salidas cuentan como tráfico real.
// Solo se aceptan, sin configurar nada:
//   - localhost / 127.0.0.1 (servidor local)
//   - la URL de rama de una vista previa de Vercel: <proyecto>-git-<rama>-<equipo>.vercel.app,
//     salvo main y master, cuyo alias de rama apunta a producción.
// Cualquier otra (<proyecto>.vercel.app, un dominio propio) se trata como producción.
const HOST = (BASE_URL.match(/^https?:\/\/([^/:]+)/i) || [])[1]?.toLowerCase() || '';
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(HOST);
const VISTA_PREVIA = /^[a-z0-9-]+-git-(?!main-|master-)[a-z0-9-]+\.vercel\.app$/.test(HOST);
if (!LOCAL && !VISTA_PREVIA && __ENV.PERMITIR_PRODUCCION !== '1') {
  fail(`BASE_URL no es local ni una vista previa de rama de Vercel (${BASE_URL}). ` +
       'Usa la URL <proyecto>-git-<rama>-<equipo>.vercel.app o define PERMITIR_PRODUCCION=1 a conciencia.');
}

const cabeceras = { 'X-Prueba-Carga': 'k6', 'User-Agent': 'k6-decideaqui' };
// Vercel protege las vistas previas: el secreto de "Protection Bypass for Automation" las abre.
if (__ENV.VERCEL_BYPASS) cabeceras['x-vercel-protection-bypass'] = __ENV.VERCEL_BYPASS;

// Pocas consultas fijas: la web responde desde su base/caché y no dispara lecturas a las tiendas.
export const CONSULTAS = new SharedArray('consultas', () =>
  (__ENV.CONSULTAS || 'televisor 55,refrigeradora,laptop,lavadora,samsung galaxy').split(',').map(s => s.trim()));
const ORDENES = ['relevancia', 'precio_asc', 'precio_desc', 'ahorro'];

export const UMBRALES_BASE = {
  'http_req_failed{tipo:buscar}': ['rate<0.01'],
  'http_req_failed{tipo:salida}': ['rate<0.01'],
  checks: ['rate>0.99'],
};

export function elegir(lista) { return lista[Math.floor(Math.random() * lista.length)]; }

export function buscar(q = elegir(CONSULTAS), orden = elegir(ORDENES), tipo = 'buscar') {
  const res = http.get(`${BASE_URL}/api/buscar?q=${encodeURIComponent(q)}&orden=${orden}`, {
    headers: cabeceras, tags: { tipo, name: 'GET /api/buscar' },
  });
  let cuerpo = null;
  try { cuerpo = res.json(); } catch { /* el check lo reporta */ }
  check(res, {
    'buscar: 200': r => r.status === 200,
    'buscar: trae productos': () => Array.isArray(cuerpo?.productos),
  }, { tipo });
  return cuerpo;
}

export function salida(cuerpo) {
  const ofertas = (cuerpo?.productos || []).flatMap(p => p.ofertas || []).filter(o => o.ir);
  if (!ofertas.length) return;
  const o = elegir(ofertas);
  const url = o.ir.startsWith('http') ? o.ir : `${BASE_URL}${o.ir}`;
  const res = http.get(url, { headers: cabeceras, redirects: 0, tags: { tipo: 'salida', name: 'GET /ir' } });
  check(res, {
    'salida: 302': r => r.status === 302,
    'salida: destino https fuera de nuestro dominio': r => /^https:\/\//.test(r.headers.Location || '') &&
      !(r.headers.Location || '').startsWith(BASE_URL),
  }, { tipo: 'salida' });
}

// Recorrido típico de un comprador: busca, a veces reordena y 1 de cada 5 sale a una tienda.
export function recorrido(pausa) {
  const cuerpo = buscar();
  pausa();
  if (Math.random() < 0.3) { buscar(undefined, 'precio_asc'); pausa(); }
  if (Math.random() < 0.2) salida(cuerpo);
}

// El calentamiento se etiqueta aparte: k6 suma las peticiones de setup() a las métricas y una
// caché fría (hasta 8 s en el prototipo) no debe contar contra los umbrales de búsqueda.
export function calentar() {
  for (const q of CONSULTAS) buscar(q, 'relevancia', 'calentamiento');
}
