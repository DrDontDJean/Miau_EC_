import { describe, expect, it } from 'vitest';
import { crearHttp } from '../src/http.ts';

/** Una respuesta que entrega su cuerpo en trozos y cuenta cuántos llegaron a leerse. */
function cuerpoEnTrozos(trozos: string[], estado = { leidos: 0 }, status = 200) {
  const codificador = new TextEncoder();
  let i = 0;
  const flujo = new ReadableStream<Uint8Array>({
    pull(control) {
      if (i >= trozos.length) { control.close(); return; }
      estado.leidos++;
      control.enqueue(codificador.encode(trozos[i++]!));
    },
  });
  return { respuesta: new Response(flujo, { status }), estado };
}

describe('crearHttp', () => {
  it('cada tipo de lectura pide lo que espera: JSON para las APIs y HTML para las páginas', async () => {
    const accept: (string | null)[] = [];
    const fetchFalso = (async (_url: string | URL | Request, init?: RequestInit) => {
      accept.push(new Headers(init?.headers).get('accept'));
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    const http = crearHttp({ fetch: fetchFalso, esperar: async () => {} });
    await http.json('https://t.example/api');
    await http.texto('https://t.example/pagina');
    await http.binario('https://t.example/mapa.xml.gz');
    await http.inicio('https://t.example/ficha', () => true, 1000);
    expect(accept[0]).toMatch(/^application\/json/);
    expect(accept.slice(1).every(a => a?.startsWith('text/html'))).toBe(true);
  });

  it('una tienda que pide esperar más de 2 minutos corta la lectura en vez de esperar horas', async () => {
    const esperas: number[] = [];
    const fetchFalso = (async () => new Response('', { status: 429, headers: { 'retry-after': '3600' } })) as typeof fetch;
    const http = crearHttp({ fetch: fetchFalso, esperar: async ms => { esperas.push(ms); } });
    await expect(http.texto('https://t.example/x')).rejects.toThrow(/pide esperar 3600 s \(HTTP 429\)/);
    expect(esperas.every(ms => ms < 60_000)).toBe(true);
  });

  it('un Retry-After razonable se respeta', async () => {
    const esperas: number[] = [];
    let primera = true;
    const fetchFalso = (async () => {
      if (primera) { primera = false; return new Response('', { status: 429, headers: { 'retry-after': '30' } }); }
      return new Response('ok');
    }) as typeof fetch;
    const http = crearHttp({ fetch: fetchFalso, esperar: async ms => { esperas.push(ms); }, ahora: () => 0 });
    expect((await http.texto('https://t.example/x')).texto).toBe('ok');
    expect(esperas).toContain(30_000);
  });

  describe('inicio', () => {
    it('deja de leer en cuanto llega lo que se busca, sin descargar el resto de la página', async () => {
      const trozos = Array.from({ length: 50 }, (_, i) => (i === 3 ? 'FIN ' : `trozo${i} `));
      const { respuesta, estado } = cuerpoEnTrozos(trozos);
      const http = crearHttp({ fetch: (async () => respuesta) as typeof fetch, esperar: async () => {} });
      const r = await http.inicio('https://t.example/ficha', leido => leido.includes('FIN'), 1_000_000);
      expect(r.texto).toBe('trozo0 trozo1 trozo2 FIN ');
      expect(estado.leidos).toBeLessThan(10);   // nunca llegó a los 50 trozos
    });

    it('se detiene al llegar al tope de bytes aunque no aparezca lo que se busca', async () => {
      const { respuesta, estado } = cuerpoEnTrozos(Array.from({ length: 100 }, () => 'x'.repeat(100)));
      const http = crearHttp({ fetch: (async () => respuesta) as typeof fetch, esperar: async () => {} });
      const r = await http.inicio('https://t.example/ficha', () => false, 1000);
      expect(r.texto.length).toBeGreaterThanOrEqual(1000);
      expect(r.texto.length).toBeLessThan(2000);
      expect(estado.leidos).toBeLessThan(15);
    });

    it('lee toda una página corta si nunca llega lo que se busca', async () => {
      const { respuesta } = cuerpoEnTrozos(['<html>', 'corta', '</html>']);
      const http = crearHttp({ fetch: (async () => respuesta) as typeof fetch, esperar: async () => {} });
      expect(await http.inicio('https://t.example/ficha', () => false, 1_000_000)).toEqual({ texto: '<html>corta</html>', status: 200 });
    });

    it('con un estado distinto de 200 no lee el cuerpo', async () => {
      const { respuesta, estado } = cuerpoEnTrozos(['página de error enorme '.repeat(1000)], { leidos: 0 }, 404);
      const http = crearHttp({ fetch: (async () => respuesta) as typeof fetch, esperar: async () => {} });
      expect(await http.inicio('https://t.example/ficha', () => false, 1_000_000)).toEqual({ texto: '', status: 404 });
      expect(estado.leidos).toBeLessThanOrEqual(1);
    });

    it('decodifica bien un carácter multibyte partido entre dos trozos', async () => {
      const bytes = new TextEncoder().encode('precio: 12 €');
      const mitad = bytes.length - 2;   // corta en medio del euro
      const flujo = new ReadableStream<Uint8Array>({
        start(c) { c.enqueue(bytes.slice(0, mitad)); c.enqueue(bytes.slice(mitad)); c.close(); },
      });
      const http = crearHttp({ fetch: (async () => new Response(flujo)) as typeof fetch, esperar: async () => {} });
      expect((await http.inicio('https://t.example/ficha', () => false, 1000)).texto).toBe('precio: 12 €');
    });
  });
});
