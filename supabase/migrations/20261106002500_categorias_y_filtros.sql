-- Categorías con filtros propios: laptops, televisores, celulares, refrigeradoras y lavadoras.
--
-- Qué faltaba: la tabla categoria existía, pero ningún producto tenía categoría, y el lateral de /buscar solo tenía
-- tres filtros (disponibles, varias tiendas, tienda). Las "categorías" de la web eran búsquedas de texto.
--
-- Qué cambia:
-- 1) Tres categorías nuevas (laptops, refrigeradoras, lavadoras); televisores y celulares ya existían.
-- 2) producto.atributos (jsonb, índice GIN): los filtros propios de la categoría, cada uno una lista de valores
--    normalizados ({"ram": ["16"], "tecnologia": ["no-frost", "inverter"]}). null = todavía sin clasificar; {} =
--    clasificado y sin categoría o sin datos. Los calcula la ingesta en TypeScript (categoriaDe y atributosDe del
--    paquete dominio, medidos con un conjunto dorado) y los guarda con ingesta.aplicar_clasificacion; la primera
--    corrida después de esta migración clasifica todo el catálogo.
-- 3) public.cumple_filtros(atributos, filtros): varios valores de un atributo se combinan con O, atributos distintos
--    con Y; el valor "no-indicado" elige los productos sin ese dato.
-- 4) public.buscar_catalogo recibe p_categoria, p_filtros, p_precio_min y p_precio_max. Sin texto y con categoría,
--    recorre la categoría. Las facetas suman el rango de precios, la cuenta por categoría (sin categoría elegida) y, con
--    categoría, cuántos productos tiene cada valor de cada atributo con los demás filtros aplicados.
-- 5) public.sugerir_busqueda sugiere también la categoría ("lap" → Laptops).
-- Cambia la firma de buscar_catalogo: se borra y se vuelve a crear con los mismos permisos.

-- 1) Categorías ──────────────────────────────────────────────────────────────────────────────────────────────────────
insert into public.categoria (nombre, slug, padre_id)
select v.nombre, v.slug, (select id from public.categoria where slug = v.padre)
  from (values ('Laptops', 'laptops', 'computacion'), ('Refrigeradoras', 'refrigeradoras', 'linea-blanca'),
               ('Lavadoras', 'lavadoras', 'linea-blanca')) v(nombre, slug, padre)
on conflict (slug) do nothing;

-- 2) Atributos ───────────────────────────────────────────────────────────────────────────────────────────────────────
alter table public.producto add column atributos jsonb;
create index producto_atributos_idx on public.producto using gin (atributos);

-- Guarda categoría y atributos calculados en la ingesta: [{id, categoria (slug o null), atributos}].
create or replace function ingesta.aplicar_clasificacion(p jsonb) returns int
language sql
set search_path = ''
as $$
  with x as (select * from jsonb_to_recordset(p) as x(id uuid, categoria text, atributos jsonb)),
  cambios as (
    update public.producto pr
       set categoria_id = c.id, atributos = coalesce(x.atributos, '{}'::jsonb)
      from x left join public.categoria c on c.slug = x.categoria
     where pr.id = x.id
       and (pr.categoria_id is distinct from c.id or pr.atributos is distinct from coalesce(x.atributos, '{}'::jsonb))
    returning 1)
  select count(*)::int from cambios;
$$;
revoke all on function ingesta.aplicar_clasificacion(jsonb) from public, anon, authenticated;

-- 3) Filtros por atributo ────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.cumple_filtros(a jsonb, f jsonb) returns boolean
language sql immutable parallel safe
set search_path = ''
as $$
  select coalesce(bool_and(
           coalesce(a -> e.key, '[]'::jsonb) ?| array(select jsonb_array_elements_text(e.value))
           or (e.value ? 'no-indicado' and not coalesce(a ? e.key, false))), true)
    from jsonb_each(coalesce(f, '{}'::jsonb)) e
   where jsonb_typeof(e.value) = 'array' and jsonb_array_length(e.value) > 0
$$;

-- 4) Búsqueda con categoría, atributos y precio ───────────────────────────────────────────────────────────────────────
drop function public.buscar_catalogo(text, text, int, int, boolean, boolean, text);

create function public.buscar_catalogo(
  p_q text, p_orden text default 'relevancia', p_pagina int default 1, p_por_pagina int default 24,
  p_solo_disponibles boolean default false, p_solo_varias boolean default false, p_tienda text default null,
  p_categoria text default null, p_filtros jsonb default null, p_precio_min numeric default null, p_precio_max numeric default null)
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
  v_exacta boolean := false;
  v_navega boolean;
  v_cat    bigint;
  v_filtros jsonb := case when jsonb_typeof(p_filtros) = 'object' then p_filtros else '{}'::jsonb end;
  v_penaliza boolean := not public.pide_accesorio(coalesce(p_q, ''));
  v_vacio  constant jsonb := jsonb_build_object('total', 0, 'limitado', false, 'productos', '[]'::jsonb,
             'facetas', jsonb_build_object('total', 0, 'disponibles', 0, 'varias', 0, 'tiendas', '[]'::jsonb,
                                           'categorias', '[]'::jsonb, 'atributos', '{}'::jsonb, 'precio', null));
