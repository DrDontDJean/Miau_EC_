// Cliente HTTP cortés: identifica al comparador, respeta un ritmo máximo por tienda
// y reintenta con espera ante 429 o errores 5xx (respetando Retry-After).

export const AGENTE = 'DecideAqui/0.1 (proyecto universitario)';

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

  async function pedir(url: string): Promise<Response> {
    for (let intento = 0; ; intento++) {
      const pendiente = ultima + intervalo - ahora();
      if (pendiente > 0) await esperar(pendiente);
      ultima = ahora();
      let r: Response;
      try {
        r = await f(url, {
          headers: { 'User-Agent': AGENTE, Accept: 'application/json, text/html, application/xml, text/plain, */*' },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        if (intento < reintentos) { await esperar(1000 * 2 ** intento); continue; }
        throw e;
      }
      if ((r.status === 429 || r.status >= 500) && intento < reintentos) {
        const retryAfter = Number(r.headers.get('retry-after'));
        await esperar(retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** intento);
        continue;
      }
      return r;
    }
  }

  return {
    async json<T>(url: string) {
      const r = await pedir(url);
      if (r.status !== 200 && r.status !== 206) throw new Error(`HTTP ${r.status} en ${url}`);
      return { datos: (await r.json()) as T, cabeceras: r.headers };
    },
    async texto(url: string) {
      const r = await pedir(url);
      return { texto: await r.text(), status: r.status };
    },
    async binario(url) {
      const r = await pedir(url);
      return { datos: new Uint8Array(await r.arrayBuffer()), status: r.status };
    },
  };
}
