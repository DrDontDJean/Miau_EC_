-- Ingesta diaria (ADR 0008): una corrida a las 06:17 UTC (01:17 en Ecuador) en vez de cada 6 h.

-- Frescura: con una corrida al día, 24 h exactas avisan en falso cuando GitHub retrasa el cron
-- (pasa a menudo, a veces más de una hora). 30 h toleran ese retraso y aun así avisan
-- unas 6 h después de una corrida perdida.
create or replace function calidad.revisar_frescura() returns int
language sql set search_path = '' as $$
  with t as (
    insert into calidad.incidencia (regla_id, tienda_id, detalle)
    select 'tienda_desactualizada', id, jsonb_build_object('ultima_corrida_ok', ultima_corrida_ok)
      from public.tienda
     where estado = 'activa' and (ultima_corrida_ok is null or ultima_corrida_ok < now() - interval '30 hours')
    returning 1)
  select count(*)::int from t;
$$;

update calidad.regla
   set descripcion = 'La tienda no tiene una corrida correcta en las últimas 30 horas'
 where id = 'tienda_desactualizada';

-- Los agregados se refrescan una vez al día, 2 h después de que empieza la ingesta
-- (la corrida dura unos 11 min; el margen cubre los retrasos del cron de GitHub).
-- cron.schedule con un nombre existente reemplaza ese trabajo.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('refrescar-analitica', '17 8 * * *', 'select analitica.refrescar()');
  end if;
end $$;
