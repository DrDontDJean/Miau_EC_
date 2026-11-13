-- Lectura por sitemap: cómo se retiran ofertas y cómo cierra la corrida (PLAN-TODAS-LAS-TIENDAS.md, fase 6).
--
-- Qué falta: una fuente 'sitemap' lee como mucho paginas_por_corrida páginas al día, así que no todas las
-- ofertas se ven en cada corrida. La regla de cerrar_corrida (desactivar lo que falta en dos corridas
-- seguidas) las desactivaría por no haberlas visitado todavía.
--
-- Qué cambia:
-- 1) ingesta.desactivar_fuera_de_sitemap(corrida, vigentes, retiradas) desactiva las ofertas de la tienda
--    cuya URL ya no está en el sitemap, o que la tienda dejó de servir (404 o 410). Si el sitemap trae menos de
--    la mitad de las ofertas activas, no se desactiva nada por salir del sitemap (probable lectura incompleta)
--    y se anota caida_de_volumen; las páginas retiradas sí se desactivan. Con un sitemap vacío no hace nada.
-- 2) cerrar_corrida (versión de la migración 1300) no aplica ni la regla de las dos ausencias ni el corte por
--    volumen a las tiendas de plataforma 'sitemap', y conserva las desactivadas que ya contó la reconciliación.
create or replace function ingesta.desactivar_fuera_de_sitemap(p_corrida_id bigint, p_vigentes jsonb, p_retiradas jsonb)
returns int
language plpgsql set search_path = '' as $$
declare
  v_tienda  text;
  v_activas int;
  v_validas int;
  v_aplicar boolean;
  v_desact  int;
  v_ids     uuid[];
begin
  select tienda_id into v_tienda from ingesta.corrida where id = p_corrida_id and estado = 'en_curso';
  if v_tienda is null then raise exception 'La corrida % no existe o no está en curso', p_corrida_id; end if;

  v_validas := jsonb_array_length(p_vigentes);
  if v_validas = 0 then return 0; end if;
  select count(*) into v_activas from public.oferta where tienda_id = v_tienda and activa;
  v_aplicar := v_validas >= v_activas * 0.5;
  if not v_aplicar then
    insert into calidad.incidencia (corrida_id, regla_id, tienda_id, detalle)
    values (p_corrida_id, 'caida_de_volumen', v_tienda, jsonb_build_object('en_sitemap', v_validas, 'activas', v_activas));
  end if;

  with vig as (select distinct u from jsonb_array_elements_text(p_vigentes) as t(u)),
       ret as (select distinct u from jsonb_array_elements_text(p_retiradas) as t(u)),
       d as (
         update public.oferta o set activa = false
          where o.tienda_id = v_tienda and o.activa
            and (exists (select 1 from ret where ret.u = o.url)
                 or (v_aplicar and not exists (select 1 from vig where vig.u = o.url)))
         returning o.producto_id)
  select count(*), array_agg(distinct producto_id) into v_desact, v_ids from d;

  if v_desact > 0 then
    perform public.recalcular_productos(v_ids);
    update ingesta.corrida set desactivadas = desactivadas + v_desact where id = p_corrida_id;
  end if;
  return v_desact;
end $$;

revoke execute on function ingesta.desactivar_fuera_de_sitemap(bigint, jsonb, jsonb) from public, anon, authenticated;

create or replace function ingesta.cerrar_corrida(p_corrida_id bigint, p_estado ingesta.estado_corrida, p_error text default null)
returns ingesta.corrida
language plpgsql set search_path = '' as $$
declare
  c        ingesta.corrida;
  anterior ingesta.corrida;
  v_plat   public.plataforma_tienda;
  v_desact int := 0;
  v_ids    uuid[];
begin
  select * into c from ingesta.corrida where id = p_corrida_id and estado = 'en_curso' for update;
  if c.id is null then raise exception 'La corrida % no está en curso', p_corrida_id; end if;
  select plataforma into v_plat from public.tienda where id = c.tienda_id;

  select * into anterior from ingesta.corrida
   where tienda_id = c.tienda_id and estado = 'ok' and id < c.id
   order by id desc limit 1;

  if v_plat = 'sitemap' then
    -- No se visita todo cada día: las ofertas se retiran por el sitemap, no por no verlas.
    v_desact := c.desactivadas;
  else
    if p_estado = 'ok' and anterior.id is not null and c.validas < anterior.validas * 0.5 then
      p_estado := 'parcial';
      insert into calidad.incidencia (corrida_id, regla_id, tienda_id, detalle)
      values (c.id, 'caida_de_volumen', c.tienda_id,
              jsonb_build_object('validas', c.validas, 'anterior', anterior.validas));
    end if;

    if p_estado = 'ok' and anterior.id is not null then
      with d as (
        update public.oferta set activa = false
         where tienda_id = c.tienda_id and activa and visto_ultima_vez < anterior.iniciada_en
        returning producto_id)
      select count(*), array_agg(distinct producto_id) into v_desact, v_ids from d;
      if v_desact > 0 then perform public.recalcular_productos(v_ids); end if;
    end if;
  end if;

  update ingesta.corrida
     set estado = p_estado, terminada_en = now(), error = p_error, desactivadas = v_desact
   where id = c.id
  returning * into c;

  if p_estado = 'ok' then
    update public.tienda set ultima_corrida_ok = now() where id = c.tienda_id;
  elsif p_estado = 'sin_permiso' then
    update public.tienda set estado = 'sin_permiso', motivo_estado = p_error where id = c.tienda_id;
  end if;
  -- Leyó el catálogo: el robots.txt ya lo permite.
  if p_estado in ('ok', 'parcial') then
    update public.tienda set estado = 'activa', motivo_estado = null
     where id = c.tienda_id and estado = 'sin_permiso';
  end if;
  return c;
end $$;
