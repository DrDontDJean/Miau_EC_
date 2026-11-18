-- Índices GIN de producto sin lista pendiente (fastupdate = off).
--
-- Qué fallaba (17 de noviembre de 2026): tras clasificar los 133.292 productos (una actualización por fila) y con la
-- ingesta escribiendo a la vez, toda búsqueda pasaba del límite de 3 s del rol público, incluso las que antes tardaban
-- 0,2 s. No había bloqueos ni lecturas de disco: era CPU. Con fastupdate (el valor por defecto), un índice GIN anota
-- las entradas nuevas en una lista pendiente sin ordenar, y cada búsqueda la recorre entera hasta que un vacuum la
-- vacía. El índice de trigramas tenía 158 páginas pendientes; al vaciarlas con gin_clean_pending_list, "zzkkxx" pasó
-- de 3,7 s a 0,35 s y "laptop" de 14 s a 2,5 s (y a ~0,24 s con la base descargada).
--
-- Qué cambia: los tres índices GIN de producto (texto completo, trigramas del título y atributos) escriben cada entrada
-- en su lugar. La ingesta escribe algo más lento; las búsquedas ya no dependen de cuándo pase el vacuum. Se vacía lo
-- que hubiera pendiente.
alter index public.producto_busqueda_idx set (fastupdate = off);
alter index public.producto_titulo_norm_trgm_idx set (fastupdate = off);
alter index public.producto_atributos_idx set (fastupdate = off);

select gin_clean_pending_list('public.producto_busqueda_idx'::regclass),
       gin_clean_pending_list('public.producto_titulo_norm_trgm_idx'::regclass),
       gin_clean_pending_list('public.producto_atributos_idx'::regclass);
