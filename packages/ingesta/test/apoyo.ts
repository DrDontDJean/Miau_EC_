// Utilidades de prueba: fetch simulado que responde según la URL y registra cada petición.
import { readFileSync } from 'node:fs';
import type { TiendaIngesta } from '../src/tipos.ts';

export const fixture = <T>(nombre: string): T =>
  JSON.parse(readFileSync(new URL(`./fixtures/${nombre}`, import.meta.url), 'utf8')) as T;

export type Respuesta = { status?: number; json?: unknown; texto?: string; cabeceras?: Record<string, string | undefined> };

export function fetchFalso(responder: (url: URL) => Respuesta | undefined) {
  const peticiones: { url: string; agente: string | null }[] = [];
  const fn = (async (entrada: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(entrada));
    peticiones.push({ url: url.toString(), agente: new Headers(init?.headers).get('user-agent') });
    const r = responder(url) ?? { status: 404, texto: 'no encontrado' };
    const cuerpo = r.json !== undefined ? JSON.stringify(r.json) : (r.texto ?? '');
    const cabeceras = Object.fromEntries(Object.entries(r.cabeceras ?? {}).filter((e): e is [string, string] => e[1] !== undefined));
    return new Response(cuerpo, { status: r.status ?? 200, headers: cabeceras });
  }) as typeof fetch;
  return { fetch: fn, peticiones };
}

export const sinEspera = { esperas: [] as number[], esperar: async function (this: void, ms: number) { sinEspera.esperas.push(ms); } };

export function tienda(parcial: Partial<TiendaIngesta> = {}): TiendaIngesta {
  return {
    id: 'novicompu', nombre: 'Novicompu', origen: 'https://www.novicompu.com', plataforma: 'vtex',
    peticiones_por_segundo: 1, url_feed: null, ...parcial,
  };
}

export async function todas<T>(it: AsyncIterable<T[]>): Promise<T[][]> {
  const paginas: T[][] = [];
  for await (const p of it) paginas.push(p);
  return paginas;
}
