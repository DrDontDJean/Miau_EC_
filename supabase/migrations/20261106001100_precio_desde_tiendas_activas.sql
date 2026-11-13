-- Precio desde y número de tiendas solo con tiendas activas (PLAN-TODAS-LAS-TIENDAS.md, fase 1.6).
--
-- Qué fallaba: public.recalcular_productos (migración 0200) cuenta toda oferta activa sin mirar el estado
-- de la tienda, y nada recalcula los productos cuando una tienda pasa a 'pausada' o 'sin_permiso'. La web sí
-- oculta esas ofertas (buscar_productos y RLS filtran por tienda activa), así que un producto mostraba
-- "desde $400, 2 tiendas" con una sola oferta visible de $500. Con tiendas que cambian de estado solas
-- (migración 1300) el desajuste sería habitual.
--
-- Qué cambia:
-- 1) recalcular_productos solo cuenta ofertas de tiendas con estado 'activa', para precio_desde y para
--    num_tiendas. Antes del update bloquea los productos en orden fijo: las corridas de todas las tiendas van
--    en paralelo (Promise.all en cli.ts) y comparten productos, y sin un orden fijo dos lotes pueden
--    bloquearse mutuamente (deadlock). Pasa de sql a plpgsql para poder usar perform; create or replace
--    conserva sus permisos (revocados en la 0400).
-- 2) Un disparador en public.tienda recalcula los productos de la tienda cuando cambia su estado. Las ofertas
--    no se desactivan: si la tienda vuelve a estar activa, reaparecen sin esperar a otra corrida.
-- 3) Al final se recalculan los productos que ya quedaron mal.
create or replace function public.recalcular_productos(p_ids uuid[]) returns void
language plpgsql set search_path = '' as $$
begin
  perform 1 from public.producto where id = any(p_ids) order by id for update;

  update public.producto p
     set precio_desde   = s.desde,
         num_tiendas    = coalesce(s.tiendas, 0),
         actualizado_en = now()
    from (
      select x.id,
             min(o.precio) filter (where o.disponible) as desde,
             count(distinct o.tienda_id)               as tiendas
        from unnest(p_ids) as x(id)
        left join (public.oferta o join public.tienda t on t.id = o.tienda_id and t.estado = 'activa')
          on o.producto_id = x.id and o.activa
       group by x.id
    ) s
   where p.id = s.id;
end $$;

create or replace function public.recalcular_por_tienda() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_ids uuid[];
begin
  select array_agg(distinct producto_id) into v_ids
    from public.oferta where tienda_id = new.id and activa;
  if v_ids is not null then perform public.recalcular_productos(v_ids); end if;
  return null;
end $$;

revoke execute on function public.recalcular_por_tienda() from public, anon, authenticated;

create trigger tienda_estado_recalcular
after update of estado on public.tienda
for each row
when (old.estado is distinct from new.estado)
execute function public.recalcular_por_tienda();

-- Productos que ya quedaron con ofertas de tiendas no activas en su precio desde.
select public.recalcular_productos(array(
  select distinct o.producto_id
    from public.oferta o join public.tienda t on t.id = o.tienda_id
   where o.activa and t.estado <> 'activa'));
