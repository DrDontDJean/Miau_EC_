-- Búsqueda estable y relevante: una sola consulta por página, dentro del límite de tiempo, con sinónimos y sin raíces
-- engañosas.
--
-- Qué fallaba (medido el 17 de noviembre de 2026 en producción):
-- * Tiempo: Supabase corta a los 3 s toda consulta del rol público. "laptop" y "televisor" daban HTTP 500 en frío, y
--   las búsquedas mal escritas o sin resultados tardaban 2,5–3 s. Cada página ejecutaba la búsqueda dos veces
--   (facetas_busqueda y buscar_productos); el camino de trigramas recalculaba normalizar_texto(titulo) (unaccent) por
--   fila; y buscar_productos contaba y numeraba todos los candidatos antes de cortar a 24.
-- * Relevancia: el analizador de español reduce "celular" a la raíz "celul", la misma de celulosa y células, y la raíz
--   de "celulares" es otra; "nevera" no encontraba refrigeradoras.
--
-- * Causa principal del tiempo: con RLS, Postgres no puede usar en un índice un operador que no es "leakproof" (ni
--   @@ de texto completo ni <% de trigramas lo son), así que para el rol público cada búsqueda recorría la tabla
--   producto entera. Medido en PGlite con 120.000 productos: "cafeteraa" como anon, 806 ms con Seq Scan; con el
--   índice, 31 ms.
--
-- Qué cambia:
-- 0) Las funciones de búsqueda corren con los permisos de su dueño (security definer), como registrar_salida, y
--    aplican ellas mismas lo que pide la RLS: productos con al menos una tienda, ofertas activas y tiendas activas.
--    Así usan los índices. search_path vacío, como todas.
-- 1) producto.titulo_norm: el título normalizado (minúsculas, sin acentos) guardado, con su índice de trigramas. El
--    índice de expresión anterior sobra y se borra; candidatos_busqueda (que siguen usando buscar_productos y
--    facetas_busqueda) pasa a usar la columna.
-- 2) public.singular(palabra) y public.sinonimos(palabra): plural a singular por reglas simples del español y los
--    sinónimos del catálogo (nevera, refri → refrigeradora; tv, tele → televisor; notebook, portátil → laptop;
--    smartphone, teléfono → celular). Nevera, tele, portátil y teléfono son de un solo sentido: "laptop" no trae
--    parlantes portátiles ni "celular" teléfonos fijos.
-- 3) public.terminos_busqueda(q): por cada palabra, una tsquery (la palabra, sus sinónimos y, desde 4 letras, su
--    prefijo) y un patrón que el título debe cumplir: alguna palabra del título empieza por la palabra buscada o un
--    sinónimo. El patrón es lo que deja fuera a celulosa: comparte raíz con celular, pero no empieza por "celular".
-- 4) public.buscar_catalogo(...) devuelve en un solo jsonb los productos de la página, el total y los conteos del
--    lateral (facetas). Decide una sola vez si hay coincidencias exactas; si no, va por trigramas sobre titulo_norm.
--    Ordena por rango y se queda con los 2.000 mejores antes de filtrar, contar y paginar ("limitado" lo indica). En
--    relevancia van primero los títulos que nombran lo buscado entre sus tres primeras palabras.
-- 5) Accesorios: la lista de la migración 1700 se amplía (protector de voltaje o de pantalla, control de televisor,
--    carcasa, estuche, limpiador de pantallas, la abreviatura "p/" por "para", y más aparatos tras "para": impresoras,
--    zapatos, consolas, ipad...). Mochila, maletín, bolso y rack solo cuentan si el título nombra un aparato o una medida
--    en pulgadas: una mochila escolar no es un accesorio. Medido con 2.561 títulos reales de la web (17 de noviembre):
--    los marcados pasan del 3,1 % al 8,4 %, y los 137 nuevos se revisaron a mano (todos son accesorios). Se descartaron
--    "desodorante para" (marcaba desodorantes para hombre y para pies) y "mochila" sin condición (mochilas escolares).
--
-- Al aplicarla se reescribe la tabla producto (dos columnas guardadas): conviene que no coincida con la ingesta.

