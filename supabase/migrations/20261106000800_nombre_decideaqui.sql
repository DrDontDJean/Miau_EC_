-- El comparador pasa a llamarse DecideAqui: las salidas llevan utm_source=decideaqui.
-- Misma función que en la migración 0400; create or replace conserva sus permisos.
create or replace function public.registrar_salida(
  p_oferta_id bigint, p_posicion int default null, p_sesion text default null, p_es_prueba boolean default false)
returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  o public.oferta;
  t public.tienda;
  v_url text;
begin
  select * into o from public.oferta where id = p_oferta_id and activa;
  if o.id is null then return null; end if;
  select * into t from public.tienda where id = o.tienda_id and estado = 'activa';
  if t.id is null or not (o.url = t.origen or o.url like t.origen || '/%') then return null; end if;

  insert into public.salida (oferta_id, tienda_id, producto_id, precio_mostrado, posicion, sesion, es_prueba)
  values (o.id, o.tienda_id, o.producto_id, o.precio,
          case when p_posicion between 1 and 100 then p_posicion end, left(p_sesion, 64), p_es_prueba);

  v_url := o.url || case when position('?' in o.url) > 0 then '&' else '?' end
           || 'utm_source=decideaqui&utm_medium=cpc'
           || coalesce('&utm_content=pos-' || p_posicion, '');
  return v_url;
end $$;
