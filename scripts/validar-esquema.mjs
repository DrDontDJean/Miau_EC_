// Uso: npm run validar:esquema  (PGlite: Postgres en WebAssembly, sin Docker).
// Aplica las migraciones en PGlite y ejecuta un escenario de ingesta de punta a punta.
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = process.argv[2] ?? fileURLToPath(new URL("..", import.meta.url));
const db = new PGlite({ extensions: { pg_trgm } });
const ok = (cond, msg) => { if (!cond) { console.error('✖', msg); process.exitCode = 1; } else console.log('✔', msg); };

// Entorno tipo Supabase: roles y esquema extensions. unaccent no existe en PGlite:
// se sustituye por un diccionario y una función con el mismo nombre y firma.
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema extensions; grant usage on schema extensions to anon, authenticated, service_role;
  create text search dictionary extensions.unaccent (template = simple, accept = false);
  create function extensions.unaccent(regdictionary, text) returns text language sql immutable as
    $$ select translate($2, 'áéíóúÁÉÍÓÚñÑüÜ', 'aeiouAEIOUnNuU') $$;
`);

const dir = join(RAIZ, 'supabase', 'migrations');
for (const f of readdirSync(dir).sort()) {
  let sql = readFileSync(join(dir, f), 'utf8');
  sql = sql.replace(/create extension if not exists unaccent[^;]*;/i, '-- unaccent sustituido');
  try { await db.exec(sql); ok(true, `migración ${f}`); }
  catch (e) { ok(false, `migración ${f}: ${e.message}`); process.exit(1); }
}
await db.exec(readFileSync(join(RAIZ, 'supabase', 'seed.sql'), 'utf8'));
ok(true, 'seed.sql');

// El seed: 24 tiendas activas, 1 sin permiso (Smart Home EC) y 3 pausadas (403: De Prati, El Bárbaro y Steren), y se
// puede recargar sin duplicar.
const porEstado = async () => Object.fromEntries((await db.query(`select estado::text e, count(*)::int n from public.tienda group by 1`)).rows.map(r => [r.e, r.n]));
await db.exec(readFileSync(join(RAIZ, 'supabase', 'seed.sql'), 'utf8'));
const estadosSeed = await porEstado();
ok(estadosSeed.activa === 24 && estadosSeed.sin_permiso === 1 && estadosSeed.pausada === 3,
  `seed recargado sin duplicar: 24 activas, 1 sin permiso y 3 pausadas (${JSON.stringify(estadosSeed)})`);
const patrones = (await db.query(`select id, patron_producto from public.tienda where plataforma = 'sitemap'`)).rows;
const malos = patrones.filter(p => { try { new RegExp(p.patron_producto); return false; } catch { return true; } });
ok(patrones.length === 12 && malos.length === 0, `${patrones.length} tiendas sitemap con patrón de producto válido (inválidos: ${malos.map(m => m.id).join(', ') || 'ninguno'})`);

const q = async (sql, params) => (await db.query(sql, params)).rows;
const uno = async (sql, params) => (await q(sql, params))[0];

const oferta = (sku, titulo, precio, extra = {}) => ({
  sku_tienda: sku, titulo, url: `https://www.${extra.dominio ?? 'comandato.com'}/${sku}/p`, imagen_url: null,
  precio, precio_lista: extra.precio_lista ?? null, disponible: extra.disponible ?? true,
  ean: extra.ean ?? null, modelo: extra.modelo ?? null, marca: extra.marca ?? null, huella: `h-${sku}-${precio}`,
});

// Corrida 1 de Comandato y de Novicompu: el mismo televisor por código de modelo.
const c1 = (await uno(`select ingesta.abrir_corrida('comandato') id`)).id;
await q(`select ingesta.cargar_lote($1, $2)`, [c1, JSON.stringify([
  oferta('100', 'Televisor 55" 4K UHD Tizen UN55U8000FPCZE Samsung', 451.33, { modelo: 'UN55U8000FPCZE', marca: 'Samsung', precio_lista: 988.25 }),
  oferta('101', 'Lámpara LED de escritorio', 12.5),
  oferta('102', 'iPhone 15 128GB azul', 700, { ean: '0195949034572', modelo: 'MTP43QLA', marca: 'Apple' }),
])]);
const n1 = (await uno(`select ingesta.abrir_corrida('novicompu') id`)).id;
await q(`select ingesta.cargar_lote($1, $2)`, [n1, JSON.stringify([
  oferta('A1', 'Televisor Samsung UN55U8000FPCZE 55" HD Smart', 591.82, { modelo: 'UN55U8000FPCZE', marca: 'Samsung', dominio: 'novicompu.com' }),
  oferta('A2', 'Apple iPhone 15 (128 GB) Azul', 689, { modelo: 'MTP43QLA', dominio: 'novicompu.com' }),
])]);
await q(`select ingesta.cerrar_corrida($1, 'ok')`, [c1]);
await q(`select ingesta.cerrar_corrida($1, 'ok')`, [n1]);