-- 5) Accesorios (van primero: la reescritura de la tabla usa la función nueva) ────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.patron_accesorio() returns text
language sql immutable parallel safe set search_path = ''
as $$ select '(soporte|soportes|control remoto|control universal|control de (tv|televisor|televisores)|control para|mando|cable|cables|adaptador|adaptadores|funda|fundas|cargador|cargadores|repuesto|repuestos|mica|micas|vidrio templado|pedestal|protector(es)? (de )?(voltaje|pantalla|tension|sobretension)|protector(es)? para|carcasa|carcasas|case para|estuche|estuches|limpiador de (pantalla|pantallas))' $$;

-- Aparatos: tras "para" (o "p/") el título es de un accesorio; con mochila, maletín, bolso o rack, también.
create or replace function public.patron_aparato() returns text
language sql immutable parallel safe set search_path = ''
as $$ select '(tv|televisor|televisores|celular|celulares|smartphone|laptop|laptops|notebook|computadora|computador|pc|lavadora|lavadoras|secadora|refrigerador|refrigeradores|refrigeradora|refrigeradoras|nevera|microondas|licuadora|impresora|impresoras|tablet|tablets|ipad|iphone|macbook|monitor|consola|ps4|ps5|xbox|nintendo|zapato|zapatos|zapatilla|zapatillas|calzado)' $$;

create or replace function public.es_accesorio(t text) returns boolean
language sql immutable parallel safe strict set search_path = ''
as $$
  select n ~ ('^(set de [0-9]+ |juego de )?' || public.patron_accesorio() || ' ')
      or n ~ (' (para|p/) ?(el |la |los |las |un |una )?' || public.patron_aparato() || '( |$|,|\.)')
      or (n ~ '^(mochila|mochilas|maletin|maletines|rack|racks|bolso|bolsa) '
          and (n ~ ('\y' || public.patron_aparato() || '\y') or n ~ '[0-9]+([.,][0-9]+)? ?("|″|pulg|plg)'))
    from (select public.normalizar_texto(t) as n) x
$$;

-- ¿Pidió un accesorio quien busca? Entonces los accesorios no van al final ("soporte tv", "mochila laptop").
create or replace function public.pide_accesorio(p_q text) returns boolean
language sql immutable parallel safe strict set search_path = ''
as $$ select public.normalizar_texto(p_q) ~ ('\m(' || public.patron_accesorio() || '|mochila|mochilas|maletin|maletines|rack|racks|bolso|bolsa)\M') $$;

-- 1) Título normalizado guardado (y es_accesorio recalculado), en una sola reescritura de la tabla ────────────────
alter table public.producto
  drop column es_accesorio,
  add column es_accesorio boolean generated always as (public.es_accesorio(titulo)) stored,
  add column titulo_norm text generated always as (public.normalizar_texto(titulo)) stored;
create index producto_titulo_norm_trgm_idx on public.producto using gin (titulo_norm extensions.gin_trgm_ops);

create or replace function public.candidatos_busqueda(p_q text)
returns table (id uuid, r real)
language plpgsql stable
set search_path = ''
set pg_trgm.word_similarity_threshold = 0.5
as $$
declare
  v_q   tsquery := websearch_to_tsquery('public.es_sin_acentos', left(p_q, 80));
  v_txt text    := public.normalizar_texto(left(p_q, 80));
  v_larga text  := (select w from unnest(string_to_array(v_txt, ' ')) w order by length(w) desc limit 1);
  v_hay boolean := exists (select 1 from public.producto x where x.num_tiendas > 0 and x.busqueda @@ v_q);
begin
  return query
  select p.id, ts_rank_cd(p.busqueda, v_q)::real
    from public.producto p
   where v_hay and p.num_tiendas > 0 and p.busqueda @@ v_q
  union all
  select p.id, extensions.word_similarity(v_txt, p.titulo_norm)::real
    from public.producto p
   where not v_hay and p.num_tiendas > 0
     and v_larga operator(extensions.<%) p.titulo_norm
     and (select bool_and(w operator(extensions.<%) p.titulo_norm)
            from unnest(string_to_array(v_txt, ' ')) w where length(w) >= 3);
