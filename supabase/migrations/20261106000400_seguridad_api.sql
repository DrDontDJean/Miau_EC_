-- Seguridad: la web pública solo lee y registra salidas por RPC.
-- El worker de ingesta usa la cadena de conexión de Postgres (rol postgres), nunca la clave pública.

alter table public.tienda           enable row level security;
alter table public.categoria        enable row level security;
alter table public.producto         enable row level security;
alter table public.oferta           enable row level security;
alter table public.precio_historial enable row level security;
alter table public.salida           enable row level security;

create policy tienda_lectura    on public.tienda           for select to anon, authenticated using (estado = 'activa');
create policy categoria_lectura on public.categoria        for select to anon, authenticated using (true);
create policy producto_lectura  on public.producto         for select to anon, authenticated using (num_tiendas > 0);
create policy oferta_lectura    on public.oferta           for select to anon, authenticated using (activa);
create policy historial_lectura on public.precio_historial for select to anon, authenticated using (true);
-- salida: sin políticas. Nadie la lee ni escribe directamente; solo public.registrar_salida().

revoke all on schema ingesta, calidad, analitica from anon, authenticated;

-- El proyecto se crea sin "Automatically expose new tables": cada permiso se concede aquí a mano.
grant usage on schema public to anon, authenticated;
grant select on public.tienda, public.categoria, public.producto, public.oferta, public.precio_historial
  to anon, authenticated;
-- public.salida no recibe ningún permiso: solo se escribe con public.registrar_salida().

-- Funciones internas: Postgres da EXECUTE a todos por defecto y la Data API las expondría como RPC.
revoke execute on function public.recalcular_productos(uuid[]) from public, anon, authenticated;
revoke execute on function public.registrar_cambio_precio() from public, anon, authenticated;

-- Búsqueda: texto completo en español sin acentos y, si no hay resultados, similitud de trigramas.
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
     case when p_orden = 'precio_asc'  then c.precio_desde end asc nulls last,
     case when p_orden = 'precio_desc' then c.precio_desde end desc nulls last,
     (c.num_tiendas > 1) desc, c.r desc, c.precio_desde
   limit p_limite offset greatest(p_desde, 0);
end $$;

-- Registra una salida y devuelve la URL de la tienda. El destino siempre sale de la base,
-- y debe pertenecer al dominio de la tienda: /ir no puede usarse como redirección abierta.
create or replace function public.registrar_salida(
  p_oferta_id bigint, p_posicion int default null, p_sesion text default null, p_es_prueba boolean default false)
returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  o public.oferta;
  t public.tienda;
  v_url text;
begin
  select * into o from public.oferta where id = p_oferta_id and activa;
  if o.id is null then return null; end if;
  select * into t from public.tienda where id = o.tienda_id and estado = 'activa';
  if t.id is null or not (o.url = t.origen or o.url like t.origen || '/%') then return null; end if;

  insert into public.salida (oferta_id, tienda_id, producto_id, precio_mostrado, posicion, sesion, es_prueba)
  values (o.id, o.tienda_id, o.producto_id, o.precio,
          case when p_posicion between 1 and 100 then p_posicion end, left(p_sesion, 64), p_es_prueba);

  v_url := o.url || case when position('?' in o.url) > 0 then '&' else '?' end
           || 'utm_source=comparador-ec&utm_medium=cpc'
           || coalesce('&utm_content=pos-' || p_posicion, '');
  return v_url;
end $$;

revoke all on function public.registrar_salida(bigint, int, text, boolean) from public;
grant execute on function public.registrar_salida(bigint, int, text, boolean) to anon, authenticated;
grant execute on function public.buscar_productos(text, text, int, int) to anon, authenticated;
