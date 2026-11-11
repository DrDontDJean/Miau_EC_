# Ingesta por corridas programadas, no consulta en vivo por búsqueda

El prototipo consultaba las tiendas cada vez que alguien buscaba. Eso hace que la carga sobre las tiendas crezca con nuestro tráfico, impide guardar historial de precios y hace la búsqueda tan lenta como la tienda más lenta. Pasamos a corridas programadas: cada tienda se lee completa de forma periódica (hoy una vez al día, ver ADR 0008) y la web consulta solo nuestra base. Es el mismo modelo de idealo, que lee los feeds de las tiendas cada 30 minutos.

## Consequences

- Los precios publicados pueden tener hasta un día de atraso (ADR 0008). La web muestra la frescura de cada oferta.
- Una corrida completa son unas 900 peticiones repartidas entre 5 tiendas (Kywi sola son 629 páginas de 50 productos). A 1 petición por segundo por tienda tarda unos 11 minutos.
