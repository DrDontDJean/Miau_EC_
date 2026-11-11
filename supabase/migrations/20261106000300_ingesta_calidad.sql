-- Ingesta (corridas, carga por lotes, cuarentena) y calidad de datos (reglas e incidencias).

create type ingesta.estado_corrida as enum ('en_curso', 'ok', 'parcial', 'fallida', 'sin_permiso');

create table ingesta.corrida (
  id            bigint generated always as identity primary key,
  tienda_id     text not null references public.tienda(id),
  iniciada_en   timestamptz not null default now(),
  terminada_en  timestamptz,
  estado        ingesta.estado_corrida not null default 'en_curso',
  paginas       int not null default 0,
  leidas        int not null default 0,
  validas       int not null default 0,
  en_cuarentena int not null default 0,
  nuevas        int not null default 0,
  actualizadas  int not null default 0,
  sin_cambios   int not null default 0,
  desactivadas  int not null default 0,
  error         text
);
create index corrida_tienda_idx on ingesta.corrida (tienda_id, iniciada_en desc);
-- Una sola corrida en curso por tienda.
create unique index corrida_en_curso_uk on ingesta.corrida (tienda_id) where estado = 'en_curso';

create table ingesta.cuarentena (
  id         bigint generated always as identity primary key,
  corrida_id bigint not null references ingesta.corrida(id) on delete cascade,
  tienda_id  text not null,
  sku_tienda text,
  reglas     text[] not null,
  payload    jsonb not null,   -- único lugar donde guardamos crudo (ADR 0003)
  revisada   boolean not null default false,
  creado_en  timestamptz not null default now()
);
create index cuarentena_corrida_idx on ingesta.cuarentena (corrida_id);

create type calidad.severidad as enum ('bloqueante', 'advertencia');

create table calidad.regla (
  id          text primary key,
  dimension   text not null check (dimension in ('validez', 'completitud', 'unicidad', 'consistencia', 'frescura')),
  severidad   calidad.severidad not null,
  descripcion text not null,
  activa      boolean not null default true
);

create table calidad.incidencia (
  id         bigint generated always as identity primary key,
  corrida_id bigint references ingesta.corrida(id) on delete cascade,
  regla_id   text not null references calidad.regla(id),
  tienda_id  text not null,
  sku_tienda text,
  detalle    jsonb,
  creado_en  timestamptz not null default now()
);
create index incidencia_corrida_idx on calidad.incidencia (corrida_id);
create index incidencia_regla_idx on calidad.incidencia (regla_id, creado_en);

insert into calidad.regla (id, dimension, severidad, descripcion) values
  ('precio_invalido',      'validez',      'bloqueante',  'Precio ausente, cero, negativo o mayor a 100000 USD'),
  ('url_fuera_de_tienda',  'validez',      'bloqueante',  'El enlace no pertenece al dominio de la tienda'),
  ('titulo_vacio',         'completitud',  'bloqueante',  'Título ausente o de menos de 3 caracteres'),
  ('sku_ausente',          'completitud',  'bloqueante',  'La oferta no trae identificador de la tienda'),
  ('moneda_no_usd',        'validez',      'bloqueante',  'Precio en una moneda distinta al dólar'),
  ('sku_duplicado',        'unicidad',     'advertencia', 'El mismo SKU aparece dos veces en la corrida; se conserva el más barato'),
  ('ean_invalido',         'validez',      'advertencia', 'EAN con dígito de control incorrecto; se descarta el EAN'),
  ('precio_lista_menor',   'consistencia', 'advertencia', 'Precio de lista menor o igual al precio; se descarta el precio de lista'),
  ('sin_imagen',           'completitud',  'advertencia', 'La oferta no trae imagen'),
  ('sin_emparejar',        'consistencia', 'advertencia', 'Sin EAN ni código de modelo: la oferta queda como producto propio'),
  ('salto_precio',         'consistencia', 'advertencia', 'El precio cambió más de 70 %; se publica cuando la siguiente corrida lo confirme'),
  ('caida_de_volumen',     'completitud',  'advertencia', 'La corrida leyó menos de la mitad de ofertas que la anterior; no se desactiva nada'),
  ('tienda_desactualizada','frescura',     'advertencia', 'La tienda no tiene una corrida correcta en las últimas 24 horas');

-- ── Funciones del worker ────────────────────────────────────────────────────

create or replace function ingesta.abrir_corrida(p_tienda_id text) returns bigint
language sql set search_path = '' as $$
  insert into ingesta.corrida (tienda_id) values (p_tienda_id) returning id;
$$;