const tv = await uno(`select num_tiendas, precio_desde from public.producto where modelo = 'UN55U8000FPCZE'`);
ok(tv.num_tiendas === 2 && Number(tv.precio_desde) === 451.33, `emparejamiento por modelo: 2 tiendas desde 451.33 (obtenido ${tv.num_tiendas}, ${tv.precio_desde})`);
const ip = await q(`select o.tienda_id, o.metodo_emparejamiento m from public.oferta o join public.producto p on p.id = o.producto_id where p.ean = '0195949034572' order by 1`);
ok(ip.length === 2 && ip[1].m === 'modelo', `oferta sin EAN se une al producto con EAN por su modelo (${JSON.stringify(ip)})`);
ok((await uno(`select count(*)::int n from public.producto`)).n === 3, 'se crean 3 productos (TV, lámpara, iPhone)');
ok((await uno(`select count(*)::int n from public.precio_historial`)).n === 5, '5 periodos de historial abiertos');

// Corrida 2 de Comandato: salto de precio (451 → 45) y la lámpara desaparece.
const c2 = (await uno(`select ingesta.abrir_corrida('comandato') id`)).id;
await q(`select ingesta.cargar_lote($1, $2)`, [c2, JSON.stringify([
  oferta('100', 'Televisor 55" 4K UHD Tizen UN55U8000FPCZE Samsung', 45.13, { modelo: 'UN55U8000FPCZE' }),
  oferta('102', 'iPhone 15 128GB azul', 650, { ean: '0195949034572', modelo: 'MTP43QLA' }),
])]);
let tvc = await uno(`select precio, precio_pendiente from public.oferta where tienda_id='comandato' and sku_tienda='100'`);
ok(Number(tvc.precio) === 451.33 && Number(tvc.precio_pendiente) === 45.13, `salto de precio: se mantiene 451.33 y queda 45.13 pendiente`);
ok((await uno(`select count(*)::int n from calidad.incidencia where regla_id='salto_precio'`)).n === 1, 'incidencia salto_precio registrada');
const r2 = await uno(`select * from ingesta.cerrar_corrida($1, 'ok')`, [c2]);
ok(r2.estado === 'ok' && r2.desactivadas === 0, `la lámpara falta en 1 corrida: todavía no se desactiva (estado ${r2.estado}, desactivadas ${r2.desactivadas})`);

// Corrida 3: confirma el precio y la lámpara falta por segunda vez.
const c3 = (await uno(`select ingesta.abrir_corrida('comandato') id`)).id;
await q(`select ingesta.cargar_lote($1, $2)`, [c3, JSON.stringify([
  oferta('100', 'Televisor 55" 4K UHD Tizen UN55U8000FPCZE Samsung', 45.13, { modelo: 'UN55U8000FPCZE' }),
  oferta('102', 'iPhone 15 128GB azul', 650, { ean: '0195949034572', modelo: 'MTP43QLA' }),
])]);
tvc = await uno(`select precio, precio_pendiente from public.oferta where tienda_id='comandato' and sku_tienda='100'`);
ok(Number(tvc.precio) === 45.13 && tvc.precio_pendiente === null, 'la segunda corrida confirma el salto y lo publica');
const r3 = await uno(`select * from ingesta.cerrar_corrida($1, 'ok')`, [c3]);
ok(r3.desactivadas === 1, `la lámpara falta en 2 corridas seguidas: se desactiva (${r3.desactivadas})`);
const hist = await q(`select h.precio, h.valido_hasta is null abierto from public.precio_historial h join public.oferta o on o.id=h.oferta_id where o.sku_tienda='100' and o.tienda_id='comandato' order by valido_desde`);
ok(hist.length === 2 && hist[1].abierto, `historial SCD2 de la TV: ${hist.map(h => h.precio).join(' → ')}`);

