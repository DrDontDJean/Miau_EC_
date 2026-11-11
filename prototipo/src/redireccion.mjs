// Redirector de salida, equivalente al /relocator/relocate de idealo:
// el usuario nunca recibe el enlace directo; pasa por /ir para que registremos el clic
// (en idealo ese clic es lo que se cobra a la tienda: modelo de coste por clic).
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { tiendaPorId } from './tiendas.mjs';

const b64 = s => Buffer.from(s, 'utf8').toString('base64url');
const unb64 = s => Buffer.from(s, 'base64url').toString('utf8');

// El id solo guarda la ruta; el dominio sale siempre de la configuración de la tienda.
// Así /ir no puede usarse como "redirección abierta" hacia sitios arbitrarios.
export function crearIdOferta(oferta) {
  const tienda = tiendaPorId(oferta.tienda);
  const u = new URL(oferta.url);
  if (!tienda || u.origin !== new URL(tienda.origen).origin) return null;
  return `${tienda.id}~${b64(u.pathname + u.search)}`;
}

export function resolverIdOferta(id, extra = {}) {
  const m = /^([a-z0-9-]+)~([A-Za-z0-9_-]+)$/.exec(String(id || ''));
  if (!m) return null;
  const tienda = tiendaPorId(m[1]);
  if (!tienda) return null;
  const ruta = unb64(m[2]);
  if (!ruta.startsWith('/') || ruta.startsWith('//')) return null;
  const destino = new URL(ruta, tienda.origen);
  if (destino.origin !== new URL(tienda.origen).origin) return null;
  destino.searchParams.set('utm_source', 'comparador-ec');
  destino.searchParams.set('utm_medium', 'cpc');
  if (extra.posicion != null) destino.searchParams.set('utm_content', `pos-${extra.posicion}`);
  return { tienda, destino: destino.toString() };
}

export async function registrarClic(archivo, datos) {
  await mkdir(dirname(archivo), { recursive: true });
  await appendFile(archivo, JSON.stringify({ fecha: new Date().toISOString(), ...datos }) + '\n');
}

export async function resumenClics(archivo) {
  let texto = '';
  try { texto = await readFile(archivo, 'utf8'); } catch { return { total: 0, porTienda: {} }; }
  const porTienda = {};
  let total = 0;
  for (const linea of texto.split('\n')) {
    if (!linea.trim()) continue;
    try { const c = JSON.parse(linea); porTienda[c.tienda] = (porTienda[c.tienda] || 0) + 1; total++; } catch { /* línea corrupta */ }
  }
  return { total, porTienda };
}
