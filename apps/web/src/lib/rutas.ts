// Route handlers como fábricas: reciben sus dependencias para poder probarlos sin Next ni Supabase.
import { ORDENES, leerPagina, type OpcionesBusqueda, type Orden, type ResultadoBusqueda, type Sugerencia } from './catalogo';

export const leerOrden = (v: string | null | undefined): Orden =>
  (ORDENES as string[]).includes(v ?? '') ? (v as Orden) : 'relevancia';

export function crearBuscarGET(buscar: (q: string, orden: Orden, opciones: OpcionesBusqueda) => Promise<ResultadoBusqueda>) {
  return async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
    if (q.length < 2) return Response.json({ error: 'Escribe al menos 2 caracteres.' }, { status: 400 });
    const orden = leerOrden(url.searchParams.get('orden'));
    try {
      const { productos, total, limitado, pagina, porPagina } = await buscar(q, orden, { pagina: leerPagina(url.searchParams.get('pagina')) });
      return Response.json({ consulta: q, orden, pagina, porPagina, total, limitado, productos });
    } catch (e) {
      // El detalle queda en el log del servidor; el cliente recibe un 503 con JSON, nunca un 500 sin cuerpo.
      console.error('GET /api/buscar', e instanceof Error ? (e.cause ?? e) : e);
      return Response.json({ error: 'No pudimos completar la búsqueda.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  };
}

/** GET /api/sugerencias?q=: respuesta mínima y caché corta. Con menos de 2 letras, lista vacía sin tocar la base. */
export function crearSugerenciasGET(sugerir: (q: string) => Promise<Sugerencia[]>) {
  return async function GET(request: Request): Promise<Response> {
    const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 80);
    if (q.length < 2) return Response.json({ sugerencias: [] });
    try {
      return Response.json({ sugerencias: await sugerir(q) }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } });
    } catch (e) {
      console.error('GET /api/sugerencias', e instanceof Error ? (e.cause ?? e) : e);
      return Response.json({ error: 'No pudimos cargar sugerencias.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
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