// Pausar una tienda saca sus ofertas del precio desde sin desactivarlas; reactivarla lo restaura.
const tvAhora = async () => uno(`select num_tiendas, precio_desde::float8 desde from public.producto where modelo = 'UN55U8000FPCZE'`);
await q(`update public.tienda set estado = 'pausada' where id = 'comandato'`);
const tvPausa = await tvAhora();
ok(tvPausa.num_tiendas === 1 && tvPausa.desde === 591.82, `tienda pausada: la TV queda en 1 tienda desde 591.82 (obtenido ${tvPausa.num_tiendas}, ${tvPausa.desde})`);
await q(`update public.tienda set estado = 'activa' where id = 'comandato'`);
const tvVuelta = await tvAhora();
ok(tvVuelta.num_tiendas === 2 && tvVuelta.desde === 45.13, `tienda reactivada: vuelve a 2 tiendas desde 45.13 (obtenido ${tvVuelta.num_tiendas}, ${tvVuelta.desde})`);

// Una corrida abandonada (proceso muerto) no bloquea a su tienda: tras 3 horas se cierra sola al abrir la siguiente.
const ca = (await uno(`select ingesta.abrir_corrida('randall') id`)).id;
try { await db.query(`select ingesta.abrir_corrida('randall')`); ok(false, 'dos corridas en curso de la misma tienda'); }
catch { ok(true, 'una corrida reciente en curso sigue bloqueando otra de la misma tienda'); }
await q(`update ingesta.corrida set iniciada_en = now() - interval '4 hours' where id = $1`, [ca]);
const cb = (await uno(`select ingesta.abrir_corrida('randall') id`)).id;
const vieja = await uno(`select estado::text e, error from ingesta.corrida where id = $1`, [ca]);
ok(cb > ca && vieja.e === 'fallida' && /interrumpió/.test(vieja.error), `corrida abandonada: se cierra fallida y se abre la nueva (${vieja.e})`);
await q(`select ingesta.cerrar_corrida($1, 'ok')`, [cb]);

// Una corrida correcta de una tienda sin permiso la devuelve a activa; una pausada no se toca.
await q(`update public.tienda set estado = 'sin_permiso', motivo_estado = 'robots.txt: Disallow: /*?' where id = 'kywi'`);
const ck = (await uno(`select ingesta.abrir_corrida('kywi') id`)).id;
await q(`select ingesta.cerrar_corrida($1, 'parcial', 'prueba')`, [ck]);
const kywi = await uno(`select estado::text, motivo_estado from public.tienda where id = 'kywi'`);
ok(kywi.estado === 'activa' && kywi.motivo_estado === null, `corrida parcial de una tienda sin_permiso: vuelve a activa (${kywi.estado})`);
await q(`update public.tienda set estado = 'pausada' where id = 'kywi'`);
const cp = (await uno(`select ingesta.abrir_corrida('kywi') id`)).id;
await q(`select ingesta.cerrar_corrida($1, 'ok')`, [cp]);
ok((await uno(`select estado::text e from public.tienda where id = 'kywi'`)).e === 'pausada', 'una tienda pausada no se reactiva sola');
await q(`update public.tienda set estado = 'activa' where id = 'kywi'`);

// Corte de seguridad: una corrida que lee menos de la mitad no desactiva nada.
const c4 = (await uno(`select ingesta.abrir_corrida('novicompu') id`)).id;
await q(`select ingesta.cargar_lote($1, $2)`, [c4, JSON.stringify([oferta('A1', 'Televisor Samsung UN55U8000FPCZE 55" HD Smart', 591.82, { modelo: 'UN55U8000FPCZE', dominio: 'novicompu.com' })])]);
await q(`select ingesta.cerrar_corrida($1, 'ok')`, [c4]);
const c5 = (await uno(`select ingesta.abrir_corrida('novicompu') id`)).id;
const r5 = await uno(`select * from ingesta.cerrar_corrida($1, 'ok')`, [c5]);
ok(r5.estado === 'parcial' && r5.desactivadas === 0, `corrida vacía tras una con datos: estado ${r5.estado}, desactivadas ${r5.desactivadas}`);

