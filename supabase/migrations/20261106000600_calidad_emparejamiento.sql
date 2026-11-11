-- 1) Un precio de lista igual al precio significa "sin descuento" y ya no se anota (primera corrida
--    real: 323 de 611 ofertas lo traían así). Solo es incidencia si el precio de lista es MENOR.
-- 2) Emparejamiento por código de modelo más estricto (primera corrida real: "15AMN8" agrupó laptops
--    distintas y "1920X1080" agrupó 5 monitores de una misma tienda): una tienda aparece como mucho
--    una vez por producto cuando el emparejamiento es por modelo. Por EAN no cambia: es exacto.

update calidad.regla
   set descripcion = 'Precio de lista menor que el precio; se descarta el precio de lista'
 where id = 'precio_lista_menor';

create or replace function ingesta.cargar_lote(p_corrida_id bigint, p_ofertas jsonb)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_tienda    text;
  v_nuevas    int;
  v_actual    int;
  v_iguales   int;
  v_productos uuid[];
begin
  select tienda_id into v_tienda from ingesta.corrida where id = p_corrida_id and estado = 'en_curso';
  if v_tienda is null then raise exception 'La corrida % no existe o no está en curso', p_corrida_id; end if;
  if jsonb_array_length(p_ofertas) > 1000 then raise exception 'Lote demasiado grande'; end if;

  create temp table _lote on commit drop as
  select l.*, null::uuid as producto_id, null::public.metodo_emparejamiento as metodo,
         o.id as oferta_id, o.producto_id as producto_previo, o.metodo_emparejamiento as metodo_previo,
         o.precio as precio_previo, o.precio_lista as lista_previa, o.precio_pendiente, o.huella as huella_previa,
         (o.id is not null and abs(l.precio - o.precio) / o.precio > 0.70
            and o.precio_pendiente is distinct from l.precio) as salto,
         -- Dentro del lote, solo el SKU más barato de cada código de modelo puede agruparse por modelo.
         row_number() over (partition by l.modelo order by l.precio, l.sku_tienda) as rn_modelo
    from jsonb_to_recordset(p_ofertas) as l(
           sku_tienda text, titulo text, url text, imagen_url text, precio numeric, precio_lista numeric,
           disponible boolean, ean text, modelo text, marca text, huella text)
    left join public.oferta o on o.tienda_id = v_tienda and o.sku_tienda = l.sku_tienda;

  -- 1. Emparejamiento: manual se respeta; luego EAN; luego código de modelo.
  update _lote set producto_id = producto_previo, metodo = 'manual' where metodo_previo = 'manual';

  insert into public.producto (titulo, marca, modelo, ean, imagen_url)
  select distinct on (ean) titulo, marca, modelo, ean, imagen_url
    from _lote where producto_id is null and ean is not null
   order by ean, precio
  on conflict (ean) where ean is not null do nothing;

  update _lote l set producto_id = p.id, metodo = 'ean'
    from public.producto p where l.producto_id is null and p.ean = l.ean;

  insert into public.producto (titulo, marca, modelo, imagen_url)
  select distinct on (modelo) titulo, marca, modelo, imagen_url
    from _lote l
   where producto_id is null and modelo is not null and rn_modelo = 1
     and not exists (select 1 from public.producto p where p.modelo = l.modelo)
   order by modelo, precio
  on conflict (modelo) where modelo is not null and ean is null do nothing;

  -- Un producto nunca recibe por modelo un segundo SKU de la misma tienda: un código compartido
  -- por varios SKUs de una tienda suele ser una familia (p. ej. 15AMN8), no un modelo.
  update _lote l set producto_id = (
           select p.id from public.producto p
            where p.modelo = l.modelo
              and not exists (select 1 from public.oferta o
                               where o.producto_id = p.id and o.tienda_id = v_tienda
                                 and o.sku_tienda <> l.sku_tienda and o.activa)
            order by (p.ean is not null) desc, p.creado_en limit 1),
         metodo = 'modelo'
   where l.producto_id is null and l.modelo is not null and l.rn_modelo = 1;
  update _lote set metodo = null where producto_id is null;

  -- Sin clave: conserva su producto anterior solo si era propio; si no, crea uno propio.
  update _lote set producto_id = producto_previo, metodo = 'ninguno'
   where producto_id is null and producto_previo is not null and metodo_previo = 'ninguno';
  update _lote set producto_id = gen_random_uuid(), metodo = 'ninguno' where producto_id is null;
  insert into public.producto (id, titulo, marca, imagen_url)
  select producto_id, titulo, marca, imagen_url from _lote l
   where metodo = 'ninguno' and not exists (select 1 from public.producto p where p.id = l.producto_id);

  -- 2. Incidencias de saltos de precio.
  insert into calidad.incidencia (corrida_id, regla_id, tienda_id, sku_tienda, detalle)
  select p_corrida_id, 'salto_precio', v_tienda, sku_tienda,
         jsonb_build_object('anterior', precio_previo, 'nuevo', precio)
    from _lote where salto;

  select count(*) filter (where oferta_id is null),
         count(*) filter (where oferta_id is not null and huella is distinct from huella_previa),
         count(*) filter (where oferta_id is not null and huella = huella_previa)
    into v_nuevas, v_actual, v_iguales
    from _lote;

  -- 3. Upsert. Un salto conserva el precio anterior y deja el nuevo pendiente.
  insert into public.oferta as o (tienda_id, sku_tienda, producto_id, metodo_emparejamiento, titulo, url,
                                  imagen_url, precio, precio_lista, disponible, ean, modelo, huella,
                                  precio_pendiente, activa, visto_ultima_vez)
  select v_tienda, sku_tienda, producto_id, metodo, titulo, url, imagen_url,
         case when salto then precio_previo else precio end,
         case when salto then lista_previa else precio_lista end,
         disponible, ean, modelo, huella,
         case when salto then precio end,
         true, now()
    from _lote
  on conflict (tienda_id, sku_tienda) do update set
         producto_id           = excluded.producto_id,
         metodo_emparejamiento = excluded.metodo_emparejamiento,
         titulo                = excluded.titulo,
         url                   = excluded.url,
         imagen_url            = excluded.imagen_url,
         precio                = excluded.precio,
         precio_lista          = excluded.precio_lista,
         disponible            = excluded.disponible,
         ean                   = excluded.ean,
         modelo                = excluded.modelo,
         huella                = excluded.huella,
         precio_pendiente      = excluded.precio_pendiente,
         activa                = true,
         visto_ultima_vez      = now();

  select array_agg(distinct x) into v_productos
    from (select producto_id from _lote union select producto_previo from _lote where producto_previo is not null) t(x);
  perform public.recalcular_productos(v_productos);

  update ingesta.corrida
     set leidas = leidas + jsonb_array_length(p_ofertas), validas = validas + jsonb_array_length(p_ofertas),
         nuevas = nuevas + v_nuevas, actualizadas = actualizadas + v_actual, sin_cambios = sin_cambios + v_iguales,
         paginas = paginas + 1
   where id = p_corrida_id;

  return jsonb_build_object('nuevas', v_nuevas, 'actualizadas', v_actual, 'sin_cambios', v_iguales);
end $$;
