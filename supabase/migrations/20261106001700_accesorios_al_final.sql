-- Los accesorios no tapan al producto buscado ("televisor 55" devolvía soportes y cables).
--
-- Qué fallaba: la búsqueda por texto encuentra un soporte para TV al buscar "televisor 55", y con ordenar por precio
-- los accesorios, que cuestan mucho menos, encabezaban la lista.
--
-- Qué cambia:
-- 1) public.patron_accesorio() es la lista de palabras con las que empieza el título de un accesorio de electrónica o
--    de electrodomésticos (soporte, cable, funda, cargador, repuesto...). public.es_accesorio(titulo) es verdadera si el
--    título empieza con una de ellas, o dice "para" seguido de un aparato ("bolsas para lavadora", "tinta para
--    impresora"). La lista es corta a propósito: medida con 115.000 productos reales, una lista amplia marcaba como
--    accesorio cosas que no lo son (protectores diarios, bolsas Ziploc, la caja de un PC, la correa de un perro).
-- 2) producto.es_accesorio es una columna calculada con esa función.
-- 3) buscar_productos es la de la migración 0400 con un cambio: pone los accesorios después de los demás, en cualquier
--    orden, salvo que el texto buscado contenga una de esas palabras. Los accesorios no se ocultan.
-- create or replace conserva los permisos de las funciones.

create or replace function public.patron_accesorio() returns text
language sql immutable parallel safe set search_path = ''
as $$ select '(soporte|soportes|control remoto|mando|cable|cables|adaptador|adaptadores|funda|fundas|cargador|cargadores|repuesto|repuestos|mica|vidrio templado|pedestal)' $$;

create or replace function public.es_accesorio(t text) returns boolean
language sql immutable parallel safe strict set search_path = ''
as $$
  select public.normalizar_texto(t) ~ ('^(set de [0-9]+ |juego de )?' || public.patron_accesorio() || ' ')
      or public.normalizar_texto(t) ~ ' para (el |la |los |las |un |una )?(tv|televisor|televisores|celular|celulares|smartphone|laptop|laptops|notebook|computadora|lavadora|lavadoras|secadora|refrigerador|refrigeradora|nevera|microondas|licuadora|impresora|tablet|iphone|monitor|consola)( |$)'
$$;

alter table public.producto add column es_accesorio boolean generated always as (public.es_accesorio(titulo)) stored;

create or replace function public.buscar_productos(
  p_q text, p_orden text default 'relevancia', p_limite int default 24, p_desde int default 0)
returns table (
  id uuid, titulo text, marca text, imagen_url text, precio_desde numeric, num_tiendas smallint,
  rango real, ofertas jsonb)
language plpgsql stable
set search_path = ''
set pg_trgm.word_similarity_threshold = 0.5
as $$
declare
  v_q   tsquery := websearch_to_tsquery('public.es_sin_acentos', left(p_q, 80));
  v_txt text    := public.normalizar_texto(left(p_q, 80));
  v_larga text  := (select w from unnest(string_to_array(v_txt, ' ')) w order by length(w) desc limit 1);
  -- Los accesorios solo van después si quien busca no pidió uno ("soporte tv" sí los quiere primero).
  v_penaliza boolean := v_txt !~ ('\m' || public.patron_accesorio() || '\M');
begin
  p_limite := least(greatest(p_limite, 1), 60);
  return query
  with candidatos as (
    select p.*, ts_rank_cd(p.busqueda, v_q)::real as r
      from public.producto p
     where p.num_tiendas > 0 and p.busqueda @@ v_q
    union all
    -- Sin coincidencias exactas: cada palabra buscada debe parecerse a alguna palabra del título.
    select p.*, extensions.word_similarity(v_txt, public.normalizar_texto(p.titulo))::real
      from public.producto p
     where p.num_tiendas > 0
       and not exists (select 1 from public.producto x where x.num_tiendas > 0 and x.busqueda @@ v_q)
       and v_larga operator(extensions.<%) public.normalizar_texto(p.titulo)   -- usa el índice GIN de trigramas
       and (select bool_and(w operator(extensions.<%) public.normalizar_texto(p.titulo))
              from unnest(string_to_array(v_txt, ' ')) w where length(w) >= 3)
  )
  select c.id, c.titulo, c.marca, c.imagen_url, c.precio_desde, c.num_tiendas, c.r,
         (select jsonb_agg(jsonb_build_object(
                   'id', o.id, 'tienda_id', o.tienda_id, 'tienda', t.nombre, 'titulo', o.titulo,
                   'precio', o.precio, 'precio_lista', o.precio_lista, 'disponible', o.disponible,
                   'visto_ultima_vez', o.visto_ultima_vez)
                 order by o.disponible desc, o.precio)
            from public.oferta o join public.tienda t on t.id = o.tienda_id
           where o.producto_id = c.id and o.activa and t.estado = 'activa')
    from candidatos c
   order by
     case when v_penaliza and c.es_accesorio then 1 else 0 end,
     case when p_orden = 'precio_asc'  then c.precio_desde end asc nulls last,
     case when p_orden = 'precio_desc' then c.precio_desde end desc nulls last,
     (c.num_tiendas > 1) desc, c.r desc, c.precio_desde
   limit p_limite offset greatest(p_desde, 0);
end $$;
