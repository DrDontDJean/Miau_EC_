# Next.js (App Router) desplegado en Vercel para la web

Un comparador vive del tráfico de buscadores, así que las fichas de producto deben llegar renderizadas desde el servidor y cachearse. Next.js con App Router da renderizado en servidor, regeneración incremental de las fichas (ISR, cada 15 minutos) y route handlers para `/api/buscar` y `/ir`. Vercel lo despliega sin configuración y crea un despliegue de vista previa por cada pull request, que es donde corren las pruebas k6. Funciones en la región `iad1` (Washington D. C.), junto a la base de Supabase en `us-east-1`: desde Quito está más cerca que São Paulo.

## Considered Options

- Astro: excelente para páginas de contenido, pero las partes interactivas (filtros, historial) y la API quedarían en otra pieza.
- SvelteKit y React Router 7 (antes Remix): técnicamente equivalentes, pero con menos integración con Vercel y menos ejemplos con Supabase.

## Consequences

- El plan Hobby de Vercel es solo para uso no comercial. Sirve para el proyecto universitario; si el comparador cobra por salidas hay que pasar a Pro.
