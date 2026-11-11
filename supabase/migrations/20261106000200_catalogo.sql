-- Modelo operativo (OLTP): tiendas, productos, ofertas, historial de precios y salidas.

create table public.tienda (
  id                     text primary key check (id ~ '^[a-z0-9-]{2,30}$'),
  nombre                 text not null,
  origen                 text not null unique check (origen ~ '^https://[a-z0-9.-]+$'),
  plataforma             public.plataforma_tienda not null,
  estado                 public.estado_tienda not null default 'pausada',
  motivo_estado          text,
  peticiones_por_segundo numeric(4,2) not null default 1
                         check (peticiones_por_segundo > 0 and peticiones_por_segundo <= 5),
  url_feed               text check (url_feed is null or url_feed ~ '^https://'),
  ultima_corrida_ok      timestamptz,
  creado_en              timestamptz not null default now(),
  check (plataforma <> 'feed' or url_feed is not null)
);

create table public.categoria (
  id       bigint generated always as identity primary key,
  padre_id bigint references public.categoria(id),
  nombre   text not null,
  slug     text not null unique check (slug ~ '^[a-z0-9-]+$')
);

create table public.producto (
  id             uuid primary key default gen_random_uuid(),
  titulo         text not null check (length(titulo) between 3 and 300),
  marca          text,
  modelo         text check (modelo ~ '^[A-Z0-9]{6,20}$'),
  ean            text check (ean ~ '^[0-9]{8,14}$'),
  categoria_id   bigint references public.categoria(id),
  imagen_url     text,
  -- Desnormalizado para listar rápido; lo mantiene public.recalcular_productos().
  precio_desde   numeric(12,2),
  num_tiendas    smallint not null default 0,
  busqueda       tsvector generated always as (
                   setweight(to_tsvector('public.es_sin_acentos', coalesce(marca, '')), 'A') ||
                   setweight(to_tsvector('public.es_sin_acentos', coalesce(modelo, '')), 'A') ||
                   setweight(to_tsvector('public.es_sin_acentos', titulo), 'B')
                 ) stored,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create unique index producto_ean_uk on public.producto (ean) where ean is not null;
-- Un código de modelo sin EAN identifica un solo producto.
create unique index producto_modelo_sin_ean_uk on public.producto (modelo) where modelo is not null and ean is null;
create index producto_modelo_idx on public.producto (modelo) where modelo is not null;
create index producto_busqueda_idx on public.producto using gin (busqueda);
create index producto_titulo_trgm_idx on public.producto using gin (public.normalizar_texto(titulo) extensions.gin_trgm_ops);
create index producto_categoria_idx on public.producto (categoria_id, precio_desde);

create table public.oferta (
  id                    bigint generated always as identity primary key,
  tienda_id             text not null references public.tienda(id),
  sku_tienda            text not null check (length(sku_tienda) between 1 and 100),
  producto_id           uuid not null references public.producto(id),
  metodo_emparejamiento public.metodo_emparejamiento not null,
  titulo                text not null check (length(titulo) between 3 and 300),
  url                   text not null check (url ~ '^https://'),
  imagen_url            text,
  precio                numeric(12,2) not null check (precio > 0 and precio < 100000),
  precio_lista          numeric(12,2) check (precio_lista is null or precio_lista > precio),
  disponible            boolean not null,
  ean                   text check (ean ~ '^[0-9]{8,14}$'),
  modelo                text,
  huella                text not null,             -- hash del contenido normalizado
  precio_pendiente      numeric(12,2),             -- salto de precio esperando confirmación
  activa                boolean not null default true,
  visto_primera_vez     timestamptz not null default now(),
  visto_ultima_vez      timestamptz not null default now(),
  unique (tienda_id, sku_tienda)
);
create index oferta_producto_idx on public.oferta (producto_id) where activa;
create index oferta_tienda_visto_idx on public.oferta (tienda_id, visto_ultima_vez);

-- SCD tipo 2: un periodo por cada combinación distinta de precio y disponibilidad.
create table public.precio_historial (
  oferta_id    bigint not null references public.oferta(id) on delete cascade,
  valido_desde timestamptz not null,
  valido_hasta timestamptz,
  precio       numeric(12,2) not null,
  precio_lista numeric(12,2),
  disponible   boolean not null,
  primary key (oferta_id, valido_desde),
  check (valido_hasta is null or valido_hasta > valido_desde)
);
create unique index precio_historial_abierto_uk on public.precio_historial (oferta_id) where valido_hasta is null;
create index precio_historial_rango_idx on public.precio_historial (valido_desde, valido_hasta);

create or replace function public.registrar_cambio_precio() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    update public.precio_historial
       set valido_hasta = now()
     where oferta_id = new.id and valido_hasta is null;
  end if;
  insert into public.precio_historial (oferta_id, valido_desde, precio, precio_lista, disponible)
  values (new.id, now(), new.precio, new.precio_lista, new.disponible);
  return new;
end $$;

create trigger oferta_historial_insert
after insert on public.oferta
for each row execute function public.registrar_cambio_precio();

create trigger oferta_historial_update
after update of precio, precio_lista, disponible on public.oferta
for each row
when (old.precio is distinct from new.precio
   or old.precio_lista is distinct from new.precio_lista
   or old.disponible is distinct from new.disponible)
execute function public.registrar_cambio_precio();

-- Salida: clic del comprador hacia la tienda (hecho transaccional).
create table public.salida (
  id              bigint generated always as identity primary key,
  oferta_id       bigint not null references public.oferta(id),
  tienda_id       text not null references public.tienda(id),
  producto_id     uuid not null references public.producto(id),
  precio_mostrado numeric(12,2) not null,
  posicion        smallint check (posicion between 1 and 100),
  sesion          text check (sesion is null or length(sesion) <= 64), -- hash diario anónimo, nunca la IP
  es_prueba       boolean not null default false,                      -- tráfico de k6
  creado_en       timestamptz not null default now()
);
create index salida_fecha_idx on public.salida (creado_en);
create index salida_tienda_fecha_idx on public.salida (tienda_id, creado_en);

-- Mantiene precio_desde y num_tiendas de los productos tocados.
create or replace function public.recalcular_productos(p_ids uuid[]) returns void
language sql set search_path = '' as $$
  update public.producto p
     set precio_desde   = s.desde,
         num_tiendas    = coalesce(s.tiendas, 0),
         actualizado_en = now()
    from (
      select x.id,
             min(o.precio) filter (where o.disponible) as desde,
             count(distinct o.tienda_id)               as tiendas
        from unnest(p_ids) as x(id)
        left join public.oferta o on o.producto_id = x.id and o.activa
       group by x.id
    ) s
   where p.id = s.id;
$$;
