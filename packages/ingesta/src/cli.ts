// Punto de entrada del worker (GitHub Actions o local con `npm run ingesta`).
//   DATABASE_URL     URI del Session pooler de Supabase (obligatoria)
//   TIENDA           solo esta tienda (opcional; por defecto, todas las activas)
//   LIMITE_PAGINAS   cortar tras N páginas por tienda y cerrar como 'parcial' (pruebas)
import postgres from 'postgres';
import { almacenPostgres, crearHttp, ejecutarCorrida, fuenteCon, type ResumenCorrida, type TiendaIngesta } from './index.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL (URI del Session pooler de Supabase).');
  process.exit(2);
}
const tiendaFiltro = process.env.TIENDA?.trim() || null;
const limitePaginas = process.env.LIMITE_PAGINAS ? Number(process.env.LIMITE_PAGINAS) : undefined;

const sql = postgres(url, { ssl: 'require', max: 6, prepare: false, onnotice: () => {} });
const almacen = almacenPostgres((q, p = []) => sql.unsafe(q, p as never[]) as unknown as Promise<Record<string, unknown>[]>);

try {
  const tiendas = (await sql.unsafe(
    `select id, nombre, origen, plataforma::text, peticiones_por_segundo::float8 as peticiones_por_segundo, url_feed
       from public.tienda where ${tiendaFiltro ? 'id = $1' : `estado = 'activa'`} order by id`,
    tiendaFiltro ? [tiendaFiltro] : [],
  )) as unknown as TiendaIngesta[];
  if (!tiendas.length) throw new Error(tiendaFiltro ? `No existe la tienda ${tiendaFiltro}` : 'No hay tiendas activas');

  console.log(`Corrida de ${tiendas.length} tienda(s): ${tiendas.map(t => t.id).join(', ')}` +
    (limitePaginas ? ` · límite ${limitePaginas} páginas` : ''));
  const inicio = Date.now();

  const resultados = await Promise.all(tiendas.map(async (t): Promise<ResumenCorrida> => {
    const http = crearHttp({ peticionesPorSegundo: t.peticiones_por_segundo });
    const r = await ejecutarCorrida(t, {
      fuente: fuenteCon(t, http),
      almacen,
      limitePaginas,
      leerRobots: async () => {
        const { texto, status } = await http.texto(`${t.origen}/robots.txt`);
        if (status >= 500) throw new Error(`robots.txt respondió ${status}`); // RFC 9309: tratar como prohibido
        return status >= 400 ? '' : texto;                                    // 4xx: sin restricciones
      },
    });
    console.log(`  ${t.id}: ${r.estado} · ${r.validas}/${r.leidas} válidas · ${r.nuevas} nuevas · ${r.actualizadas} actualizadas · ` +
      `${r.en_cuarentena} en cuarentena · ${r.desactivadas} desactivadas${r.error ? ` · ${r.error}` : ''}`);
    return r;
  }));

  console.log(`Terminado en ${Math.round((Date.now() - inicio) / 1000)} s.`);
  process.exitCode = resultados.some(r => r.estado === 'fallida') ? 1 : 0;
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