// Cuarentena.
const c6 = (await uno(`select ingesta.abrir_corrida('kywi') id`)).id;
await q(`select ingesta.registrar_cuarentena($1, $2)`, [c6, JSON.stringify([{ sku_tienda: 'X', reglas: ['precio_invalido'], payload: { Price: 0 } }])]);
ok((await uno(`select en_cuarentena from ingesta.corrida where id=$1`, [c6])).en_cuarentena === 1, 'oferta inválida a cuarentena');

// Restricciones como última barrera.
try { await db.query(`insert into public.oferta (tienda_id, sku_tienda, producto_id, metodo_emparejamiento, titulo, url, precio, disponible, huella)
  select 'kywi','Z', id,'ninguno','Algo','https://www.kywi.com.ec/z', -5, true,'h' from public.producto limit 1`); ok(false, 'CHECK precio > 0'); }
catch { ok(true, 'CHECK precio > 0 rechaza precios negativos'); }

// API pública como anon.
// Sin grants manuales: el proyecto se crea sin "Automatically expose new tables",
// así que anon solo tiene lo que concede la migración 0400.
await db.exec(`set role anon`);
const prohibido = async (sql, msg) => {
  try { await db.query(sql); ok(false, msg); } catch { ok(true, msg); }
};
const res = await q(`select titulo, num_tiendas, precio_desde, jsonb_array_length(ofertas) n from public.buscar_productos('televisor samsung')`);
ok(res.length === 1 && res[0].n === 2, `buscar_productos('televisor samsung') como anon → ${JSON.stringify(res)}`);
const sinAcento = await q(`select titulo from public.buscar_productos('lampara')`);
ok(sinAcento.length === 0, `la lámpara desactivada no aparece en la búsqueda`);
const tilde = await q(`select titulo from public.buscar_productos('televisór')`);
ok(tilde.length === 1, `búsqueda con tilde de más ('televisór') encuentra el televisor`);
const typo = await q(`select titulo from public.buscar_productos('televisro samsun')`);
const ruido = await q(`select titulo from public.buscar_productos('refrigeradora')`);
ok(ruido.length === 0, "una palabra sin relación (refrigeradora) no devuelve resultados falsos");
ok(typo.length >= 1, `con error de tipeo ('televisro samsun') responde por trigramas: ${typo.map(t => t.titulo).join(' | ')}`);
const ofertaId = (await uno(`select id from public.oferta where tienda_id='novicompu' and sku_tienda='A1'`)).id;
const destino = (await uno(`select public.registrar_salida($1, 2, 'sesion-hash') url`, [ofertaId])).url;
ok(destino === 'https://www.novicompu.com/A1/p?utm_source=decideaqui&utm_medium=cpc&utm_content=pos-2', `registrar_salida → ${destino}`);
await prohibido(`select * from public.salida`, 'anon no puede leer la tabla de salidas');
await prohibido(`select * from ingesta.corrida`, 'anon no puede leer el esquema ingesta');
await prohibido(`insert into public.tienda (id, nombre, origen, plataforma) values ('falsa','X','https://x.com','vtex')`, 'anon no puede insertar tiendas');
await prohibido(`update public.oferta set precio = 1`, 'anon no puede cambiar precios');
await prohibido(`select public.recalcular_productos(array[]::uuid[])`, 'anon no puede llamar funciones internas (recalcular_productos)');
await prohibido(`select ingesta.cargar_lote(1, '[]'::jsonb)`, 'anon no puede cargar lotes de ingesta');
await db.exec(`reset role`);

