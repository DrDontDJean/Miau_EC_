// Uso: npm run validar:esquema  (PGlite: Postgres en WebAssembly, sin Docker).
// Aplica las migraciones en PGlite y ejecuta un escenario de ingesta de punta a punta.
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clasificarPendientes } from '../packages/ingesta/src/clasificar.ts';

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
const definers = await q(`select proname, prosecdef from pg_proc where proname in ('buscar_catalogo', 'buscar_productos', 'facetas_busqueda', 'candidatos_busqueda') order by 1`);
ok(definers.length === 4 && definers.every(f => f.prosecdef),
  'las funciones de búsqueda son security definer: con RLS, los índices de texto y de trigramas no se podrían usar');
await db.exec(`reset role`); // pg_index de producto solo lo lee su dueño
const [rp] = await q(`select id, actualizado_en from public.producto where num_tiendas > 0 order by id limit 1`);
await q(`select pg_sleep(0.01)`);
await q(`select public.recalcular_productos(array[$1]::uuid[])`, [rp.id]);
const [rp2] = await q(`select actualizado_en from public.producto where id = $1`, [rp.id]);
ok(String(rp2.actualizado_en) === String(rp.actualizado_en),
  'recalcular_productos no reescribe un producto cuyo precio desde y tiendas siguen iguales (la ingesta se cortaba por tiempo)');
const gin = await q(`select c.relname, c.reloptions from pg_index i join pg_class c on c.oid = i.indexrelid join pg_am a on a.oid = c.relam
                     where i.indrelid = 'public.producto'::regclass and a.amname = 'gin' order by 1`);
ok(gin.length === 3 && gin.every(g => (g.reloptions ?? []).includes('fastupdate=off')),
  `índices GIN de producto sin lista pendiente (fastupdate=off): ${gin.map(g => g.relname).join(', ')}`);
const cubre = await q(`select pg_get_indexdef(indexrelid) def from pg_index where indexrelid = 'public.oferta_producto_cubre_idx'::regclass`);
const tope = await q(`select prosrc ~ 'v_tope +constant int := 1000' as mil from pg_proc where proname = 'buscar_catalogo'`);
ok(cubre.length === 1 && cubre[0].def.includes('INCLUDE (tienda_id, disponible)') && tope[0]?.mil,
  `búsqueda con menos lecturas: índice de ofertas que cubre las facetas y tope de 1.000 candidatos (${JSON.stringify({ def: cubre[0]?.def, tope })})`);
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

// Migración 2200: todas las entidades, nombradas y numéricas, en una sola pasada (sin decodificar dos veces), y la marca.
const cent = (await uno(`select ingesta.abrir_corrida('randall') id`)).id;
await q(`select ingesta.cargar_lote($1, $2)`, [cent, JSON.stringify([
  oferta('N1', 'Celular Oppo &nbsp; Reno 11 5G Ent2200', 300, { dominio: 'randall-tech.com' }),
  oferta('N2', 'Televisor 55&#8243; Ba&ntilde;o &#xF1;and&#xFA; Ent2200', 200, { dominio: 'randall-tech.com' }),
  oferta('N3', 'Literal &amp;nbsp; y &noexiste; y &#0; Ent2200', 100, { dominio: 'randall-tech.com' }),
])]);
await q(`select ingesta.cerrar_corrida($1, 'ok')`, [cent]);
await q(`update public.producto set marca = 'Marca &amp; Co' where titulo like 'Celular Oppo%Ent2200'`);
await db.exec(readFileSync(join(dir, readdirSync(dir).find(f => f.includes('titulos_todas_las_entidades'))), 'utf8'));
const ent = (await q(`select titulo, marca from public.producto where titulo like '%Ent2200' order by titulo`));
const entOf = (await q(`select titulo from public.oferta where sku_tienda in ('N1','N2','N3') order by sku_tienda`)).map(r => r.titulo);
const esperados = ['Celular Oppo Reno 11 5G Ent2200', 'Literal &nbsp; y &noexiste; y &#0; Ent2200', 'Televisor 55″ Baño ñandú Ent2200'];
ok(JSON.stringify(ent.map(r => r.titulo)) === JSON.stringify(esperados) && ent[0].marca === 'Marca & Co',
  `migración 2200: títulos y marca de producto sin entidades, sin doble decodificación (${JSON.stringify(ent)})`);
