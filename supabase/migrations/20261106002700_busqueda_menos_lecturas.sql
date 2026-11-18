-- Búsqueda con menos lecturas de disco: tope de 1.000 candidatos e índice de ofertas que cubre las facetas.
--
-- Qué fallaba (17 de noviembre de 2026, producción): con el cupo de disco del plan gratuito agotado, cada lectura costaba
-- 10–15 ms. Una búsqueda nueva leía cientos de páginas ("cocinax": 231 bloques, 2,6 s; repetida, 0 bloques y 133 ms) y
-- 8 búsquedas a la vez pasaban del límite de 3 s. Cada búsqueda unía hasta 2.000 candidatos con producto y con sus
-- ofertas: una página de tabla por candidato, más las de oferta.
--
-- Qué cambia:
-- 1) Índice oferta_producto_cubre_idx (producto_id) include (tienda_id, disponible), solo ofertas activas: las facetas
--    (disponibles, por tienda) y los filtros de disponibles y tienda se leen del índice, sin visitar la tabla oferta.
-- 2) buscar_catalogo se queda con los 1.000 mejores candidatos (antes 2.000): la mitad de páginas en las búsquedas con
--    muchos resultados ("celular", "mouse"). La web dice "más de 1.000" cuando corresponde. Misma firma y permisos.
--
-- pg_trgm se carga antes de crear la función: su "set pg_trgm.word_similarity_threshold" solo se acepta si la extensión
-- ya está cargada en la sesión. Si no, Supabase lo trata como un parámetro desconocido y responde "permission denied to
-- set parameter" (las migraciones 2300 y 2500 lo cargaban sin querer al crear índices de trigramas antes).
select extensions.similarity('a', 'a');

create index if not exists oferta_producto_cubre_idx
  on public.oferta (producto_id) include (tienda_id, disponible)
  where activa;

create or replace function public.buscar_catalogo(
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
  v_tope   constant int := 1000;
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
