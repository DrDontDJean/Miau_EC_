-- Búsqueda paginada, con filtros en la base y el total de resultados.
--
-- Qué fallaba: buscar_productos devolvía como mucho 24 productos y no decía cuántos había en total: una búsqueda
-- como "laptop" mostraba los 24 primeros y nada más, sin forma de ver el resto. Y los filtros de la web (disponibles,
-- varias tiendas, por tienda) se aplicaban en el navegador solo sobre esos 24, así que no cambiaban lo que se podía
-- encontrar.
--
-- Qué cambia:
-- 1) public.candidatos_busqueda(q) es la búsqueda de la migración 0400 (texto completo en español sin acentos y, si no
--    hay coincidencias, similitud de trigramas) como función reutilizable: devuelve el id y el rango de cada producto.
-- 2) public.buscar_productos es la de la migración 1700 con tres filtros nuevos (solo disponibles, solo en varias
--    tiendas, de una tienda), un desplazamiento que ahora se usa (p_desde) y una columna nueva: total, la cantidad de
--    resultados que cumplen los filtros, sin contar el límite. El orden desempata por id: sin eso, dos productos con el
--    mismo precio podían aparecer en dos páginas o en ninguna. Los accesorios siguen yendo después (migración 1700).
-- 3) public.facetas_busqueda(q) cuenta, para el texto buscado, cuántos productos hay en total, cuántos están
--    disponibles, cuántos en varias tiendas y cuántos por tienda: lo que muestra el lateral de filtros.
-- Cambia el tipo de lo que devuelve buscar_productos, así que no sirve create or replace: se borra y se vuelve a crear
-- con los mismos permisos que le daba la migración 0400.

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
begin
  return query
  select p.id, ts_rank_cd(p.busqueda, v_q)::real
    from public.producto p
   where p.num_tiendas > 0 and p.busqueda @@ v_q
  union all
  -- Sin coincidencias exactas: cada palabra buscada debe parecerse a alguna palabra del título.
  select p.id, extensions.word_similarity(v_txt, public.normalizar_texto(p.titulo))::real
    from public.producto p
   where p.num_tiendas > 0
     and not exists (select 1 from public.producto x where x.num_tiendas > 0 and x.busqueda @@ v_q)
     and v_larga operator(extensions.<%) public.normalizar_texto(p.titulo)   -- usa el índice GIN de trigramas
     and (select bool_and(w operator(extensions.<%) public.normalizar_texto(p.titulo))
            from unnest(string_to_array(v_txt, ' ')) w where length(w) >= 3);
end $$;

drop function public.buscar_productos(text, text, int, int);

create function public.buscar_productos(
  p_q text, p_orden text default 'relevancia', p_limite int default 24, p_desde int default 0,
  p_solo_disponibles boolean default false, p_solo_varias boolean default false, p_tienda text default null)
returns table (
  id uuid, titulo text, marca text, imagen_url text, precio_desde numeric, num_tiendas smallint,
  rango real, ofertas jsonb, total bigint)
language plpgsql stable
set search_path = ''
as $$
declare
  v_txt text := public.normalizar_texto(left(p_q, 80));
  -- Los accesorios solo van después si quien busca no pidió uno ("soporte tv" sí los quiere primero).
  v_penaliza boolean := v_txt !~ ('\m' || public.patron_accesorio() || '\M');
begin
  p_limite := least(greatest(p_limite, 1), 60);
  p_desde  := least(greatest(p_desde, 0), 10000);
  return query
  with f as (
    select p.id, p.titulo, p.marca, p.imagen_url, p.precio_desde, p.num_tiendas, c.r,
           row_number() over (
             order by
               case when v_penaliza and p.es_accesorio then 1 else 0 end,
               case when p_orden = 'precio_asc'  then p.precio_desde end asc nulls last,
               case when p_orden = 'precio_desc' then p.precio_desde end desc nulls last,
               (p.num_tiendas > 1) desc, c.r desc, p.precio_desde, p.id) as n,
           count(*) over () as total
      from public.candidatos_busqueda(p_q) c
      join public.producto p on p.id = c.id
     where (not p_solo_varias or p.num_tiendas > 1)
       and (not p_solo_disponibles or exists (
              select 1 from public.oferta o join public.tienda t on t.id = o.tienda_id and t.estado = 'activa'
               where o.producto_id = p.id and o.activa and o.disponible))
       and (coalesce(p_tienda, '') = '' or exists (
              select 1 from public.oferta o join public.tienda t on t.id = o.tienda_id and t.estado = 'activa'
               where o.producto_id = p.id and o.activa and o.tienda_id = p_tienda))
  )
  select f.id, f.titulo, f.marca, f.imagen_url, f.precio_desde, f.num_tiendas, f.r,
         (select jsonb_agg(jsonb_build_object(
                   'id', o.id, 'tienda_id', o.tienda_id, 'tienda', t.nombre, 'titulo', o.titulo,
                   'precio', o.precio, 'precio_lista', o.precio_lista, 'disponible', o.disponible,
                   'visto_ultima_vez', o.visto_ultima_vez)
                 order by o.disponible desc, o.precio)
            from public.oferta o join public.tienda t on t.id = o.tienda_id
           where o.producto_id = f.id and o.activa and t.estado = 'activa'),
         f.total
    from f
   where f.n > p_desde and f.n <= p_desde + p_limite
   order by f.n;
end $$;

create function public.facetas_busqueda(p_q text) returns jsonb
language sql stable
set search_path = ''
as $$
  with c as (select cb.id from public.candidatos_busqueda(p_q) cb),
       o as (select o.producto_id, o.tienda_id, t.nombre, o.disponible
               from public.oferta o
               join public.tienda t on t.id = o.tienda_id and t.estado = 'activa'
               join c on c.id = o.producto_id
              where o.activa)
  select jsonb_build_object(
    'total',       (select count(*) from c),
    'disponibles', (select count(distinct producto_id) from o where disponible),
    'varias',      (select count(*) from c join public.producto p on p.id = c.id where p.num_tiendas > 1),
    'tiendas',     coalesce((select jsonb_agg(jsonb_build_object('id', x.tienda_id, 'nombre', x.nombre, 'n', x.n) order by x.nombre)
                               from (select tienda_id, nombre, count(distinct producto_id) as n from o group by 1, 2) x), '[]'::jsonb));
$$;

revoke all on function public.candidatos_busqueda(text) from public;
revoke all on function public.buscar_productos(text, text, int, int, boolean, boolean, text) from public;
revoke all on function public.facetas_busqueda(text) from public;
-- Las tres son de lectura y públicas a propósito. candidatos_busqueda también: buscar_productos y facetas_busqueda se
-- ejecutan con los permisos de quien llama (y su RLS), así que ese rol necesita poder llamarla.
grant execute on function public.candidatos_busqueda(text) to anon, authenticated;
grant execute on function public.buscar_productos(text, text, int, int, boolean, boolean, text) to anon, authenticated;
grant execute on function public.facetas_busqueda(text) to anon, authenticated;