ok(JSON.stringify(entOf) === JSON.stringify([esperados[0], esperados[2], esperados[1]]), `migración 2200: títulos de oferta limpios (${JSON.stringify(entOf)})`);

// Búsqueda en una sola consulta (migración 2300): pruebas doradas de relevancia con los casos reales del diagnóstico.
const GOLD = {
  G01: 'Celular Samsung Galaxy A15 128GB Oro', G02: 'Esponja de celulosa para cocina Oro', G03: 'Tratamiento Capilar Células Madre Oro',
  G04: 'Celulares Xiaomi Redmi 13 Oro', G05: 'Refrigerador Mabe 300 litros Oro', G06: 'Refrigeradora LG Inverter 420 L Oro',
  G07: 'Protector De Voltaje P/Tv Y Refrigerador Oro', G08: 'Laptop HP 15 Intel Core i5 Oro', G09: 'Mochila P-Laptop Clasica 14plg Oro',
  G10: 'Control de Televisor Samsung universal Oro', G11: 'Televisor LG 55 pulgadas 4K Oro', G12: 'Carcasa Samsung Galaxy A34 Oro',
  G13: 'Desodorante para zapatos 100 ml Oro', G14: 'Zapatos deportivos Nike Revolution Oro', G15: 'Cafetera Imaco 12 tazas Oro',
  G16: 'Parlante Portátil JBL Go 4 Oro', G17: 'Teléfono inalámbrico Panasonic KX Oro', G18: 'Nevera portátil Coleman 30 L Oro', G19: 'Memoria RAM DDR4 8GB Kingston Laptop Oro',
};
const cgold = (await uno(`select ingesta.abrir_corrida('randall') id`)).id;
await q(`select ingesta.cargar_lote($1, $2)`, [cgold, JSON.stringify(
  Object.entries(GOLD).map(([sku, t], i) => oferta(sku, t, 100 + i, { dominio: 'randall-tech.com' })))]);
await q(`select ingesta.cerrar_corrida($1, 'ok')`, [cgold]);
const codigoDe = Object.fromEntries(Object.entries(GOLD).map(([k, t]) => [t, k]));
await db.exec(`set role anon`);
const busca = async (texto, extra = '') => (await uno(`select public.buscar_catalogo($1 ${extra}) r`, [texto])).r;
const orosDe = (r) => r.productos.map(p => codigoDe[p.titulo]).filter(Boolean);
const g = {};
for (const t of ['celular', 'celulares', 'refrigeradora', 'nevera', 'laptop', 'televisor', 'samsung galaxy', 'zapatos', 'cafeteraa', 'xyzqwe', 'tv 55', 'mochila laptop', 'portatil'])
  g[t] = orosDe(await busca(t));
const antes = (l, a, b) => l.includes(a) && l.includes(b) && l.indexOf(a) < l.indexOf(b);
ok(g.celular.includes('G01') && g.celular.includes('G04') && !g.celular.includes('G02') && !g.celular.includes('G03'),
  `"celular" encuentra celulares y no celulosa ni células (${g.celular})`);
ok(JSON.stringify([...g.celulares].sort()) === JSON.stringify([...g.celular].sort()), `"celulares" da lo mismo que "celular" (${g.celulares})`);
ok(g.refrigeradora[0] !== 'G07' && antes(g.refrigeradora, 'G05', 'G07') && antes(g.refrigeradora, 'G06', 'G07'),
  `"refrigeradora": refrigeradores primero, el protector de voltaje después (${g.refrigeradora})`);
ok(g.nevera.includes('G05') && g.nevera.includes('G06'), `"nevera" encuentra refrigeradoras (${g.nevera})`);
ok(!g.laptop.includes('G16') && !g.celular.includes('G17') && !g.refrigeradora.includes('G18'),
  `sinónimos de un solo sentido: "laptop" no trae parlantes portátiles, "celular" no trae teléfonos fijos, "refrigeradora" no trae neveras de playa (${g.laptop} | ${g.celular} | ${g.refrigeradora})`);