begin
  p_por_pagina := least(greatest(coalesce(p_por_pagina, 24), 1), 60);
  p_pagina     := least(greatest(coalesce(p_pagina, 1), 1), 500);
  if coalesce(p_categoria, '') <> '' then
    select id into v_cat from public.categoria where slug = p_categoria;
    if v_cat is null then return v_vacio; end if;
  end if;
  select * into v from public.terminos_busqueda(p_q);
  -- Sin texto: solo se puede recorrer una categoría.
  v_navega := v.consulta is null and v.larga is null;
  if v_navega and v_cat is null then return v_vacio; end if;

  if not v_navega then
    v_exacta := v.consulta is not null and exists (
      select 1 from public.producto p
       where p.num_tiendas > 0 and p.busqueda @@ v.consulta
         and (v_cat is null or p.categoria_id = v_cat)
         and (p.titulo_norm || ' ' || coalesce(lower(p.marca), '')) ~ all (v.patrones));
    if not v_exacta and v.larga is null then return v_vacio; end if;
  end if;

  return (
    with candidatos as materialized (
      select x.id, x.r from (
        -- Recorrer la categoría: primero los que están en más tiendas.
        select p.id, p.num_tiendas::real as r
          from public.producto p
         where v_navega and p.categoria_id = v_cat and p.num_tiendas > 0
        union all
        select p.id, ts_rank_cd(p.busqueda, v.consulta)::real
          from public.producto p
         where not v_navega and v_exacta and p.num_tiendas > 0 and p.busqueda @@ v.consulta
           and (v_cat is null or p.categoria_id = v_cat)
           and (p.titulo_norm || ' ' || coalesce(lower(p.marca), '')) ~ all (v.patrones)
        union all
        -- Sin coincidencias exactas: cada palabra de 3 letras o más debe parecerse a alguna palabra del título.
        select p.id, extensions.word_similarity(v_txt, p.titulo_norm)::real
          from public.producto p
         where not v_navega and not v_exacta and p.num_tiendas > 0
           and (v_cat is null or p.categoria_id = v_cat)
           and v.larga operator(extensions.<%) p.titulo_norm
           and (select bool_and(w operator(extensions.<%) p.titulo_norm) from unnest(v.palabras) w where length(w) >= 3)
      ) x
      order by x.r desc, x.id
      limit v_tope + 1
    ),
    base as materialized (
      select p.id, p.titulo, p.marca, p.imagen_url, p.precio_desde, p.num_tiendas, p.es_accesorio, p.categoria_id,
             coalesce(p.atributos, '{}'::jsonb) as atributos, c.r,
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
    -- Los filtros comunes (disponibles, varias tiendas, tienda, precio): los conteos por atributo los respetan.
    comun as materialized (
      select b.* from base b
       where (not p_solo_varias or b.num_tiendas > 1)
         and (not p_solo_disponibles or exists (select 1 from ofertas_base o where o.producto_id = b.id and o.disponible))
         and (coalesce(p_tienda, '') = '' or exists (select 1 from ofertas_base o where o.producto_id = b.id and o.tienda_id = p_tienda))
         and (p_precio_min is null or b.precio_desde >= p_precio_min)
         and (p_precio_max is null or b.precio_desde <= p_precio_max)
    ),
    filtrado as materialized (
      select b.*,
             row_number() over (
               order by
                 case when v_penaliza and b.es_accesorio then 1 else 0 end,
                 case when p_orden = 'precio_asc'  then b.precio_desde end asc nulls last,
                 case when p_orden = 'precio_desc' then b.precio_desde end desc nulls last,
                 b.al_inicio desc, (b.num_tiendas > 1) desc, b.r desc, b.precio_desde, b.id) as n
        from comun b
       where public.cumple_filtros(b.atributos, v_filtros)
    ),
    -- Con categoría: cuántos productos tiene cada valor de cada atributo, aplicando los demás filtros (no el propio).
    claves as (select distinct k from comun b, jsonb_object_keys(b.atributos) k where v_cat is not null),
    conteos as (
      select c.k, coalesce(val.valor, 'no-indicado') as valor, count(*) as n
        from claves c
        join comun b on public.cumple_filtros(b.atributos, v_filtros - c.k)
        left join lateral jsonb_array_elements_text(b.atributos -> c.k) val(valor) on true
       group by 1, 2
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
                                   from (select tienda_id, nombre, count(distinct producto_id) as n from ofertas_base group by 1, 2) x), '[]'::jsonb),
        'precio',      (select jsonb_build_object('min', min(precio_desde), 'max', max(precio_desde)) from base where precio_desde is not null),
        'categorias',  case when v_cat is null then coalesce((
                         select jsonb_agg(jsonb_build_object('slug', c.slug, 'nombre', c.nombre, 'n', x.n) order by x.n desc, c.slug)
                           from (select categoria_id, count(*) as n from base where categoria_id is not null group by 1) x
                           join public.categoria c on c.id = x.categoria_id), '[]'::jsonb) else '[]'::jsonb end,
        'atributos',   coalesce((
                         select jsonb_object_agg(k, valores)
                           from (select k, jsonb_agg(jsonb_build_object('valor', valor, 'n', n) order by n desc, valor) as valores
                                   from conteos group by k) y), '{}'::jsonb))
    )
  );