end $$;

drop index if exists public.producto_titulo_trgm_idx;

-- 2) Singular y sinónimos ──────────────────────────────────────────────────────────────────────────────────────────
-- Recibe una palabra ya normalizada. Las reglas pueden quitar de más ("iphones" → "iphon"): no importa, porque el
-- patrón es de prefijo y "iphon" sigue encontrando "iphone".
create or replace function public.singular(w text) returns text
language sql immutable parallel safe strict set search_path = ''
as $$
  select case
    when length(w) <= 4 or w !~ '^[a-z]+$' then w
    when w ~ '[lrndj]es$' then left(w, -2)          -- celulares, televisores, colchones
    when w ~ 'ces$'       then left(w, -3) || 'z'   -- luces
    when w ~ '[^s]s$'     then left(w, -1)          -- lavadoras, zapatos, laptops
    else w
  end
$$;

-- Sinónimos del catálogo, en singular y normalizados. Cada grupo tiene términos de ida y vuelta (fuertes: buscar uno
-- encuentra los demás) y términos de un solo sentido (débiles: llevan al grupo, pero el grupo no los busca). Así
-- "portátil" encuentra laptops, pero "laptop" no trae parlantes portátiles; "nevera" encuentra refrigeradoras, pero
-- "refrigeradora" no trae neveras de playa; "teléfono" encuentra celulares, pero "celular" no trae teléfonos fijos.
-- Devuelve la palabra primero y luego los fuertes de su grupo, o solo la palabra.
create or replace function public.sinonimos(w text) returns text[]
language sql immutable parallel safe strict set search_path = ''
as $$
  with grupos(fuertes, debiles) as (values
    (array['refrigeradora', 'refrigerador'], array['nevera', 'refri', 'frigorifico']),
    (array['televisor', 'tv', 'television'], array['tele']),
    (array['laptop', 'notebook'],            array['portatil']),
    (array['celular', 'smartphone'],         array['telefono']))
  select coalesce(
    (select array[w] || array(select x from unnest(fuertes) x where x <> w)
       from grupos where w = any(fuertes) or w = any(debiles) limit 1),
    array[w])
$$;

-- 3) Términos de la búsqueda ───────────────────────────────────────────────────────────────────────────────────────
-- consulta: Y de cada palabra; cada palabra es O de ella, sus sinónimos y su prefijo. patrones: uno por palabra, que el
-- texto del producto debe cumplir (todas). larga: la palabra más larga, para el camino de trigramas. Las palabras vacías
-- ("de", "para") no cuentan. Si no queda ninguna palabra, consulta es null. inicio: la primera palabra buscada entre
-- las tres primeras del título; sirve para ordenar ("Laptop HP…" antes que "Memoria RAM … laptop").
create or replace function public.terminos_busqueda(p_q text, out consulta tsquery, out patrones text[], out larga text, out palabras text[], out inicio text)
language plpgsql stable set search_path = ''
as $$
declare
  w text; s text; a text; t tsquery; tq tsquery; alts text[]; r text[];
