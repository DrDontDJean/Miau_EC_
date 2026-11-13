-- Títulos sin entidades HTML: "15.6&quot;" pasa a 15.6".
--
-- Qué fallaba: las tiendas VTEX leídas por sitemap (Créditos Económicos, Almacenes Japón y Orve Hogar) dejan entidades
-- HTML dentro del JSON-LD de sus fichas, y los títulos se guardaban tal cual: "Laptop HP 15-DY2172 | 15.6&quot; 8GB".
-- Eran 688 ofertas y 519 productos, con solo tres entidades: &quot;, &apos; y &amp;.
--
-- Qué cambia: la fuente sitemap ya decodifica el nombre y la marca al leer (las ofertas se corrigen solas en la próxima
-- corrida). Pero el título de un producto se fija al crearlo y no se actualiza después, así que esta migración limpia los
-- que ya están guardados, en oferta y en producto. &amp; se decodifica al final: "&amp;quot;" es el texto literal
-- "&quot;" y no debe decodificarse dos veces. La búsqueda (columna generada) y es_accesorio se recalculan solas.
create or replace function pg_temp.decodificar_html(t text) returns text
language sql immutable strict
as $$
  select replace(replace(replace(replace(replace(replace(t, '&quot;', '"'), '&apos;', ''''), '&#39;', ''''), '&lt;', '<'), '&gt;', '>'), '&amp;', '&')
$$;

update public.oferta
   set titulo = pg_temp.decodificar_html(titulo)
 where titulo ~ '&(quot|apos|amp|lt|gt|#39);';

update public.producto
   set titulo = pg_temp.decodificar_html(titulo)
 where titulo ~ '&(quot|apos|amp|lt|gt|#39);';