// Accesorios: "televisor 55" no encabeza con soportes y cables aunque cuesten menos, pero quien busca "soporte
// televisor 55" los ve primero. Nunca se ocultan.
const cacc = (await uno(`select ingesta.abrir_corrida('ekustore') id`)).id;
await q(`select ingesta.cargar_lote($1, $2)`, [cacc, JSON.stringify([
  oferta('S1', 'Soporte para Televisor 55 pulgadas fijo de pared', 15, { dominio: 'ekustore.com' }),
  oferta('S2', 'Cable HDMI para televisor 55 pulgadas 2 metros', 6, { dominio: 'ekustore.com' }),
  oferta('S3', 'Televisor 55 pulgadas Smart con soporte de pared incluido', 500, { dominio: 'ekustore.com' }),
])]);
await q(`select ingesta.cerrar_corrida($1, 'ok')`, [cacc]);
const marcas = await q(`select left(titulo, 8) t, es_accesorio a from public.producto where titulo ~ '^(Soporte|Cable|Televisor 55 pul)' order by 1`);
ok(JSON.stringify(marcas.map(m => [m.t, m.a])) === '[["Cable HD",true],["Soporte ",true],["Televiso",false]]',
  `es_accesorio: cable y soporte sí, televisor con soporte incluido no (${JSON.stringify(marcas.map(m => [m.t, m.a]))})`);
await db.exec(`set role anon`);
const sinPedirlos = await q(`select titulo from public.buscar_productos('televisor 55', 'precio_asc', 24)`);
const idxTv = sinPedirlos.map((r, i) => (/^Televisor/.test(r.titulo) ? i : -1)).filter(i => i >= 0);
const idxAcc = sinPedirlos.map((r, i) => (/^(Soporte|Cable)/.test(r.titulo) ? i : -1)).filter(i => i >= 0);
ok(idxTv.length >= 2 && idxAcc.length === 2 && Math.max(...idxTv) < Math.min(...idxAcc),
  `"televisor 55" por precio: los televisores van antes que el soporte y el cable, que cuestan menos (${sinPedirlos.map(r => r.titulo.slice(0, 12)).join(' | ')})`);
const pidiendoloSoporte = await q(`select titulo from public.buscar_productos('soporte televisor 55', 'precio_asc', 24)`);
ok(pidiendoloSoporte[0].titulo.startsWith('Soporte') && pidiendoloSoporte.length === 2,
  `"soporte televisor 55": el soporte va primero y no se penaliza (${pidiendoloSoporte.map(r => r.titulo.slice(0, 14)).join(' | ')})`);
await db.exec(`reset role`);

// Títulos con entidades HTML (de antes de que la fuente sitemap las decodificara): la migración 1900 los limpia en oferta
// y en producto, decodifica "&amp;" al final y deja intactos los que ya están limpios. Se vuelve a ejecutar sobre datos sucios.
const csuc = (await uno(`select ingesta.abrir_corrida('randall') id`)).id;
await q(`select ingesta.cargar_lote($1, $2)`, [csuc, JSON.stringify([
  oferta('E1', 'Monitor Curvo 27&quot; Tom &amp; Jerry &apos;Pro&apos; Edicion', 300, { dominio: 'randall-tech.com' }),
  oferta('E2', 'Monitor Plano 24" ya limpio Edicion', 200, { dominio: 'randall-tech.com' }),
  oferta('E3', 'Literal &amp;quot; sin doble decodificacion Edicion', 100, { dominio: 'randall-tech.com' }),
])]);
await q(`select ingesta.cerrar_corrida($1, 'ok')`, [csuc]);
await db.exec(readFileSync(join(dir, readdirSync(dir).find(f => f.includes('titulos_sin_entidades_html'))), 'utf8'));
const limpios = (await q(`select titulo from public.producto where titulo like '%Edicion' order by titulo`)).map(r => r.titulo);
const enOfertas = (await q(`select titulo from public.oferta where sku_tienda in ('E1','E2','E3') order by sku_tienda`)).map(r => r.titulo);
ok(JSON.stringify(limpios) === JSON.stringify([`Literal &quot; sin doble decodificacion Edicion`, `Monitor Curvo 27" Tom & Jerry 'Pro' Edicion`, `Monitor Plano 24" ya limpio Edicion`]),
  `títulos de producto sin entidades HTML, sin decodificar dos veces (${JSON.stringify(limpios)})`);
ok(enOfertas[0] === `Monitor Curvo 27" Tom & Jerry 'Pro' Edicion` && enOfertas[1] === 'Monitor Plano 24" ya limpio Edicion' && enOfertas[2] === 'Literal &quot; sin doble decodificacion Edicion',
  'los títulos de oferta también quedan limpios');

