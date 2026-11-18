-- Títulos sin ninguna entidad HTML: "Oppo&nbsp;Reno" pasa a "Oppo Reno", "55&#8243;" a 55″, "Ba&ntilde;o" a Baño.
--
-- Qué fallaba: la migración 1900 solo decodificaba cinco entidades (&quot; &apos; &#39; &lt; &gt; y &amp;). En la web
-- seguían saliendo títulos como "Celular Oppo &nbsp; Reno 11 5G", y las fuentes que no eran sitemap o WooCommerce no
-- decodificaban nada.
--
-- Qué cambia: la validación de ofertas (paquete dominio, decodificarEntidades) decodifica ya todas las entidades, nombradas
-- y numéricas, en el título y la marca de cualquier fuente. Esta migración limpia lo que ya está guardado: el título de
-- oferta y el título y la marca de producto, con las mismas reglas: una sola pasada de izquierda a derecha, así "&amp;nbsp;" queda como el texto literal
-- "&nbsp;" y no se decodifica dos veces; una entidad desconocida o un código inválido se deja tal cual; &nbsp; pasa a
-- espacio y los espacios repetidos se juntan. La búsqueda y es_accesorio (columnas generadas) se recalculan solas.
create or replace function pg_temp.decodificar_entidades(t text) returns text
language plpgsql immutable strict
as $$
declare
  nombradas constant jsonb := '{
    "amp":"&","quot":"\"","apos":"''","lt":"<","gt":">","nbsp":" ",
    "aacute":"á","eacute":"é","iacute":"í","oacute":"ó","uacute":"ú","Aacute":"Á","Eacute":"É","Iacute":"Í","Oacute":"Ó","Uacute":"Ú",
    "ntilde":"ñ","Ntilde":"Ñ","uuml":"ü","Uuml":"Ü","agrave":"à","egrave":"è","ccedil":"ç","Ccedil":"Ç",
    "iexcl":"¡","iquest":"¿","ordm":"º","ordf":"ª","deg":"°","middot":"·","bull":"•","hellip":"…",
    "ndash":"–","mdash":"—","lsquo":"‘","rsquo":"’","sbquo":"‚","ldquo":"“","rdquo":"”","bdquo":"„","laquo":"«","raquo":"»",
    "prime":"′","Prime":"″","times":"×","divide":"÷","plusmn":"±","frac12":"½","frac14":"¼","frac34":"¾",
    "sup1":"¹","sup2":"²","sup3":"³","micro":"µ","reg":"®","copy":"©","trade":"™","euro":"€","cent":"¢","pound":"£",
    "shy":"","zwnj":"","zwj":"","ensp":" ","emsp":" ","thinsp":" "}';
  resultado text := '';
  resto     text := t;
  m         text[];
  entidad   text;
  reemplazo text;
  codigo    bigint;
begin
  loop
    m := regexp_match(resto, '&(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,8});');
    exit when m is null;
    entidad := '&' || m[1] || ';';
    codigo := case
      when m[1] ~ '^#[xX]' then ('x' || lpad(substr(m[1], 3), 8, '0'))::bit(32)::bigint
      when m[1] ~ '^#'     then substr(m[1], 2)::bigint
    end;
    reemplazo := case
      when codigo is null then nombradas ->> m[1]
      when codigo > 0 and codigo <= 1114111 and codigo not between 55296 and 57343 then chr(codigo::int)
    end;
    -- La primera aparición del texto de la entidad es justo la que encontró la expresión (la más a la izquierda).
    resultado := resultado || substr(resto, 1, strpos(resto, entidad) - 1) || coalesce(reemplazo, entidad);
    resto := substr(resto, strpos(resto, entidad) + length(entidad));
  end loop;
  return btrim(regexp_replace(resultado || resto, '\s{2,}', ' ', 'g'));
end $$;

update public.oferta
   set titulo = pg_temp.decodificar_entidades(titulo)
 where titulo ~ '&(#[0-9]+|#[xX][0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]+);';

update public.producto
   set titulo = pg_temp.decodificar_entidades(titulo),
       marca  = nullif(pg_temp.decodificar_entidades(marca), '')
 where titulo ~ '&(#[0-9]+|#[xX][0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]+);'
    or marca  ~ '&(#[0-9]+|#[xX][0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]+);';