begin
  palabras := array(select x from unnest(regexp_split_to_array(public.normalizar_texto(left(coalesce(p_q, ''), 80)), '[^a-z0-9]+')) x where x <> '');
  patrones := '{}';
  foreach w in array palabras loop
    continue when numnode(plainto_tsquery('public.es_sin_acentos', w)) = 0;   -- palabra vacía
    s := public.singular(w);
    alts := public.sinonimos(s);
    t := null; r := '{}';
    foreach a in array alts loop
      tq := plainto_tsquery('public.es_sin_acentos', a);
      continue when numnode(tq) = 0;
      if a = s and length(s) >= 4 then tq := tq || to_tsquery('public.es_sin_acentos', s || ':*'); end if;
      t := case when t is null then tq else t || tq end;
      -- La palabra buscada vale como prefijo ("celular" → celulares). Un sinónimo corto, solo entero ("tele" ≠ teléfono).
      r := r || case when a <> s and length(a) < 5 then '\m' || a || '\M' else '\m' || a end;
      -- Sin su vocal final, como palabra entera: "refrigeradora" también encuentra "refrigerador".
      if length(a) > 5 and a ~ '[aeo]$' then r := r || ('\m' || left(a, -1) || '\M'); end if;
    end loop;
    continue when t is null;
    consulta := case when consulta is null then t else consulta && t end;
    patrones := patrones || ('(' || array_to_string(r, '|') || ')');
    inicio := coalesce(inicio, '^([^ ]+ ){0,2}(' || array_to_string(r, '|') || ')');
  end loop;
  larga := (select x from unnest(palabras) x where length(x) >= 3 order by length(x) desc limit 1);
end $$;

-- 4) Búsqueda en una sola consulta ─────────────────────────────────────────────────────────────────────────────────
create or replace function public.buscar_catalogo(
  p_q text, p_orden text default 'relevancia', p_pagina int default 1, p_por_pagina int default 24,
  p_solo_disponibles boolean default false, p_solo_varias boolean default false, p_tienda text default null)
returns jsonb
language plpgsql stable
security definer
set search_path = ''
set plan_cache_mode = 'force_custom_plan'
set pg_trgm.word_similarity_threshold = 0.5
as $$
declare
  v        record;
  v_txt    text := public.normalizar_texto(left(coalesce(p_q, ''), 80));
  v_tope   constant int := 2000;
  v_exacta boolean;
  -- Los accesorios solo van después si quien busca no pidió uno ("soporte tv" sí los quiere primero).
  v_penaliza boolean := not public.pide_accesorio(coalesce(p_q, ''));
  v_vacio  constant jsonb := jsonb_build_object('total', 0, 'limitado', false, 'productos', '[]'::jsonb,
             'facetas', jsonb_build_object('total', 0, 'disponibles', 0, 'varias', 0, 'tiendas', '[]'::jsonb));
