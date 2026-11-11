import { describe, expect, it } from 'vitest';
import { crearCatalogo, type ClienteSupabase } from '../src/lib/catalogo';
import { crearBuscarGET, crearIrGET } from '../src/lib/rutas';

// Una fila tal como la devuelve public.buscar_productos (migración 0400).
const filaTv = {
  id: '6f1c2a54-0000-4000-8000-000000000001',
  titulo: 'Televisor 55" 4K UHD Tizen UN55U8000FPCZE Samsung',
  marca: 'Samsung',
  imagen_url: 'https://comandato.vteximg.com.br/tv.png',
  precio_desde: 451.33,
  num_tiendas: 2,
  rango: 0.6,
  ofertas: [
    { id: 11, tienda_id: 'comandato', tienda: 'Comandato', titulo: 'Televisor 55" UN55U8000FPCZE', precio: 451.33,
      precio_lista: 988.25, disponible: true, visto_ultima_vez: '2026-11-06T13:40:00Z' },
    { id: 12, tienda_id: 'pycca', tienda: 'Pycca', titulo: 'Smart TV Samsung UN55U8000FPCZE', precio: 652.17,
      precio_lista: null, disponible: true, visto_ultima_vez: '2026-11-06T13:40:00Z' },
  ],
};

function clienteFalso(respuestas: Record<string, { data: unknown; error: { message: string } | null }>) {
  const llamadas: { fn: string; args: Record<string, unknown> }[] = [];
  const cliente: ClienteSupabase = {
    rpc: async (fn, args) => { llamadas.push({ fn, args: args ?? {} }); return respuestas[fn] ?? { data: null, error: { message: 'sin respuesta' } }; },
  };
  return { cliente, llamadas };
}

describe('GET /ir/[id]', () => {
  const destino = 'https://www.comandato.com/tv/p?utm_source=decideaqui&utm_medium=cpc&utm_content=pos-1';
  const params = (id: string) => ({ params: Promise.resolve({ id }) });

  it('registra la salida y redirige con 302 a la tienda, sin guardar la IP', async () => {
    const { cliente, llamadas } = clienteFalso({ registrar_salida: { data: destino, error: null } });
    const GET = crearIrGET(crearCatalogo(cliente).registrarSalida);
    const r = await GET(new Request('http://localhost/ir/11?pos=1', {
      headers: { 'x-forwarded-for': '186.3.7.197', 'user-agent': 'Firefox' },
    }), params('11'));

    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe(destino);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(llamadas[0]!.fn).toBe('registrar_salida');
    expect(llamadas[0]!.args).toMatchObject({ p_oferta_id: 11, p_posicion: 1, p_es_prueba: false });
    expect(llamadas[0]!.args.p_sesion).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(llamadas)).not.toContain('186.3.7.197');
  });

  it('marca como prueba el tráfico de k6 (cabecera X-Prueba-Carga)', async () => {
    const { cliente, llamadas } = clienteFalso({ registrar_salida: { data: destino, error: null } });
    const GET = crearIrGET(crearCatalogo(cliente).registrarSalida);
    await GET(new Request('http://localhost/ir/11', { headers: { 'x-prueba-carga': 'k6' } }), params('11'));
    expect(llamadas[0]!.args).toMatchObject({ p_es_prueba: true, p_posicion: null });
  });

  it('oferta inexistente o inactiva → 404; id no numérico → 404 sin tocar la base', async () => {
    const { cliente, llamadas } = clienteFalso({ registrar_salida: { data: null, error: null } });
    const GET = crearIrGET(crearCatalogo(cliente).registrarSalida);
    expect((await GET(new Request('http://localhost/ir/999'), params('999'))).status).toBe(404);
    expect((await GET(new Request('http://localhost/ir/abc'), params('abc'))).status).toBe(404);
    expect(llamadas).toHaveLength(1);
  });
});

describe('GET /api/buscar', () => {
  it('una consulta de menos de 2 caracteres responde 400 sin consultar la base', async () => {
    const { cliente, llamadas } = clienteFalso({});
    const r = await crearBuscarGET(crearCatalogo(cliente).buscar)(new Request('http://localhost/api/buscar?q=a'));
    expect(r.status).toBe(400);
    expect(llamadas).toEqual([]);
  });

  it('devuelve los productos con sus ofertas y el enlace /ir de cada una (contrato de k6 y del front)', async () => {
    const { cliente, llamadas } = clienteFalso({ buscar_productos: { data: [filaTv], error: null } });
    const GET = crearBuscarGET(crearCatalogo(cliente).buscar);
    const r = await GET(new Request('http://localhost/api/buscar?q=televisor%20samsung&orden=precio_asc'));

    expect(r.status).toBe(200);
    expect(llamadas).toEqual([{ fn: 'buscar_productos', args: { p_q: 'televisor samsung', p_orden: 'precio_asc', p_limite: 24, p_desde: 0 } }]);
    const cuerpo = await r.json();
    expect(cuerpo.consulta).toBe('televisor samsung');
    expect(cuerpo.productos).toHaveLength(1);
    expect(cuerpo.productos[0]).toMatchObject({ id: filaTv.id, desde: 451.33, numTiendas: 2 });
    expect(cuerpo.productos[0].ofertas.map((o: { tienda: string; ir: string }) => [o.tienda, o.ir])).toEqual([
      ['Comandato', '/ir/11?pos=1'],
      ['Pycca', '/ir/12?pos=2'],
    ]);
  });
});
