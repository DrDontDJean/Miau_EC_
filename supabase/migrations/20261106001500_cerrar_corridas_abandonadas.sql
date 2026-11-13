-- Una corrida interrumpida ya no bloquea a su tienda para siempre.
--
-- Qué fallaba: ingesta.corrida tiene un índice único que permite una sola corrida 'en_curso' por tienda. Si el
-- proceso moría sin cerrarla (workflow cancelado o con tiempo agotado), esa fila quedaba en_curso y abrir_corrida
-- fallaba por violación del índice en todas las corridas siguientes de esa tienda.
--
-- Qué cambia: abrir_corrida cierra como 'fallida' las corridas de la tienda que llevan más de 3 horas en_curso (el
-- workflow tiene un tope de 90 minutos, así que una corrida viva nunca llega a tanto) y luego abre la nueva.
-- create or replace conserva los permisos de la función.
create or replace function ingesta.abrir_corrida(p_tienda_id text) returns bigint
language plpgsql set search_path = '' as $$
declare
  v_id bigint;
begin
  update ingesta.corrida
     set estado = 'fallida', terminada_en = now(), error = 'La corrida no terminó: el proceso se interrumpió'
   where tienda_id = p_tienda_id and estado = 'en_curso' and iniciada_en < now() - interval '3 hours';
  insert into ingesta.corrida (tienda_id) values (p_tienda_id) returning id into v_id;
  return v_id;
end $$;
