-- Índice para los productos destacados de la portada.
--
-- Qué fallaba: la portada pide los 8 productos presentes en más tiendas (num_tiendas > 1, ordenados por num_tiendas y
-- precio). Con 128.000 productos eso recorría toda la tabla y la ordenaba: 1,6 s con la base en reposo, y el rol anon
-- corta cualquier consulta a los 3 s (statement_timeout). Con la base bajo carga se pasaba del límite, y la compilación de
-- la web, que prerenderiza esa página, fallaba con "canceling statement due to statement timeout": las vistas previas de
-- Vercel fallaban, y la portada de producción habría fallado al renovar su caché.
--
-- Qué cambia: un índice parcial solo sobre los productos que están en más de una tienda (unos 1.600), con el mismo orden
-- que la consulta. Lee los 8 primeros sin ordenar nada.
create index if not exists producto_destacados_idx
  on public.producto (num_tiendas desc, precio_desde)
  where num_tiendas > 1;
