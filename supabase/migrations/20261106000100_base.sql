-- Extensiones, esquemas y búsqueda en español sin acentos.
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create schema if not exists ingesta;    -- corridas y cuarentena (solo el worker)
create schema if not exists calidad;    -- reglas e incidencias
create schema if not exists analitica;  -- modelo en estrella (ROLAP)

-- "Lámpara" y "lampara" deben encontrar lo mismo.
create text search configuration public.es_sin_acentos (copy = pg_catalog.spanish);
alter text search configuration public.es_sin_acentos
  alter mapping for hword, hword_part, word with extensions.unaccent, spanish_stem;

create or replace function public.normalizar_texto(t text) returns text
language sql immutable parallel safe strict
set search_path = ''
as $$ select lower(extensions.unaccent('extensions.unaccent'::regdictionary, t)) $$;

create type public.plataforma_tienda as enum ('vtex', 'woocommerce', 'feed');
create type public.estado_tienda as enum ('activa', 'pausada', 'sin_permiso');
create type public.metodo_emparejamiento as enum ('ean', 'modelo', 'manual', 'ninguno');