// La portada pide los productos de más tiendas: sin este índice recorre toda la tabla y el rol anon corta a los 3 s.
const idxDestacados = await uno(`select indexdef from pg_indexes where indexname = 'producto_destacados_idx'`);
ok(idxDestacados && /\(num_tiendas DESC, precio_desde\)/.test(idxDestacados.indexdef) && /num_tiendas > 1/.test(idxDestacados.indexdef),
  `índice parcial de productos destacados: ${idxDestacados?.indexdef.replace(/^.* USING /, '')}`);

// Paginación: 30 parlantes de una tienda. Las páginas no repiten ni pierden productos (incluso con empates de rango),
// el total no depende del límite, y los filtros se aplican en la base antes de paginar.
const cpag = (await uno(`select ingesta.abrir_corrida('newstore') id`)).id;
await q(`select ingesta.cargar_lote($1, $2)`, [cpag, JSON.stringify(Array.from({ length: 30 }, (_, i) =>
  oferta(`PG${i}`, `Parlante Bluetooth Portatil Estilo ${String.fromCharCode(65 + i)}`, 10 + i, { dominio: 'newstore.com', disponible: i % 3 !== 0 })))]);
await q(`select ingesta.cerrar_corrida($1, 'ok')`, [cpag]);
await db.exec(`set role anon`);
const pagina = (orden, limite, desde, extra = '') =>
  q(`select id, titulo, precio_desde::float8 precio, total::int total from public.buscar_productos('parlante bluetooth', '${orden}', ${limite}, ${desde}${extra})`);
const [pg1, pg2, pg3, pg4] = [await pagina('precio_asc', 12, 0), await pagina('precio_asc', 12, 12), await pagina('precio_asc', 12, 24), await pagina('precio_asc', 12, 60)];
const juntas = [...pg1, ...pg2, ...pg3];
ok(pg1.length === 12 && pg2.length === 12 && pg3.length === 6 && pg4.length === 0 && juntas.every(f => f.total === 30),
  `paginar: 12 + 12 + 6 productos, el total es 30 en cada fila y una página fuera de rango viene vacía (${[pg1, pg2, pg3, pg4].map(p => p.length)})`);
// Un producto sin ninguna oferta disponible no tiene "precio desde": va al final, y entre sí por id.
const conPrecio = juntas.filter(f => f.precio !== null);
const primerSinPrecio = juntas.findIndex(f => f.precio === null);
ok(new Set(juntas.map(f => f.id)).size === 30 && conPrecio.length === 20 &&
   conPrecio.every((f, i) => i === 0 || f.precio > conPrecio[i - 1].precio) &&
   juntas.slice(primerSinPrecio).every(f => f.precio === null),
  'las páginas por precio no repiten ni pierden productos: 20 con precio de menor a mayor a través de las páginas y los 10 agotados al final');
const sinOrden = [];
for (let desde = 0; desde < 30; desde += 7) sinOrden.push(...await pagina('relevancia', 7, desde));
ok(sinOrden.length === 30 && new Set(sinOrden.map(f => f.id)).size === 30,
  'con empates de rango (todos igual de relevantes), las páginas de 7 siguen sin repetir ni perder productos');
const [disp] = await q(`select count(*)::int n, max(total)::int total from public.buscar_productos('parlante bluetooth', 'precio_asc', 60, 0, true)`);
ok(disp.n === 20 && disp.total === 20, `filtro "solo disponibles" en la base: 20 de 30, y el total lo refleja (${disp.n} de ${disp.total})`);
const [dePropia] = await q(`select count(*)::int n from public.buscar_productos('parlante bluetooth', 'precio_asc', 60, 0, false, false, 'newstore')`);
const [deOtra] = await q(`select count(*)::int n from public.buscar_productos('parlante bluetooth', 'precio_asc', 60, 0, false, false, 'kywi')`);
ok(dePropia.n === 30 && deOtra.n === 0, `filtro por tienda: 30 de newstore y ninguno de kywi (${dePropia.n}, ${deOtra.n})`);
const varias = await q(`select num_tiendas, total::int total from public.buscar_productos('televisor', 'relevancia', 60, 0, false, true)`);
ok(varias.length >= 1 && varias.every(f => f.num_tiendas > 1 && f.total === varias.length), `filtro "varias tiendas": solo productos de 2 o más tiendas (${varias.length})`);
const [{ facetas }] = await q(`select public.facetas_busqueda('parlante bluetooth') facetas`);
ok(facetas.total === 30 && facetas.disponibles === 20 && facetas.varias === 0 && facetas.tiendas.length === 1 && facetas.tiendas[0].id === 'newstore' && facetas.tiendas[0].n === 30,
  `facetas de la búsqueda: ${JSON.stringify(facetas)}`);