ok(g.portatil.includes('G08'), `"portátil" sí encuentra laptops (${g.portatil})`);
ok(antes(g.laptop, 'G08', 'G09') && antes(g.laptop, 'G08', 'G19'), `"laptop": la laptop antes que la mochila y que la memoria RAM (${g.laptop})`);
ok(antes(g.televisor, 'G11', 'G10'), `"televisor": el televisor antes que el control (${g.televisor})`);
ok(antes(g['samsung galaxy'], 'G01', 'G12'), `"samsung galaxy": el celular antes que la carcasa (${g['samsung galaxy']})`);
ok(antes(g.zapatos, 'G14', 'G13'), `"zapatos": los zapatos antes que el desodorante (${g.zapatos})`);
ok(g.cafeteraa.includes('G15'), `"cafeteraa" (mal escrita) encuentra la cafetera (${g.cafeteraa})`);
ok(g['tv 55'].includes('G11'), `"tv 55" encuentra el televisor de 55 (${g['tv 55']})`);
ok(g['mochila laptop'][0] === 'G09', `"mochila laptop": quien pide el accesorio lo ve primero (${g['mochila laptop']})`);
const nada = await busca('xyzqwe');
ok(nada.total === 0 && nada.productos.length === 0 && nada.facetas.total === 0, 'una búsqueda que no existe no trae nada');
const una = await busca('celular', `, 'relevancia', 1, 1`);
ok(una.productos.length === 1 && una.total >= 2 && una.facetas.total >= una.total && Array.isArray(una.facetas.tiendas) && una.limitado === false,
  `buscar_catalogo devuelve página, total y facetas en una llamada (${JSON.stringify({ total: una.total, facetas: una.facetas.total })})`);
// Sugerencias (migración 2400): marcas por prefijo y productos con los mismos términos de la búsqueda.
await db.exec(`reset role`);
await q(`update public.producto set marca = 'Samsung' where titulo in ('Celular Samsung Galaxy A15 128GB Oro', 'Carcasa Samsung Galaxy A34 Oro')`);
await db.exec(`set role anon`);
const sug = async (t) => (await uno(`select public.sugerir_busqueda($1) s`, [t])).s;
const sSams = await sug('sams'), sCel = await sug('celular'), sNada = await sug('xyzq'), sUna = await sug('a');
ok(sSams.some(x => x.tipo === 'marca' && x.texto === 'Samsung'), `sugerencias de "sams": la marca Samsung (${JSON.stringify(sSams.map(x => x.texto))})`);
const tCel = sCel.filter(x => x.tipo === 'producto').map(x => codigoDe[x.texto]).filter(Boolean);
ok(tCel.includes('G01') && !tCel.includes('G02') && !tCel.includes('G03') && sCel.length <= 8 && sCel.every(x => x.tipo !== 'producto' || x.id),
  `sugerencias de "celular": celulares con su id, sin celulosa ni células, 8 como máximo (${tCel})`);
ok(sNada.length === 0 && sUna.length === 0, 'sin sugerencias para algo que no existe ni para una sola letra');
const quizas = async (t) => (await uno(`select public.quizas_buscaba($1) s`, [t])).s;
const qRefri = await quizas('refrijeradoraz'), qNada = await quizas('xyzqwe');
ok(qRefri.includes('refrigeradora') && qRefri.length <= 3 && qNada.length === 0, `"quizás buscaba": refrigeradora para una errata, nada para xyzqwe (${qRefri})`);

// Categorías y filtros (migración 2500), con la clasificación de la ingesta (dominio: categoriaDe y atributosDe).
await db.exec(`reset role`);
const cfil = (await uno(`select ingesta.abrir_corrida('randall') id`)).id;
await q(`select ingesta.cargar_lote($1, $2)`, [cfil, JSON.stringify([
  oferta('L1', 'Laptop HP Ryzen 5 16GB 512GB 15.6" Filtro', 500, { dominio: 'randall-tech.com' }),
  oferta('L2', 'Laptop Asus Intel Core i5 8GB 256GB 14" Filtro', 400, { dominio: 'randall-tech.com' }),
  oferta('L3', 'Laptop Dell Intel Core i7 16GB 1TB RTX 4060 16" Filtro', 1500, { dominio: 'randall-tech.com' }),
])]);
await q(`select ingesta.cerrar_corrida($1, 'ok')`, [cfil]);
const ejecutarPg = async (sql, params = []) => (await db.query(sql, params)).rows;
const clas = await clasificarPendientes(ejecutarPg);
const sinClasificar = (await uno(`select count(*)::int n from public.producto where atributos is null`)).n;
ok(clas.revisados > 0 && clas.conCategoria >= 8 && sinClasificar === 0,
  `clasificación de la ingesta: ${clas.revisados} productos, ${clas.conCategoria} con categoría, ninguno pendiente`);
