-- ROLAP: esquema en estrella sobre el mismo Postgres (ADR 0002).
-- Hechos:      public.precio_historial (periodos, SCD2) y public.salida (transacciones).
-- Dimensiones: fecha, tienda, categoría, producto.
-- Agregados:   vistas materializadas pequeñas, refrescadas por pg_cron tras cada corrida.

create table analitica.dim_fecha (
  fecha         date primary key,
  anio          smallint not null,
  trimestre     smallint not null,
  mes           smallint not null,
  semana_iso    smallint not null,
  dia_semana    smallint not null,          -- 1 = lunes
  es_fin_semana boolean  not null,
  evento        text                         -- Black Friday, Cyber Day, Navidad...
);
insert into analitica.dim_fecha
select d::date, extract(year from d), extract(quarter from d), extract(month from d),
       extract(week from d), extract(isodow from d), extract(isodow from d) in (6, 7), null
  from generate_series(date '2026-01-01', date '2030-12-31', interval '1 day') d;

create view analitica.dim_tienda as
  select id as tienda_id, nombre, plataforma, estado from public.tienda;

create view analitica.dim_categoria as
  select c.id as categoria_id, c.nombre, c.slug, p.nombre as categoria_padre
    from public.categoria c left join public.categoria p on p.id = c.padre_id;

create view analitica.dim_producto as
  select p.id as producto_id, p.titulo, p.marca, p.modelo, p.ean, p.categoria_id
    from public.producto p;

-- Índice de precios semanal por tienda y categoría (precio vigente al cierre de cada semana).
create materialized view analitica.precio_semanal as
with semanas as (
  select distinct date_trunc('week', fecha)::date as semana
    from analitica.dim_fecha where fecha <= current_date
)
select s.semana, o.tienda_id, coalesce(p.categoria_id, 0) as categoria_id,
       count(*)                                                         as ofertas,
       percentile_cont(0.5) within group (order by h.precio)::numeric(12,2) as precio_mediano,
       round(avg(case when h.precio_lista > h.precio
                      then 100 * (1 - h.precio / h.precio_lista) end), 1)   as descuento_prom_pct,
       round(100.0 * avg(h.disponible::int), 1)                          as pct_disponible
  from semanas s
  join public.precio_historial h
    on h.valido_desde < s.semana + 7 and (h.valido_hasta is null or h.valido_hasta >= s.semana + 7)
  join public.oferta o   on o.id = h.oferta_id
  join public.producto p on p.id = o.producto_id
 group by 1, 2, 3;
create unique index precio_semanal_uk on analitica.precio_semanal (semana, tienda_id, categoria_id);

-- Salidas por día, tienda y categoría (excluye el tráfico de pruebas k6).
create materialized view analitica.salida_diaria as
select s.creado_en::date as fecha, s.tienda_id, coalesce(p.categoria_id, 0) as categoria_id,
       count(*) as salidas, count(distinct s.sesion) as sesiones,
       sum(s.precio_mostrado)::numeric(14,2) as valor_mostrado
  from public.salida s join public.producto p on p.id = s.producto_id
 where not s.es_prueba
 group by 1, 2, 3;
create unique index salida_diaria_uk on analitica.salida_diaria (fecha, tienda_id, categoria_id);

-- Competitividad: en cuántos productos de varias tiendas cada tienda tiene el precio desde.
create materialized view analitica.competitividad_tienda as
with multi as (
  select o.producto_id, o.tienda_id, o.precio, min(o.precio) over (partition by o.producto_id) as minimo
    from public.oferta o join public.producto p on p.id = o.producto_id
   where o.activa and o.disponible and p.num_tiendas > 1
)
select tienda_id, count(*) as productos_compartidos,
       count(*) filter (where precio = minimo) as veces_mas_barata,
       round(100.0 * count(*) filter (where precio = minimo) / count(*), 1) as pct_mas_barata,
       round(avg(100.0 * (precio - minimo) / minimo), 1) as sobreprecio_prom_pct
  from multi group by tienda_id;
create unique index competitividad_tienda_uk on analitica.competitividad_tienda (tienda_id);

create or replace function analitica.refrescar() returns void
language plpgsql set search_path = '' as $$
begin
  refresh materialized view concurrently analitica.precio_semanal;
  refresh materialized view concurrently analitica.salida_diaria;
  refresh materialized view concurrently analitica.competitividad_tienda;
end $$;

-- Tareas programadas. pg_cron existe en Supabase; en otros Postgres se omite sin error.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    -- La ingesta empieza a los :17 cada 6 h; los agregados se refrescan una hora después.
    perform cron.schedule('refrescar-analitica', '17 1,7,13,19 * * *', 'select analitica.refrescar()');
    perform cron.schedule('revisar-frescura',    '0 * * * *',          'select calidad.revisar_frescura()');
    perform cron.schedule('purgar-antiguos',     '30 3 * * *',         'select ingesta.purgar_antiguos()');
  end if;
end $$;
