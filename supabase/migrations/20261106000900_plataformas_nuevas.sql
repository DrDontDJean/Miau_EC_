-- Plataformas nuevas para sumar más tiendas (PLAN-TODAS-LAS-TIENDAS.md, fase 1).
--
-- Qué falta: public.plataforma_tienda solo conoce vtex, woocommerce y feed. Shopify, Magento, la API
-- propia de Frecuento y la lectura por sitemap con datos estructurados necesitan su valor.
--
-- Postgres no deja usar un valor de enum agregado en la misma transacción: por eso esta migración
-- solo agrega los valores, y las siguientes los usan.
alter type public.plataforma_tienda add value if not exists 'shopify';
alter type public.plataforma_tienda add value if not exists 'magento';
alter type public.plataforma_tienda add value if not exists 'frecuento';
alter type public.plataforma_tienda add value if not exists 'sitemap';
