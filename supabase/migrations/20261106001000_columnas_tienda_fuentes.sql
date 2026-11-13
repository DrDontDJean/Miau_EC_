-- Configuración por tienda para las fuentes nuevas (PLAN-TODAS-LAS-TIENDAS.md, fase 1.2).
--
-- origen_api:          host de la API cuando no es el de la tienda (Frecuento sirve la API en app.frecuento.com
--                      y sus ofertas enlazan a www.frecuento.com). Si es null, la API está en origen.
-- url_sitemap:         sitemap raíz o índice de productos de una tienda de plataforma 'sitemap'. Si es null,
--                      se toman las líneas "Sitemap:" de su robots.txt.
-- patron_producto:     expresión regular que distingue, entre las URLs del sitemap, las de producto.
-- paginas_por_corrida: presupuesto diario de páginas de producto de una fuente 'sitemap' (1 petición por
--                      segundo: 2500 páginas son unos 42 minutos).
alter table public.tienda
  add column origen_api text
    check (origen_api is null or origen_api ~ '^https://[a-z0-9.-]+$'),
  add column url_sitemap text
    check (url_sitemap is null or url_sitemap ~ '^https://'),
  add column patron_producto text,
  add column paginas_por_corrida int not null default 2500
    check (paginas_por_corrida between 1 and 10000),
  add constraint tienda_sitemap_ck
    check (plataforma <> 'sitemap' or patron_producto is not null);
