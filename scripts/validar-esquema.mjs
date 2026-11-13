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

// El seed: 23 tiendas activas, 1 sin permiso (Smart Home EC) y 3 pausadas (403: De Prati, El Bárbaro y Steren), y se
// puede recargar sin duplicar.
const porEstado = async () => Object.fromEntries((await db.query(`select estado::text e, count(*)::int n from public.tienda group by 1`)).rows.map(r => [r.e, r.n]));
await db.exec(readFileSync(join(RAIZ, 'supabase', 'seed.sql'), 'utf8'));
const estadosSeed = await porEstado();
ok(estadosSeed.activa === 23 && estadosSeed.sin_permiso === 1 && estadosSeed.pausada === 3,
  `seed recargado sin duplicar: 23 activas, 1 sin permiso y 3 pausadas (${JSON.stringify(estadosSeed)})`);
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
