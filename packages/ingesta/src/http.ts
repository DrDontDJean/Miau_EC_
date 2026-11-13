// Cliente HTTP cortés: identifica al comparador, respeta un ritmo máximo por tienda
// y reintenta con espera ante 429 o errores 5xx (respetando Retry-After, hasta un máximo razonable).

export const AGENTE = 'DecideAqui/0.1 (proyecto universitario)';

// Cada tipo de lectura pide lo que espera recibir. Un servidor que ve "application/json" primero puede
// responder vacío a una página HTML (PrestaShop lo hace).
const ACCEPT_JSON = 'application/json, text/plain, */*';
const ACCEPT_PAGINA = 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5';
/** Más espera que esta no se acepta: una tienda que pide esperar horas está pidiendo que no insistamos. */
const MAX_RETRY_AFTER_S = 120;

export type OpcionesHttp = {
  fetch?: typeof fetch;
  esperar?: (ms: number) => Promise<void>;
  ahora?: () => number;
  peticionesPorSegundo?: number;
  reintentos?: number;
  timeoutMs?: number;
};

export type Http = {
  json<T = unknown>(url: string): Promise<{ datos: T; cabeceras: Headers }>;
  texto(url: string): Promise<{ texto: string; status: number }>;
  /** Cuerpo sin interpretar, para archivos comprimidos (sitemap.xml.gz). */
  binario(url: string): Promise<{ datos: Uint8Array; status: number }>;
  /**
   * Solo el principio de una página: se deja de leer (y de descargar) en cuanto `completo` dice que ya está lo
   * que se busca, o al llegar a `maxBytes`. Con un estado distinto de 200 no se lee el cuerpo.
   */
  inicio(url: string, completo: (leido: string) => boolean, maxBytes: number): Promise<{ texto: string; status: number }>;
};

const dormir = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export function crearHttp(o: OpcionesHttp = {}): Http {
  const f = o.fetch ?? fetch;
  const esperar = o.esperar ?? dormir;
  const ahora = o.ahora ?? Date.now;
  const intervalo = 1000 / (o.peticionesPorSegundo ?? 1);
  const reintentos = o.reintentos ?? 3;
  const timeoutMs = o.timeoutMs ?? 30_000;
  let ultima = Number.NEGATIVE_INFINITY;

  async function pedir(url: string, accept: string): Promise<Response> {
    for (let intento = 0; ; intento++) {
      const pendiente = ultima + intervalo - ahora();
      if (pendiente > 0) await esperar(pendiente);
      ultima = ahora();
      let r: Response;
      try {
        r = await f(url, {
          headers: { 'User-Agent': AGENTE, Accept: accept },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        if (intento < reintentos) { await esperar(1000 * 2 ** intento); continue; }
        throw e;
      }
      if ((r.status === 429 || r.status >= 500) && intento < reintentos) {
        const retryAfter = Number(r.headers.get('retry-after'));
        if (retryAfter > MAX_RETRY_AFTER_S) {
          await r.body?.cancel();
          throw new Error(`La tienda pide esperar ${retryAfter} s (HTTP ${r.status}): se detiene la lectura de ${url}`);
        }
        await r.body?.cancel();
        await esperar(retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** intento);
        continue;
      }
      return r;
    }
  }

  return {
    async json<T>(url: string) {
      const r = await pedir(url, ACCEPT_JSON);
      if (r.status !== 200 && r.status !== 206) throw new Error(`HTTP ${r.status} en ${url}`);
      return { datos: (await r.json()) as T, cabeceras: r.headers };
    },
    async texto(url: string) {
      const r = await pedir(url, ACCEPT_PAGINA);
      return { texto: await r.text(), status: r.status };
    },
    async binario(url) {
      const r = await pedir(url, ACCEPT_PAGINA);
      return { datos: new Uint8Array(await r.arrayBuffer()), status: r.status };
    },
    async inicio(url, completo, maxBytes) {
      const r = await pedir(url, ACCEPT_PAGINA);
      if (r.status !== 200 || !r.body) {
        const texto = r.status === 200 ? await r.text() : '';
        await r.body?.cancel();
        return { texto, status: r.status };
      }
      const lector = r.body.getReader();
      const decodificador = new TextDecoder();
      let texto = '';
      let bytes = 0;
      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        bytes += value.byteLength;
        texto += decodificador.decode(value, { stream: true });
        if (completo(texto) || bytes >= maxBytes) { await lector.cancel(); break; }
      }
      return { texto, status: r.status };
    },
  };
}
