# Fuentes sin API: Shopify, Magento, API propia y sitemap con datos estructurados

Hasta ahora el worker leía tiendas VTEX y WooCommerce, y el ADR 0007 dejaba fuera a las que prohíben su API en el
robots.txt. Eso dejaba 5 tiendas activas. Se suman tres tipos de API pública (Shopify, Magento y la de Frecuento) y una
fuente nueva, **sitemap**, que llega a las tiendas cuya API no se puede leer.

## Decisiones

1. **Se sigue respetando el robots.txt.** El ADR 0007 no cambia. Lo que se cambió es qué se lee: casi todas las tiendas
   que prohíben `/*?` (es decir, toda URL con parámetros) sí permiten sus páginas de producto, que no llevan parámetros, y
   publican un `sitemap.xml` con esas páginas. Cada URL, incluida la de cada ficha de producto, se comprueba contra el
   robots.txt antes de pedirla.
2. **Orden de preferencia de fuentes:** API pública permitida, luego sitemap con datos estructurados y, por acuerdo con la
   tienda, feed. Un feed siempre gana: es más rápido y exacto que leer una página por producto.
3. **Datos estructurados, no HTML.** De cada página solo se leen el JSON-LD de schema.org (`Product`) o los metadatos
   Open Graph de producto, que las tiendas publican justamente para buscadores y comparadores. No se interpreta el diseño
   de la página ni se siguen enlaces, y la página no se guarda (ADR 0003). Una página sin precio en datos estructurados
   se salta; si pasa del 20 % en una corrida, la corrida queda `parcial`.
4. **Un 403 no se evade.** Una respuesta 403, un desafío de Cloudflare o un captcha son una negativa. No se cambia el
   User-Agent, no se usa un navegador sin interfaz ni se rotan direcciones. Una racha de 10 errores seguidos detiene la
   lectura de esa tienda. De Prati y El Bárbaro responden 403 a todo, incluida su portada: quedan pausadas hasta tener un
   feed o un permiso.
5. **Solo `GET`.** En Magento, la consulta GraphQL va en la URL (`/graphql?query=…`), porque robots.txt se evalúa sobre la
   URL que se pide. No se pasa a `POST` para esquivar un `Disallow`.
6. **Presupuesto diario de páginas.** Una página por producto a 1 petición por segundo no cabe en un día para las tiendas
   grandes. Cada tienda sitemap tiene `paginas_por_corrida` (2.500 por omisión, unos 42 minutos). Cada corrida lee primero
   las URLs nunca vistas, luego las modificadas desde la última visita (`lastmod`) y luego las visitadas hace más tiempo.
   El precio de una oferta puede tener entre 1 y unos 8 días, y la web lo dice.
7. **Cómo se retira una oferta de una tienda sitemap.** No se visita todo cada día, así que la regla de las dos ausencias
   no aplica. Se desactiva lo que sale del sitemap o devuelve 404 o 410. Si el sitemap trae menos de la mitad de las ofertas
   activas se desconfía de la lectura: no se desactiva por salir del sitemap y se anota `caida_de_volumen`. Un sitemap vacío,
   o uno hijo que falla, hacen fallar la corrida: nunca se reconcilia contra una lista parcial.
8. **Una tienda sin permiso vuelve sola.** Las corridas también revisan las tiendas `sin_permiso`: si su robots.txt sigue
   prohibiendo, se hace una sola petición (el propio robots.txt); si ya lo permite, la tienda pasa a `activa`. Una tienda
   pausada no se toca: la pausa es una decisión humana.
9. **La moneda de Shopify se lee de `/meta.json`, no de `/cart.js`**, porque los robots.txt de las tiendas prohíben
   `/cart.js`.

## Consecuencias

- DecideAquí compara 24 tiendas en lugar de 5, y más de 100.000 ofertas.
- Las tiendas sitemap tienen precios con algunos días de atraso. Es un costo de leer sin API; el feed lo resuelve.
- El workflow de ingesta pasa de 60 a 90 minutos de tope y gasta unos 1.800 minutos de GitHub Actions al mes con el
  presupuesto completo en todas las tiendas sitemap. Un repositorio privado se queda en el límite gratuito de 2.000;
  uno público no tiene límite, y bajar `paginas_por_corrida` reduce el gasto.
- Una tienda que cambie su formato (quite su JSON-LD, mueva su sitemap) se nota en `calidad.resumen_corrida`: la corrida
  queda `parcial` o `fallida` en vez de publicar datos malos o desactivar ofertas vigentes.
- Quedan fuera las tiendas que bloquean el acceso automático (403) y las que prohíben todo el sitio, hasta tener un
  acuerdo. El contrato del feed está en `docs/feed-tiendas.md`.
