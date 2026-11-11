# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Compradores en Ecuador de electrodomésticos, tecnología y hogar (televisor, refrigeradora, laptop, lavadora). Dos situaciones que el mismo visitante cubre por igual: comparar el precio de hoy entre tiendas y mirar el historial de precios para decidir si compra ya o espera. Llegan buscando un producto concreto y quieren saber dónde está más barato antes de ir a la tienda.

## Product Purpose
DecideAqui reúne los catálogos públicos de tiendas online ecuatorianas, agrupa las ofertas que son el mismo producto y muestra "N tiendas desde $X". Al elegir una oferta, el comprador va directo a la tienda por un redirector que registra la salida de forma anónima. El éxito es que el comprador identifique la tienda más conveniente y llegue a ella con confianza.

## Positioning
Solo agrupa ofertas que son realmente el mismo producto (por EAN o código de modelo) y muestra el precio que la tienda publica, sin patrocinios. Es un comparador honesto: dice cuándo se actualizaron los datos y pide confirmar siempre en la tienda.

## Operating Context
- Un worker lee el catálogo de cada tienda una vez al día (06:17 UTC); los precios no son en vivo.
- Precio publicado por la tienda.
- Superficies actuales: inicio, `/buscar`, `/p/[id]` con historial de precios, `/tiendas`, `/api/buscar` e `/ir/[id]`.
- Vocabulario del dominio en `GLOSSARY.md` (tienda, oferta, producto, precio desde, salto de precio, corrida, cuarentena).

## Capabilities and Constraints
- Next.js 16 (App Router, Cache Components) con Tailwind 4 y Supabase; despliegue en Vercel con Root Directory `apps/web`.
- Tiendas activas: Comandato, Novicompu, Kywi, Pycca (VTEX) y Computron (WooCommerce). Otras quedan `sin_permiso` por su robots.txt.
- Limitaciones conocidas: la búsqueda también devuelve accesorios; el código de modelo no sirve para ferretería ni hogar; Mercado Libre Ecuador no está incluido.
- Usar el vocabulario de GLOSSARY.md en la interfaz y evitar los términos que marca como "Avoid".

## Brand Commitments
- El nombre **DecideAqui**.
- Voz en tuteo, en español claro de Ecuador, sin jerga.
- Logo, colores y tipografía actuales no son obligatorios y pueden cambiar.

## Evidence on Hand
- Catálogo real cargado desde las tiendas activas y historial de precios propio.
- No hay testimonios, cifras de usuarios ni acuerdos comerciales documentados: no inventarlos.

## Product Principles
1. El comprador decide con datos verificables: el mismo producto, el precio de la tienda y la fecha de actualización.
2. Honestidad antes que conversión: sin patrocinios y con avisos claros de que el precio debe confirmarse en la tienda.
3. Comparar hoy y ver el historial son una sola tarea, no dos productos.
4. Lenguaje directo y cercano, en tuteo.