begin
  p_por_pagina := least(greatest(coalesce(p_por_pagina, 24), 1), 60);
  p_pagina     := least(greatest(coalesce(p_pagina, 1), 1), 500);
  select * into v from public.terminos_busqueda(p_q);
  if v.consulta is null and v.larga is null then return v_vacio; end if;

  v_exacta := v.consulta is not null and exists (
    select 1 from public.producto p
     where p.num_tiendas > 0 and p.busqueda @@ v.consulta
       and (p.titulo_norm || ' ' || coalesce(lower(p.marca), '')) ~ all (v.patrones));
  if not v_exacta and v.larga is null then return v_vacio; end if;

  return (
    with candidatos as materialized (
      select x.id, x.r from (
        select p.id, ts_rank_cd(p.busqueda, v.consulta)::real as r
          from public.producto p
         where v_exacta and p.num_tiendas > 0 and p.busqueda @@ v.consulta
           and (p.titulo_norm || ' ' || coalesce(lower(p.marca), '')) ~ all (v.patrones)
        union all
        -- Sin coincidencias exactas: cada palabra de 3 letras o más debe parecerse a alguna palabra del título.
        select p.id, extensions.word_similarity(v_txt, p.titulo_norm)::real
          from public.producto p
         where not v_exacta and p.num_tiendas > 0
           and v.larga operator(extensions.<%) p.titulo_norm
           and (select bool_and(w operator(extensions.<%) p.titulo_norm) from unnest(v.palabras) w where length(w) >= 3)
      ) x
      order by x.r desc, x.id
      limit v_tope + 1
    ),
    base as materialized (
      select p.id, p.titulo, p.marca, p.imagen_url, p.precio_desde, p.num_tiendas, p.es_accesorio, c.r,
             coalesce(v_exacta and p.titulo_norm ~ v.inicio, false) as al_inicio
        from (select * from candidatos order by r desc, id limit v_tope) c
        join public.producto p on p.id = c.id
    ),
    ofertas_base as materialized (
      select o.producto_id, o.tienda_id, t.nombre, o.disponible
        from public.oferta o
        join public.tienda t on t.id = o.tienda_id and t.estado = 'activa'
       where o.activa and o.producto_id in (select id from base)
    ),
    filtrado as materialized (
      select b.*,
             row_number() over (
               order by
                 case when v_penaliza and b.es_accesorio then 1 else 0 end,
                 case when p_orden = 'precio_asc'  then b.precio_desde end asc nulls last,
                 case when p_orden = 'precio_desc' then b.precio_desde end desc nulls last,
                 b.al_inicio desc, (b.num_tiendas > 1) desc, b.r desc, b.precio_desde, b.id) as n
        from base b
       where (not p_solo_varias or b.num_tiendas > 1)
         and (not p_solo_disponibles or exists (select 1 from ofertas_base o where o.producto_id = b.id and o.disponible))
         and (coalesce(p_tienda, '') = '' or exists (select 1 from ofertas_base o where o.producto_id = b.id and o.tienda_id = p_tienda))
    )
    select jsonb_build_object(
      'total',    (select count(*) from filtrado),
      'limitado', (select count(*) from candidatos) > v_tope,
      'productos', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', f.id, 'titulo', f.titulo, 'marca', f.marca, 'imagen_url', f.imagen_url,
                 'precio_desde', f.precio_desde, 'num_tiendas', f.num_tiendas,
                 'ofertas', (select jsonb_agg(jsonb_build_object(
                                     'id', o.id, 'tienda_id', o.tienda_id, 'tienda', t.nombre, 'titulo', o.titulo,
                                     'precio', o.precio, 'precio_lista', o.precio_lista, 'disponible', o.disponible,
                                     'visto_ultima_vez', o.visto_ultima_vez)
                                   order by o.disponible desc, o.precio)
                               from public.oferta o join public.tienda t on t.id = o.tienda_id
                              where o.producto_id = f.id and o.activa and t.estado = 'activa'))
               order by f.n)
          from filtrado f
         where f.n > (p_pagina - 1) * p_por_pagina and f.n <= p_pagina * p_por_pagina), '[]'::jsonb),
      'facetas', jsonb_build_object(
        'total',       (select count(*) from base),
        'disponibles', (select count(distinct producto_id) from ofertas_base where disponible),
        'varias',      (select count(*) from base where num_tiendas > 1),
        'tiendas',     coalesce((select jsonb_agg(jsonb_build_object('id', x.tienda_id, 'nombre', x.nombre, 'n', x.n) order by x.nombre)
                                   from (select tienda_id, nombre, count(distinct producto_id) as n from ofertas_base group by 1, 2) x), '[]'::jsonb))
    )
  );
end $$;

revoke all on function public.singular(text) from public;
revoke all on function public.sinonimos(text) from public;
revoke all on function public.terminos_busqueda(text) from public;
revoke all on function public.buscar_catalogo(text, text, int, int, boolean, boolean, text) from public;
-- Públicas a propósito. buscar_catalogo corre como su dueño (security definer) y filtra lo mismo que la RLS.
grant execute on function public.singular(text) to anon, authenticated;
grant execute on function public.sinonimos(text) to anon, authenticated;
grant execute on function public.terminos_busqueda(text) to anon, authenticated;
grant execute on function public.buscar_catalogo(text, text, int, int, boolean, boolean, text) to anon, authenticated;
revoke all on function public.patron_aparato() from public;
revoke all on function public.pide_accesorio(text) from public;
grant execute on function public.patron_aparato() to anon, authenticated;
grant execute on function public.pide_accesorio(text) to anon, authenticated;

-- Las funciones anteriores (siguen en uso hasta que la web nueva esté desplegada) también usan los índices.
alter function public.candidatos_busqueda(text) security definer;
alter function public.buscar_productos(text, text, int, int, boolean, boolean, text) security definer;
alter function public.facetas_busqueda(text) security definer;