await db.exec(`reset role`);

// Frescura: llamarla dos veces seguidas deja una sola incidencia por tienda desactualizada, y una tienda que
// vuelve a tener una corrida correcta abre un episodio nuevo si se vuelve a atrasar.
const fresca1 = (await uno(`select calidad.revisar_frescura() n`)).n;
const fresca2 = (await uno(`select calidad.revisar_frescura() n`)).n;
const porTienda = await q(`select tienda_id, count(*)::int n from calidad.incidencia where regla_id = 'tienda_desactualizada' group by 1 order by 1`);
ok(fresca1 > 0 && fresca2 === 0 && porTienda.every(t => t.n === 1),
  `revisar_frescura dos veces: ${fresca1} y luego ${fresca2} incidencias nuevas (una por tienda)`);
await q(`update calidad.incidencia set creado_en = now() - interval '3 days' where regla_id = 'tienda_desactualizada' and tienda_id = 'pycca'`);
await q(`update public.tienda set ultima_corrida_ok = now() - interval '2 days' where id = 'pycca'`);
const fresca3 = (await uno(`select calidad.revisar_frescura() n`)).n;
ok(fresca3 === 1, `una tienda con una corrida correcta posterior al último aviso, que se vuelve a atrasar, recibe un aviso nuevo (${fresca3})`);

// Avisos de operación: dos corridas malas seguidas avisan una vez por episodio; una mala tras una buena no avisa;
// la base de la prueba (pocos MB) no pasa el umbral de 400 MB.
const base0 = (await uno(`select calidad.revisar_operacion() n`)).n;
await q(`insert into ingesta.corrida (tienda_id, estado, iniciada_en, terminada_en, error) values
  ('pycca', 'fallida', now() + interval '1 minute', now() + interval '2 minutes', 'HTTP 500'),
  ('pycca', 'parcial', now() + interval '3 minutes', now() + interval '4 minutes', null)`);
const op1 = (await uno(`select calidad.revisar_operacion() n`)).n;
const op2 = (await uno(`select calidad.revisar_operacion() n`)).n;
const avisoOp = await q(`select tienda_id, detalle from calidad.incidencia where regla_id = 'tienda_falla_repetida'`);
ok(base0 === 0 && op1 === 1 && op2 === 0 && avisoOp.length === 1 && avisoOp[0].tienda_id === 'pycca' && avisoOp[0].detalle.estados[0] === 'parcial',
  `revisar_operacion: ${base0} antes, ${op1} y luego ${op2} avisos (una tienda con dos corridas malas seguidas, una vez)`);
const grande = await q(`select count(*)::int n from calidad.incidencia where regla_id = 'base_grande'`);
ok(grande[0].n === 0, 'base pequeña: sin aviso base_grande');
await q(`delete from ingesta.corrida where tienda_id = 'pycca' and iniciada_en > now()`);

// ROLAP.
await db.exec(`select analitica.refrescar()`);
const comp = await q(`select tienda_id, productos_compartidos, veces_mas_barata, pct_mas_barata from analitica.competitividad_tienda order by 1`);
ok(comp.length === 2, `competitividad_tienda: ${JSON.stringify(comp)}`);
const sem = await q(`select semana, tienda_id, ofertas, precio_mediano from analitica.precio_semanal order by 2`);
ok(sem.length >= 1, `precio_semanal: ${JSON.stringify(sem)}`);
const sd = await q(`select fecha, tienda_id, salidas from analitica.salida_diaria`);
ok(sd.length === 1 && Number(sd[0].salidas) === 1, `salida_diaria: ${JSON.stringify(sd)}`);
const resumen = await q(`select corrida_id, tienda_id, estado, leidas, validas, en_cuarentena, desactivadas, incidencias from calidad.resumen_corrida order by corrida_id`);
console.log('\nResumen de calidad por corrida:'); console.table(resumen.map(r => ({ ...r, incidencias: JSON.stringify(r.incidencias) })));
