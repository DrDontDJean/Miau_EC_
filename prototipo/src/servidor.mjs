import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tiendasActivas, TIENDAS } from './tiendas.mjs';
import { buscarEnTienda } from './adaptadores.mjs';
import { agruparOfertas } from './agrupar.mjs';
import { crearIdOferta, resolverIdOferta, registrarClic, resumenClics } from './redireccion.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLICO = join(RAIZ, 'public');
const ARCHIVO_CLICS = process.env.ARCHIVO_CLICS || join(RAIZ, 'data', 'clics.jsonl');
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map();

// Consulta todas las tiendas en paralelo; si una falla, las demás siguen respondiendo.
export async function buscar(q, { buscarFn = buscarEnTienda, tiendas = tiendasActivas() } = {}) {
  const clave = q.toLowerCase();
  const enCache = cache.get(clave);
  if (enCache && Date.now() - enCache.t < CACHE_MS) return { ...enCache.datos, desdeCache: true };

  const inicio = Date.now();
  const resultados = await Promise.allSettled(tiendas.map(t => buscarFn(t, q)));
  const estado = [];
  const ofertas = [];
  resultados.forEach((r, i) => {
    const t = tiendas[i];
    if (r.status === 'fulfilled') {
      estado.push({ id: t.id, nombre: t.nombre, estado: 'ok', ofertas: r.value.length });
      ofertas.push(...r.value);
    } else {
      estado.push({ id: t.id, nombre: t.nombre, estado: 'error', error: String(r.reason?.message || r.reason) });
    }
  });
  // Intercalamos por posición para que la "relevancia" no favorezca a la primera tienda consultada.
  const porTienda = tiendas.map(t => ofertas.filter(o => o.tienda === t.id));
  const intercaladas = [];
  for (let i = 0; porTienda.some(l => i < l.length); i++) porTienda.forEach(l => l[i] && intercaladas.push(l[i]));

  const datos = { consulta: q, tiempoMs: Date.now() - inicio, tiendas: estado, ofertas: intercaladas };
  cache.set(clave, { t: Date.now(), datos });
  return datos;
}

function json(res, codigo, cuerpo) {
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(cuerpo));
}

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

async function estatico(res, ruta) {
  const archivo = normalize(join(PUBLICO, ruta === '/' ? 'index.html' : ruta));
  if (!archivo.startsWith(PUBLICO)) return json(res, 403, { error: 'Prohibido' });
  try {
    const contenido = await readFile(archivo);
    res.writeHead(200, { 'Content-Type': TIPOS[extname(archivo)] || 'application/octet-stream' });
    res.end(contenido);
  } catch {
    json(res, 404, { error: 'No encontrado' });
  }
}

export function crearServidor(opciones = {}) {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname === '/api/buscar') {
        const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
        if (q.length < 2) return json(res, 400, { error: 'Escribe al menos 2 caracteres.' });
        const datos = await buscar(q, opciones);
        const productos = agruparOfertas(datos.ofertas, url.searchParams.get('orden') || 'relevancia')
          .slice(0, 60)
          .map(g => ({
            ...g,
            ofertas: g.ofertas.map((o, i) => {
              const id = crearIdOferta(o);
              return { ...o, ir: id ? `/ir?o=${encodeURIComponent(id)}&pos=${i + 1}&p=${o.precio}` : null };
            }),
          }));
        return json(res, 200, {
          consulta: datos.consulta, tiempoMs: datos.tiempoMs, desdeCache: !!datos.desdeCache,
          tiendas: datos.tiendas, totalOfertas: datos.ofertas.length, productos,
        });
      }
      if (url.pathname === '/api/tiendas') {
        const activas = new Set(tiendasActivas().map(t => t.id));
        return json(res, 200, TIENDAS.map(t => ({ id: t.id, nombre: t.nombre, origen: t.origen, plataforma: t.plataforma, activa: activas.has(t.id), motivo: activas.has(t.id) ? undefined : t.motivo })));
      }
      if (url.pathname === '/api/clics') return json(res, 200, await resumenClics(ARCHIVO_CLICS));
      if (url.pathname === '/ir') {
        const pos = Number(url.searchParams.get('pos')) || null;
        const r = resolverIdOferta(url.searchParams.get('o'), { posicion: pos });
        if (!r) return json(res, 400, { error: 'Oferta no válida' });
        await registrarClic(ARCHIVO_CLICS, { tienda: r.tienda.id, destino: r.destino, posicion: pos, precio: Number(url.searchParams.get('p')) || null });
        res.writeHead(302, { Location: r.destino, 'Cache-Control': 'no-store', 'Referrer-Policy': 'origin' });
        return res.end();
      }
      return estatico(res, url.pathname);
    } catch (e) {
      console.error(e);
      json(res, 500, { error: 'Error interno' });
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const PUERTO = Number(process.env.PORT) || 3000;
  const HOST = process.env.HOST || '127.0.0.1';
  crearServidor().listen(PUERTO, HOST, () => {
    console.log(`Comparador EC en http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PUERTO}`);
    console.log('Tiendas activas:', tiendasActivas().map(t => t.nombre).join(', '));
  });
}
