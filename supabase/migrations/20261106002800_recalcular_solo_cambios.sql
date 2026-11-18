-- La ingesta solo reescribe los productos cuyo precio desde o número de tiendas cambió.
--
-- Qué fallaba (18 de noviembre de 2026, producción): la ingesta diaria falló en 14 de 24 tiendas con "canceling statement
-- due to statement timeout" (2 minutos). Cada lote de cargar_lote llama a recalcular_productos con hasta 1.000 productos,
-- y esa función los reescribía todos aunque nada hubiera cambiado (actualizado_en = now()). Con los índices GIN de
-- producto sin lista pendiente (migración 2600), cada reescritura toca los índices de texto y de trigramas: medido en
-- producción, 6 s por lote en frío, y con 24 tiendas a la vez sobre un disco ya lento los lotes pasaban de 2 minutos.
-- De 602.000 actualizaciones de producto, solo 78.000 se pudieron hacer sin tocar los índices.
--
-- Qué cambia: el update filtra los productos cuyos valores siguen iguales. actualizado_en pasa a significar "cambió su
-- precio desde o sus tiendas" (nada lo lee hoy). Misma firma; los permisos se conservan con create or replace.
create or replace function public.recalcular_productos(p_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.producto where id = any(p_ids) order by id for update;

  update public.producto p
     set precio_desde   = s.desde,
         num_tiendas    = s.tiendas,
         actualizado_en = now()
    from (
      select x.id,
             min(o.precio) filter (where o.disponible) as desde,
             count(distinct o.tienda_id)::int          as tiendas
        from unnest(p_ids) as x(id)
        left join (public.oferta o join public.tienda t on t.id = o.tienda_id and t.estado = 'activa')
          on o.producto_id = x.id and o.activa
       group by x.id
    ) s
   where p.id = s.id
     and (p.precio_desde is distinct from s.desde or p.num_tiendas is distinct from s.tiendas);
end $$;
