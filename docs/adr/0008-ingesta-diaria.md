# La ingesta corre una vez al día, no cada 6 horas

ADR 0001 fijó corridas cada 6 horas. Las bajamos a una diaria, a las 06:17 UTC (01:17 en Ecuador).

- **Cuota de GitHub Actions.** El repositorio es privado y tiene 2.000 minutos gratis al mes. Cuatro corridas diarias de unos 11 minutos gastan unos 1.320, y CI necesita el resto. Una diaria gasta unos 330.
- **Carga sobre las tiendas.** Cada corrida son unas 900 peticiones. Con una al día son cuatro veces menos, y de madrugada, cuando las tiendas tienen menos tráfico.
- **Ritmo real de precios.** Las tiendas de Ecuador cambian precios sobre todo al empezar el día o una promoción, no varias veces al día. Correr a la 01:17 recoge los cambios de medianoche.

## Consequences

- Un precio puede tener hasta un día de atraso. La web muestra cuándo vimos cada oferta y pide confirmar en la tienda.
- Una oferta retirada sigue visible hasta 2 días, porque se desactiva tras dos ausencias.
- Un salto de precio de más del 70 % espera hasta la corrida del día siguiente para confirmarse.
- `revisar_frescura` avisa tras 30 horas sin corrida correcta, no 24. Así un retraso del cron de GitHub no da una falsa alarma.
- Las vistas ROLAP se refrescan una vez al día, a las 08:17 UTC.
- En semanas de promociones (Black Friday, Cyber Monday) conviene lanzar corridas extra con "Run workflow" o volver a cada 6 horas esos días.
