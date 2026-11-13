-- Ofertas agotadas: sin stock y sin precio (PLAN-TODAS-LAS-TIENDAS.md, fase 1.7).
--
-- Qué fallaba: VTEX y varias tiendas Shopify y Magento publican precio 0 en un producto agotado. validar()
-- lo mandaba a cuarentena por precio_invalido, la oferta no se actualizaba, se desactivaba tras dos corridas y
-- la web casi nunca mostraba "Agotado". Además, la cuarentena se llenaba de ofertas correctas.
--
-- Qué cambia: el worker separa esas lecturas (tipo 'agotada') y las manda aquí. Como la base exige
-- precio > 0, una agotada no puede pasar por cargar_lote:
-- - ingesta.marcar_agotadas marca las ofertas existentes de la tienda como no disponibles, conservando su
--   último precio. El disparador de historial abre el tramo nuevo. Las agotadas que nunca se vieron con
--   precio no se publican.
-- - ingesta.corrida.agotadas cuenta esas lecturas, que también suman a leidas y validas porque son lecturas
--   correctas. La vista calidad.resumen_corrida la muestra al final.
alter table ingesta.corrida add column agotadas int not null default 0;

-- p_skus: array jsonb de sku_tienda. Devuelve cuántas ofertas existentes se marcaron.
create or replace function ingesta.marcar_agotadas(p_corrida_id bigint, p_skus jsonb) returns int
language plpgsql set search_path = '' as $$
declare
  v_tienda    text;
  v_marcadas  int;
  v_productos uuid[];
  v_leidas    int := jsonb_array_length(p_skus);
begin
  select tienda_id into v_tienda from ingesta.corrida where id = p_corrida_id and estado = 'en_curso';
  if v_tienda is null then raise exception 'La corrida % no existe o no está en curso', p_corrida_id; end if;

  -- La huella cambia para que la siguiente lectura con precio cuente como actualizada.
  with m as (
    update public.oferta
       set disponible = false, activa = true, precio_pendiente = null, visto_ultima_vez = now(),
           huella = 'agotada'
     where tienda_id = v_tienda
       and sku_tienda in (select jsonb_array_elements_text(p_skus))
    returning producto_id)
  select count(*), array_agg(distinct producto_id) into v_marcadas, v_productos from m;

  if v_marcadas > 0 then perform public.recalcular_productos(v_productos); end if;

  update ingesta.corrida
     set agotadas = agotadas + v_leidas, leidas = leidas + v_leidas, validas = validas + v_leidas
   where id = p_corrida_id;
  return v_marcadas;
end $$;

revoke execute on function ingesta.marcar_agotadas(bigint, jsonb) from public, anon, authenticated;

-- Misma vista que en la migración 0300, con agotadas al final.
create or replace view calidad.resumen_corrida as
select c.id as corrida_id, c.tienda_id, c.iniciada_en, c.terminada_en, c.estado,
       c.leidas, c.validas, c.en_cuarentena, c.nuevas, c.actualizadas, c.sin_cambios, c.desactivadas,
       round(100.0 * c.validas / nullif(c.leidas, 0), 1) as pct_validas,
       extract(epoch from (c.terminada_en - c.iniciada_en))::int as duracion_s,
       coalesce((select jsonb_object_agg(regla_id, n) from (
                   select regla_id, count(*) n from calidad.incidencia i
                    where i.corrida_id = c.id group by regla_id) x), '{}'::jsonb) as incidencias,
       c.agotadas
  from ingesta.corrida c;
