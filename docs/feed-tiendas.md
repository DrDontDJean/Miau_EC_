# Feed de precios para tiendas

Documento para enviar a una tienda que quiera que DecideAquí compare sus precios sin que tengamos que leer su sitio.
Es el camino previsto para las tiendas que no se pueden leer de forma automática (ADR 0007 y 0009): Smart Home EC,
De Prati y El Bárbaro hoy, y cualquier otra que lo prefiera.

## Qué pedimos

Un archivo **CSV o JSON** en una dirección `https` que podamos leer una vez al día, sin contraseña, con todos los
productos que la tienda vende en línea. Es el mismo formato que las tiendas envían a otros comparadores.

## Columnas

| Columna | Obligatoria | Qué lleva |
|---|---|---|
| `sku` | sí | Identificador del producto en la tienda. Estable: no cambia entre un día y otro |
| `titulo` | sí | Nombre del producto, tal como lo vería el comprador |
| `url` | sí | Enlace a la página del producto en la tienda (`https`, del mismo dominio de la tienda) |
| `precio` | sí | Precio que paga el comprador hoy, en dólares y con impuestos incluidos. Por ejemplo `1299.90` |
| `precio_lista` | no | Precio "antes", si la tienda lo muestra tachado. Solo cuenta si es mayor que `precio` |
| `disponible` | no | `si` o `no`. Si falta, el producto se muestra como disponible |
| `ean` | no | Código de barras (12 a 14 cifras). Permite unir el producto con el de otras tiendas |
| `imagen` | no | Enlace a la imagen del producto |
| `marca` | no | Marca del producto |

No importa el orden de las columnas ni si el nombre va en mayúsculas.

## Ejemplo en CSV

```csv
sku,titulo,url,precio,precio_lista,disponible,ean,imagen,marca
A-1,"Refrigeradora 14"" No Frost, acero RI-480",https://www.tienda.example/ri480/p,699.90,899.00,si,,https://www.tienda.example/i/1.jpg,Indurama
A-2,Lavadora 17 kg WA17T6260BY,https://www.tienda.example/wa17/p,489,,no,8806094000000,,Samsung
```

- Codificación UTF-8, con una línea de cabecera.
- Si un campo lleva comas o saltos de línea, va entre comillas dobles; una comilla dentro del campo se escribe doble (`""`).
- El separador decimal puede ser punto o coma, y también se aceptan miles (`1,299.90`, `1.299,90`).

## Ejemplo en JSON

Una lista de objetos con las mismas claves:

```json
[
  { "sku": "A-1", "titulo": "Refrigeradora RI-480", "url": "https://www.tienda.example/ri480/p", "precio": 699.9, "disponible": true },
  { "sku": "A-2", "titulo": "Lavadora 17 kg", "url": "https://www.tienda.example/wa17/p", "precio": 489, "disponible": false }
]
```

## Qué hacemos con el archivo

- Lo leemos una vez al día, de madrugada, con una sola petición.
- Si faltan las columnas obligatorias, o el JSON no es una lista de objetos, la lectura falla con un aviso y se conservan
  los precios del día anterior.
- Cada producto se valida: precio entre 0 y 100.000, enlace del dominio de la tienda, título de al menos 3 caracteres.
  Los que no cumplen no se publican.
- No guardamos el archivo: solo los datos de cada producto y su historial de precios.
- Al comprador le mostramos el precio, la fecha de actualización y un enlace a la tienda. Cada salida se registra de
  forma anónima.

## Cómo se activa en DecideAquí

Quien administra DecideAquí cambia la tienda a la plataforma `feed` con su dirección:

```sql
update public.tienda
   set plataforma = 'feed', url_feed = 'https://www.tienda.example/feeds/decideaqui.csv', estado = 'activa', motivo_estado = null
 where id = '<id de la tienda>';
```

No hace falta código nuevo. Si la tienda estaba pausada, hay que activarla a mano.

## A quién escribirle

Contactar a las tiendas lo hace una persona del proyecto, no el worker. Por prioridad:

1. **De Prati y El Bárbaro**: responden 403 a todo acceso automático, incluidos su portada y su sitemap.
2. **Smart Home EC**: su robots.txt prohíbe leer todo el sitio.
3. Cualquier tienda activa que prefiera enviar sus precios: el feed es más rápido y exacto que la lectura de sus páginas.