await db.exec(`set role anon`);
const cat = async (texto, extra) => (await uno(`select public.buscar_catalogo($1, ${extra}) r`, [texto])).r;
const filtroDe = (r) => r.productos.map(p => p.titulo).filter(t => t.endsWith('Filtro')).map(t => t.split(' ')[1]);
const navega = await cat('', `p_categoria => 'laptops'`);
const tNav = navega.productos.map(p => codigoDe[p.titulo] ?? p.titulo.split(' ')[1]);
ok(navega.total >= 4 && tNav.includes('G08') && !tNav.includes('G09') && !tNav.includes('G19'),
  `recorrer la categoría laptops sin texto: laptops sí, mochila y memoria RAM no (${tNav})`);
const intel = await cat('', `p_categoria => 'laptops', p_filtros => '{"procesador": ["intel"]}'`);
const intel16 = await cat('', `p_categoria => 'laptops', p_filtros => '{"procesador": ["intel"], "ram": ["16"]}'`);
ok(JSON.stringify(filtroDe(intel).sort()) === '["Asus","Dell"]' && JSON.stringify(filtroDe(intel16)) === '["Dell"]',
  `filtros por atributo: procesador Intel (${filtroDe(intel)}), Intel y 16 GB (${filtroDe(intel16)})`);
const procesadores = Object.fromEntries((intel.facetas.atributos.procesador ?? []).map(x => [x.valor, x.n]));
const rams = Object.fromEntries((intel.facetas.atributos.ram ?? []).map(x => [x.valor, x.n]));
ok(procesadores.amd >= 1 && procesadores.intel >= 3 && rams['16'] === 1 && rams['8'] === 1 && !('amd' in rams),
  `conteos por atributo: el filtro propio no se aplica a sí mismo, los demás sí (procesador ${JSON.stringify(procesadores)}, ram ${JSON.stringify(rams)})`);
const noIndicado = await cat('', `p_categoria => 'laptops', p_filtros => '{"ram": ["no-indicado"]}'`);
ok(noIndicado.productos.some(p => codigoDe[p.titulo] === 'G08') && filtroDe(noIndicado).length === 0,
  'el valor "no-indicado" elige los productos sin ese dato');
const baratas = await cat('', `p_categoria => 'laptops', p_precio_max => 450`);
ok(baratas.productos.every(p => Number(p.precio_desde) <= 450) && filtroDe(baratas).includes('Asus') && !filtroDe(baratas).includes('Dell')
  && Number(navega.facetas.precio.min) <= 400 && Number(navega.facetas.precio.max) >= 1500,
  `filtro de precio hasta 450 y rango de precios en las facetas (${JSON.stringify(navega.facetas.precio)})`);
const conTexto = await cat('laptop', `p_categoria => null`);
const catLaptop = conTexto.facetas.categorias.find(c => c.slug === 'laptops');
ok(catLaptop && catLaptop.n >= 4 && conTexto.facetas.categorias[0].slug === 'laptops',
  `sin categoría elegida, las facetas cuentan por categoría (${JSON.stringify(conTexto.facetas.categorias)})`);
const desconocida = await cat('', `p_categoria => 'no-existe'`);
ok(desconocida.total === 0 && (await cat('', `p_categoria => null`)).total === 0, 'sin texto ni categoría válida no trae nada');
const sLap = await sug('lap'), sTv = await sug('tv');
ok(sLap[0]?.tipo === 'categoria' && sLap[0]?.slug === 'laptops' && sTv.some(x => x.slug === 'televisores') && sLap.length <= 8,
  `sugerencias con categoría: "lap" → ${sLap[0]?.texto}, "tv" → televisores`);
await db.exec(`reset role`);
await db.exec(`reset role`);

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
