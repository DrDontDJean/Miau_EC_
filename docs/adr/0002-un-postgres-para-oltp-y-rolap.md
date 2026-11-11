# Un solo Postgres (Supabase) para la operación y el análisis (ROLAP)

La parte operativa (OLTP: catálogo, búsqueda, salidas) y la analítica viven en el mismo Postgres de Supabase. El análisis es ROLAP: un esquema en estrella en el esquema `analitica` (dimensiones fecha, tienda, categoría y producto; hechos de historial de precios y salidas) con vistas materializadas de agregados que pg_cron refresca después de cada corrida. Descartamos un almacén aparte (BigQuery, ClickHouse) y un cubo MOLAP porque el volumen estimado no lo justifica: unas 55 mil ofertas, entre 2 y 5 mil cambios de precio al día (menos de 2 millones de filas al año) y pocas salidas. Revisar esta decisión si los hechos pasan de 50 millones de filas o si las consultas analíticas superan 2 segundos de p95.

## Considered Options

- Almacén separado con ETL nocturno: más piezas, otra factura y datos con un día de atraso, a cambio de una escala que no necesitamos.
- Cubo MOLAP: precalcula todo, pero cambiar una dimensión obliga a reconstruirlo, y las herramientas son de pago o están abandonadas.
