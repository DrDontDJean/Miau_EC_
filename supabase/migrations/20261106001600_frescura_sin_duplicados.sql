-- Una incidencia de frescura por episodio, no una por hora.
--
-- Qué fallaba: calidad.revisar_frescura (migración 0700) corre cada hora por pg_cron e insertaba una incidencia
-- tienda_desactualizada nueva cada vez: hasta 24 por día y por tienda (146 en un día con 24 tiendas).
--
-- Qué cambia: solo inserta si no existe ya una incidencia tienda_desactualizada de esa tienda posterior a su
-- ultima_corrida_ok y de las últimas 24 h. Queda una por episodio, repetida cada 24 h mientras la tienda siga sin
-- corrida correcta. El umbral de 30 h del ADR 0008 no cambia. create or replace conserva sus permisos.
create or replace function calidad.revisar_frescura() returns int
language sql set search_path = '' as $$
  with t as (
    insert into calidad.incidencia (regla_id, tienda_id, detalle)
    select 'tienda_desactualizada', ti.id, jsonb_build_object('ultima_corrida_ok', ti.ultima_corrida_ok)
      from public.tienda ti
     where ti.estado = 'activa'
       and (ti.ultima_corrida_ok is null or ti.ultima_corrida_ok < now() - interval '30 hours')
       and not exists (
             select 1 from calidad.incidencia i
              where i.regla_id = 'tienda_desactualizada' and i.tienda_id = ti.id
                and i.creado_en > now() - interval '24 hours'
                and (ti.ultima_corrida_ok is null or i.creado_en > ti.ultima_corrida_ok))
    returning 1)
  select count(*)::int from t;
$$;
