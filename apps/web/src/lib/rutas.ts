// Route handlers como fábricas: reciben sus dependencias para poder probarlos sin Next ni Supabase.
import { ORDENES, type Orden, type Producto } from './catalogo';

export const leerOrden = (v: string | null | undefined): Orden =>
  (ORDENES as string[]).includes(v ?? '') ? (v as Orden) : 'relevancia';

export function crearBuscarGET(buscar: (q: string, orden: Orden) => Promise<Producto[]>) {
  return async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
    if (q.length < 2) return Response.json({ error: 'Escribe al menos 2 caracteres.' }, { status: 400 });
    const orden = leerOrden(url.searchParams.get('orden'));
    const productos = await buscar(q, orden);
    return Response.json({ consulta: q, orden, productos });
  };
}

/** Identificador anónimo de sesión: cambia cada día y no permite recuperar la IP. */
export async function sesionAnonima(request: Request, dia = new Date().toISOString().slice(0, 10)): Promise<string> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  const agente = request.headers.get('user-agent') ?? '';
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}|${agente}|${dia}`));
  return Array.from(new Uint8Array(bytes).slice(0, 16), b => b.toString(16).padStart(2, '0')).join('');
}

type RegistrarSalida = (ofertaId: number, posicion: number | null, sesion: string, esPrueba: boolean) => Promise<string | null>;

export function crearIrGET(registrarSalida: RegistrarSalida) {
  return async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
    const { id } = await ctx.params;
    if (!/^\d{1,18}$/.test(id)) return new Response('Oferta no encontrada', { status: 404 });
    const pos = Number(new URL(request.url).searchParams.get('pos'));
    const destino = await registrarSalida(
      Number(id),
      Number.isInteger(pos) && pos >= 1 && pos <= 100 ? pos : null,
      await sesionAnonima(request),
      request.headers.has('x-prueba-carga'),
    );
    if (!destino) return new Response('Oferta no encontrada', { status: 404 });
    return new Response(null, { status: 302, headers: { Location: destino, 'Cache-Control': 'no-store' } });
  };
}
