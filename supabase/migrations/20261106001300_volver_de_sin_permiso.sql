-- Una tienda sin permiso vuelve sola cuando su robots.txt lo permite (PLAN-TODAS-LAS-TIENDAS.md, fase 1.5).
--
-- Qué fallaba: cli.ts solo corría las tiendas 'activa', así que una tienda marcada 'sin_permiso' nunca se
-- volvía a revisar aunque cambiara su robots.txt (Marcimex lo cambió: el seed la tenía sin permiso y hoy
-- permite la búsqueda del catálogo).
--
-- Qué cambia: cli.ts corre también las tiendas 'sin_permiso'. La puerta de robots.txt de ejecutarCorrida las
-- detiene tras una sola petición, la del propio robots.txt, si siguen prohibiendo. Esta migración redefine
-- ingesta.cerrar_corrida, copiando la versión de la migración 0300 y cambiando solo el final: una corrida
-- 'ok' o 'parcial' de una tienda 'sin_permiso' la pasa a 'activa' y borra su motivo. El disparador de la
-- migración 1100 recalcula sus productos. Una tienda 'pausada' no se toca: la pausa es una decisión humana.
-- create or replace conserva los permisos de la función.
create or replace function ingesta.cerrar_corrida(p_corrida_id bigint, p_estado ingesta.estado_corrida, p_error text default null)
returns ingesta.corrida
language plpgsql set search_path = '' as $$
declare
  c        ingesta.corrida;
  anterior ingesta.corrida;
  v_desact int := 0;
  v_ids    uuid[];
begin
  select * into c from ingesta.corrida where id = p_corrida_id and estado = 'en_curso' for update;
  if c.id is null then raise exception 'La corrida % no está en curso', p_corrida_id; end if;

  select * into anterior from ingesta.corrida
   where tienda_id = c.tienda_id and estado = 'ok' and id < c.id
   order by id desc limit 1;

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
