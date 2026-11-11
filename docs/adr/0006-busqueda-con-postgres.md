# Búsqueda con texto completo de Postgres y pg_trgm, sin motor externo

Con unas 45 mil fichas, la búsqueda de texto completo de Postgres (configuración en español sin acentos) más pg_trgm para errores de tipeo responde en milisegundos y no añade otro servicio ni otra copia de los datos que mantener sincronizada. Algolia, Meilisearch o Elasticsearch quedan como opción si la búsqueda supera 300 ms de p95 en las pruebas k6 o si hace falta búsqueda por facetas avanzada.