end $$;

revoke all on function public.cumple_filtros(jsonb, jsonb) from public;
revoke all on function public.buscar_catalogo(text, text, int, int, boolean, boolean, text, text, jsonb, numeric, numeric) from public;
-- Públicas a propósito. buscar_catalogo corre como su dueño (security definer) y filtra lo mismo que la RLS.
grant execute on function public.cumple_filtros(jsonb, jsonb) to anon, authenticated;
grant execute on function public.buscar_catalogo(text, text, int, int, boolean, boolean, text, text, jsonb, numeric, numeric) to anon, authenticated;

-- 5) Sugerencias con categoría ────────────────────────────────────────────────────────────────────────────────────────
-- Palabras que llevan a cada categoría. Una palabra de lo escrito sugiere la categoría si empieza por ella o ella
-- empieza por lo escrito (desde 3 letras; "tv" entera).
create or replace function public.categorias_sugeridas(p_q text) returns jsonb
language sql stable
set search_path = ''
as $$
  with escrito as (select btrim(public.normalizar_texto(left(coalesce(p_q, ''), 80))) as t),
  palabras(slug, ws) as (values
    ('laptops',        array['laptop', 'laptops', 'notebook', 'portatil', 'computadora portatil']),
    ('televisores',    array['televisor', 'televisores', 'tv', 'smart tv', 'television']),
    ('celulares',      array['celular', 'celulares', 'smartphone', 'iphone']),
    ('refrigeradoras', array['refrigeradora', 'refrigerador', 'refrigeradoras', 'nevera', 'refri', 'minibar']),
    ('lavadoras',      array['lavadora', 'lavadoras', 'lavasecadora']))
  select coalesce(jsonb_agg(jsonb_build_object('tipo', 'categoria', 'texto', c.nombre, 'slug', c.slug) order by c.nombre), '[]'::jsonb)
    from palabras p join public.categoria c on c.slug = p.slug, escrito e
   where exists (select 1 from unnest(p.ws) w
                  where e.t = w or (length(e.t) >= 3 and (w like e.t || '%' or e.t like w || ' %')))
$$;
grant execute on function public.categorias_sugeridas(text) to anon, authenticated;

create or replace function public.sugerir_busqueda(p_q text) returns jsonb
language plpgsql stable
security definer
set search_path = ''
set plan_cache_mode = 'force_custom_plan'
as $$
declare
  v_txt text := btrim(public.normalizar_texto(left(coalesce(p_q, ''), 80)));
  v     record;
  v_marcas jsonb;
  v_productos jsonb := '[]'::jsonb;
begin
  if length(v_txt) < 2 then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('tipo', 'marca', 'texto', m.marca) order by m.n desc, m.marca), '[]'::jsonb)
    into v_marcas
    from (select mode() within group (order by p.marca) as marca, count(*) as n
            from public.producto p
           where p.num_tiendas > 0 and p.marca is not null
             and public.normalizar_texto(p.marca) like replace(replace(replace(v_txt, '\', '\\'), '%', '\%'), '_', '\_') || '%'
           group by public.normalizar_texto(p.marca)
           order by count(*) desc
           limit 3) m;

  if length(v_txt) >= 3 then
    select * into v from public.terminos_busqueda(p_q);
    if v.consulta is not null then
      select coalesce(jsonb_agg(jsonb_build_object('tipo', 'producto', 'texto', x.titulo, 'id', x.id, 'precio_desde', x.precio_desde)
                                order by x.al_inicio desc, x.varias desc, x.r desc, x.id), '[]'::jsonb)
        into v_productos
        from (select c.id, c.titulo, c.precio_desde, c.num_tiendas > 1 as varias, ts_rank_cd(c.busqueda, v.consulta) as r,
                     c.titulo_norm ~ v.inicio as al_inicio
                from (select p.id, p.titulo, p.precio_desde, p.num_tiendas, p.busqueda, p.titulo_norm
                        from public.producto p
                       where p.num_tiendas > 0 and p.busqueda @@ v.consulta
                         and (p.titulo_norm || ' ' || coalesce(lower(p.marca), '')) ~ all (v.patrones)
                         and (not p.es_accesorio or public.pide_accesorio(p_q))
                       limit 400) c
               order by al_inicio desc, c.num_tiendas > 1 desc, r desc, c.id
               limit 5) x;
    end if;
  end if;
  -- Primero la categoría, luego marcas y productos; ocho como máximo.
  return (select coalesce(jsonb_agg(x.e order by x.i), '[]'::jsonb)
            from jsonb_array_elements(public.categorias_sugeridas(p_q) || v_marcas || v_productos) with ordinality x(e, i)
           where x.i <= 8);
end $$;
