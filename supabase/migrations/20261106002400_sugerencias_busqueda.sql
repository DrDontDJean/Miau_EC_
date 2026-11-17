-- Sugerencias mientras se escribe y "Quizás buscaba…" cuando no hay resultados.
--
-- Qué faltaba: el buscador no ayudaba a escribir, y una búsqueda sin resultados solo decía "Sin resultados".
--
-- Qué cambia:
-- 1) public.sugerir_busqueda(q): hasta 8 sugerencias en un jsonb, de dos tipos (las categorías llegarán con sus
--    páginas): marca (hasta 3, las marcas que empiezan por lo escrito, de la más presente a la menos) y producto (hasta
--    5, desde 3 letras, con los mismos términos que buscar_catalogo: sinónimos y patrón de prefijo, así que nunca
--    sugiere algo sin relación). Los accesorios no se sugieren salvo que se pidan.
-- 2) public.quizas_buscaba(q): hasta 3 términos parecidos que sí existen (marcas del catálogo y nombres de productos
--    comunes), por similitud de trigramas de al menos 0,4. Nunca rellena con productos que no coinciden.
-- Las dos corren como su dueño (security definer) para usar los índices, y filtran lo mismo que la RLS.
create index if not exists producto_marca_norm_idx
  on public.producto (public.normalizar_texto(marca) text_pattern_ops)
  where num_tiendas > 0 and marca is not null;

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
  -- like con prefijo: se escapan los comodines de lo escrito.
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
  return v_marcas || v_productos;
end $$;

create or replace function public.quizas_buscaba(p_q text) returns text[]
language sql stable
security definer
set search_path = ''
as $$
  with escrito as (
    -- La palabra más larga de lo escrito: es la que más probablemente tiene la errata.
    select w from unnest(regexp_split_to_array(public.normalizar_texto(left(coalesce(p_q, ''), 80)), '[^a-z0-9]+')) w
     where length(w) >= 3 order by length(w) desc limit 1
  ),
  vocabulario(t) as (
    select unnest(array['televisor', 'refrigeradora', 'lavadora', 'secadora', 'laptop', 'celular', 'tablet', 'licuadora',
                        'cafetera', 'microondas', 'cocina', 'colchon', 'audifonos', 'parlante', 'impresora', 'monitor',
                        'mouse', 'teclado', 'zapatos', 'aspiradora', 'ventilador', 'plancha', 'freidora', 'arrocera',
                        'batidora', 'congelador', 'aire acondicionado', 'camara', 'reloj', 'consola', 'silla', 'escritorio'])
    union
    -- Primero las marcas distintas (unos cientos) y después se normalizan: normalizar cada producto costaba ~0,5 s.
    select public.normalizar_texto(m.marca)
      from (select distinct p.marca from public.producto p where p.num_tiendas > 0 and p.marca is not null) m
  )
  select coalesce(array_agg(t order by s desc, t), '{}')
    from (select v.t, extensions.similarity(e.w, v.t) as s
            from vocabulario v, escrito e
           where extensions.similarity(e.w, v.t) >= 0.4 and v.t <> e.w
           order by s desc, v.t
           limit 3) x;
$$;

revoke all on function public.sugerir_busqueda(text) from public;
revoke all on function public.quizas_buscaba(text) from public;
grant execute on function public.sugerir_busqueda(text) to anon, authenticated;
grant execute on function public.quizas_buscaba(text) to anon, authenticated;