-- Carga un lote ya validado (máx. 1000 ofertas). Empareja, hace upsert y cuenta.
-- Cada elemento de p_ofertas: {sku_tienda, titulo, url, imagen_url, precio, precio_lista,
--   disponible, ean, modelo, marca, huella}. El EAN y el modelo llegan ya validados.
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
            and o.precio_pendiente is distinct from l.precio) as salto
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
   where producto_id is null and modelo is not null
     and not exists (select 1 from public.producto p where p.modelo = l.modelo)
   order by modelo, precio
  on conflict (modelo) where modelo is not null and ean is null do nothing;

  update _lote l set producto_id = (
           select p.id from public.producto p where p.modelo = l.modelo
            order by (p.ean is not null) desc, p.creado_en limit 1),
         metodo = 'modelo'
   where l.producto_id is null and l.modelo is not null;

  -- Sin clave: conserva el producto que ya tenía o crea uno propio.
  update _lote set producto_id = producto_previo, metodo = 'ninguno'
   where producto_id is null and producto_previo is not null;
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

-- Ofertas que no pasaron las reglas bloqueantes.
create or replace function ingesta.registrar_cuarentena(p_corrida_id bigint, p_items jsonb) returns void
language plpgsql set search_path = '' as $$
declare v_tienda text;
begin
  select tienda_id into v_tienda from ingesta.corrida where id = p_corrida_id;
  insert into ingesta.cuarentena (corrida_id, tienda_id, sku_tienda, reglas, payload)
  select p_corrida_id, v_tienda, i->>'sku_tienda', array(select jsonb_array_elements_text(i->'reglas')), i->'payload'
    from jsonb_array_elements(p_items) i;
  insert into calidad.incidencia (corrida_id, regla_id, tienda_id, sku_tienda, detalle)
  select p_corrida_id, r, v_tienda, i->>'sku_tienda', null
    from jsonb_array_elements(p_items) i, jsonb_array_elements_text(i->'reglas') r;
  update ingesta.corrida
     set leidas = leidas + jsonb_array_length(p_items), en_cuarentena = en_cuarentena + jsonb_array_length(p_items)
   where id = p_corrida_id;
end $$;

-- Advertencias detectadas en el worker (EAN inválido, sin imagen, duplicados...).
create or replace function ingesta.registrar_incidencias(p_corrida_id bigint, p_items jsonb) returns void
language sql set search_path = '' as $$
  insert into calidad.incidencia (corrida_id, regla_id, tienda_id, sku_tienda, detalle)
  select p_corrida_id, i->>'regla_id', c.tienda_id, i->>'sku_tienda', i->'detalle'
    from jsonb_array_elements(p_items) i
    join ingesta.corrida c on c.id = p_corrida_id;
$$;

-- Cierra la corrida. Desactiva ofertas que faltan en esta corrida y en la anterior,
-- salvo que el volumen haya caído a menos de la mitad (corte de seguridad).
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
  return c;
end $$;

-- Resumen de calidad por corrida (lo usa la página de transparencia y el panel).
create view calidad.resumen_corrida as
select c.id as corrida_id, c.tienda_id, c.iniciada_en, c.terminada_en, c.estado,
       c.leidas, c.validas, c.en_cuarentena, c.nuevas, c.actualizadas, c.sin_cambios, c.desactivadas,
       round(100.0 * c.validas / nullif(c.leidas, 0), 1) as pct_validas,
       extract(epoch from (c.terminada_en - c.iniciada_en))::int as duracion_s,
       coalesce((select jsonb_object_agg(regla_id, n) from (
                   select regla_id, count(*) n from calidad.incidencia i
                    where i.corrida_id = c.id group by regla_id) x), '{}'::jsonb) as incidencias
  from ingesta.corrida c;

-- Retención: cuarentena 30 días, incidencias 90 días.
create or replace function ingesta.purgar_antiguos() returns void
language sql set search_path = '' as $$
  delete from ingesta.cuarentena where creado_en < now() - interval '30 days';
  delete from calidad.incidencia where creado_en < now() - interval '90 days';
$$;

-- Marca tiendas activas sin corrida correcta en 24 horas.
create or replace function calidad.revisar_frescura() returns int
language sql set search_path = '' as $$
  with t as (
    insert into calidad.incidencia (regla_id, tienda_id, detalle)
    select 'tienda_desactualizada', id, jsonb_build_object('ultima_corrida_ok', ultima_corrida_ok)
      from public.tienda
     where estado = 'activa' and (ultima_corrida_ok is null or ultima_corrida_ok < now() - interval '24 hours')
    returning 1)
  select count(*)::int from t;
$$;
