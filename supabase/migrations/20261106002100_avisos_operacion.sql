-- Avisos de operación: tiendas que fallan dos corridas seguidas y base cerca del límite gratuito.
--
-- Qué faltaba: un fallo solo se veía entrando a Actions o con SQL, y el tamaño de la base no se vigilaba
-- (el plan gratuito de Supabase permite 500 MB y las tiendas por sitemap todavía están completando su catálogo).
--
-- Qué agrega: dos reglas de calidad y calidad.revisar_operacion(), que inserta una incidencia por episodio
-- (repetida cada 24 h mientras dure) en esos dos casos:
--   * tienda_falla_repetida: la tienda está activa y sus dos últimas corridas terminadas fueron fallida o parcial.
--   * base_grande: la base supera los 400 MB (umbral de 100 MB bajo el límite).
-- El workflow de ingesta llama a la función al terminar y falla si hay avisos, así GitHub avisa por correo.
insert into calidad.regla (id, dimension, severidad, descripcion) values
  ('tienda_falla_repetida', 'frescura',     'advertencia', 'Las dos últimas corridas de la tienda terminaron fallidas o parciales'),
  ('base_grande',           'completitud',  'advertencia', 'La base supera los 400 MB; el límite gratuito de Supabase es 500 MB')
on conflict (id) do nothing;

create or replace function calidad.revisar_operacion() returns int
language sql set search_path = '' as $$
  with fallas as (
    insert into calidad.incidencia (regla_id, tienda_id, detalle)
    select 'tienda_falla_repetida', ti.id,
           jsonb_build_object('estados', u.estados, 'ultimo_error', u.ultimo_error)
      from public.tienda ti
      cross join lateral (
        select array_agg(c.estado::text order by c.iniciada_en desc) estados,
               (array_agg(c.error order by c.iniciada_en desc))[1] ultimo_error
          from (select * from ingesta.corrida
                 where tienda_id = ti.id and estado in ('ok', 'parcial', 'fallida')
                 order by iniciada_en desc limit 2) c
      ) u
     where ti.estado = 'activa'
       and cardinality(u.estados) = 2
       and u.estados <@ array['parcial', 'fallida']
       and not exists (
             select 1 from calidad.incidencia i
              where i.regla_id = 'tienda_falla_repetida' and i.tienda_id = ti.id
                and i.creado_en > now() - interval '24 hours')
    returning 1),
  base as (
    insert into calidad.incidencia (regla_id, tienda_id, detalle)
    select 'base_grande', '(base)', jsonb_build_object('megabytes', (pg_database_size(current_database()) / 1048576)::int)
     where pg_database_size(current_database()) > 400 * 1048576
       and not exists (
             select 1 from calidad.incidencia i
              where i.regla_id = 'base_grande' and i.creado_en > now() - interval '24 hours')
    returning 1)
  select ((select count(*) from fallas) + (select count(*) from base))::int;
$$;

-- Solo el rol de la ingesta (dueño) la ejecuta; los roles públicos no.
revoke all on function calidad.revisar_operacion() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('revisar-operacion', '30 8 * * *', 'select calidad.revisar_operacion()');
  end if;
end $$;
