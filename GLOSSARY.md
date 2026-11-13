# DecideAqui

Comparador de precios de tiendas online de Ecuador: reúne las ofertas de varias tiendas, agrupa las que son el mismo producto y lleva al comprador a la tienda que elija.

## Catálogo

**Tienda**:
Comercio online ecuatoriano cuyas ofertas mostramos. Tiene un estado: activa, pausada o sin permiso.
_Avoid_: comercio, merchant, shop

**Fuente**:
Forma en que obtenemos el catálogo de una tienda: su catálogo público (VTEX, WooCommerce, Shopify o Magento), la API que usa su propia web, las páginas de producto que publica con su sitemap y sus datos estructurados, o un feed acordado con la tienda.
_Avoid_: scraper, conector, integración

**Feed**:
Archivo de ofertas que una tienda publica para nosotros por acuerdo, como el que las tiendas envían a idealo.
_Avoid_: export, dump

**Oferta**:
Lo que una tienda vende bajo su propio identificador (SKU de tienda): título, enlace, precio y disponibilidad en esa tienda.
_Avoid_: listing, item, publicación

**Producto**:
El artículo real que pueden vender varias tiendas, por ejemplo "Samsung UN55U8000FPCZE". Agrupa ofertas.
_Avoid_: ficha, artículo, SKU

**Emparejamiento**:
Decisión de que una oferta corresponde a un producto: por EAN, por código de modelo o a mano.
_Avoid_: matching, mapeo, deduplicación

**Código de modelo**:
Referencia del fabricante extraída del título de la oferta (letras y números, al menos 6 caracteres), como 65MNUHD. Un código escrito con guion se une: "LRI-11BLSAP" y "LRI11BLSAP" son el mismo.
_Avoid_: referencia, part number

## Precios

**Precio**:
Lo que el comprador paga hoy en la tienda, en dólares con impuestos incluidos.
_Avoid_: PVP, costo

**Precio de lista**:
Precio "antes" que la tienda muestra tachado. Solo cuenta si es mayor que el precio.
_Avoid_: precio regular, precio original

**Precio desde**:
El menor precio entre las ofertas disponibles de un producto.
_Avoid_: mejor precio, precio mínimo

**Salto de precio**:
Cambio de más del 70 % respecto al precio anterior de la misma oferta. Se publica solo cuando la siguiente corrida lo confirma.
_Avoid_: anomalía, outlier

**Historial de precios**:
Secuencia de periodos en los que una oferta tuvo un mismo precio y disponibilidad.
_Avoid_: snapshots, log de precios

## Ingesta y calidad

**Corrida**:
Una lectura completa del catálogo de una tienda, de principio a fin, con su resultado.
_Avoid_: job, crawl, sync, ejecución

**Agotada**:
Oferta que la tienda publica sin stock y sin precio. No es un fallo: se muestra como "Agotado" con su último precio conocido y no cuenta para el precio desde. Si nunca se vio con precio, no se publica.
_Avoid_: sin precio, descontinuada, rota

**Accesorio**:
Producto cuyo título empieza como un complemento de otro (soporte, cable, funda, cargador, repuesto) o dice "para" seguido de un aparato. En la búsqueda va después de los demás productos, salvo que se busque uno.
_Avoid_: complemento, aditamento

**Cuarentena**:
Lugar donde quedan las ofertas que fallan una regla bloqueante. No se publican.
_Avoid_: rechazados, descartes, errores

**Regla de calidad**:
Condición que toda oferta debe cumplir. Es bloqueante (manda a cuarentena) o advertencia (se publica y se anota).
_Avoid_: validación, check

**Incidencia**:
Registro de que una oferta incumplió una regla de calidad en una corrida.
_Avoid_: error, alerta, issue

**Frescura**:
Tiempo desde que vimos una oferta por última vez en su tienda.
_Avoid_: antigüedad, latencia

## Tráfico

**Salida**:
Clic de un comprador que lo lleva de nuestra web a la oferta en la tienda. Es lo que una tienda pagaría en un modelo de coste por clic.
_Avoid_: clic, lead, redirección, leadout
