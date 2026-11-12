---
name: DecideAqui
description: Comparador honesto de precios entre tiendas online de Ecuador; paneles blancos sobre gris, cabecera y pie en azul acero, cian solo para señalar el precio.
colors:
  fondo: "#eef0f3"
  seccion: "#e3e6eb"
  superficie: "#ffffff"
  texto: "#36364f"
  suave: "#5f6070"
  borde: "#dde1e6"
  arena: "#cfb8aa"
  borde-control: "#737a88"
  cian: "#13a9cf"
  en-cian: "#1f1f33"
  accion: "#346a8f"
  accion-fuerte: "#2a5675"
  en-accion: "#ffffff"
  borde-accion: "#346a8f"
  enlace: "#346a8f"
  cabecera: "#346a8f"
  cabecera-fuerte: "#2a5675"
  en-cabecera: "#ffffff"
  en-cabecera-suave: "#dde7ee"
  pie: "#346a8f"
  en-pie: "#ffffff"
  resalte: "#e7f6fa"
  foco: "#1f1f33"
  serie-1: "#346a8f"
  serie-2: "#7a5b4e"
  serie-3: "#36364f"
typography:
  display:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
  nav:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
    letterSpacing: "0.08em"
  precio-ficha:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "tnum"
  precio-oferta:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.33
    fontFeature: "tnum"
  precio-tarjeta:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 1.4
    fontFeature: "tnum"
  eje-grafico:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1
  eje-grafico-movil:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1
rounded:
  md: "6px"
  lg: "8px"
  2xl: "16px"
  full: "9999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
  10: "40px"
  objetivo-tactil: "44px"
  contenedor: "1152px"
components:
  franja-hechos:
    backgroundColor: "{colors.cabecera-fuerte}"
    textColor: "{colors.en-cabecera-suave}"
    padding: "8px 16px"
  cabecera:
    backgroundColor: "{colors.cabecera}"
    textColor: "{colors.en-cabecera}"
    padding: "12px 16px"
  buscador-campo:
    backgroundColor: "#ffffff"
    textColor: "{colors.texto}"
    rounded: "{rounded.full}"
    padding: "0 16px 0 44px"
    height: "44px"
  buscador-boton:
    backgroundColor: "{colors.cian}"
    textColor: "{colors.en-cian}"
    rounded: "{rounded.full}"
    padding: "0 20px"
    height: "44px"
  pestana:
    textColor: "{colors.en-cabecera-suave}"
    typography: "{typography.nav}"
    padding: "0 12px"
    height: "44px"
  pestana-activa:
    textColor: "{colors.en-cabecera}"
    typography: "{typography.nav}"
  panel:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.2xl}"
    padding: "24px"
  banda-cabecera:
    backgroundColor: "{colors.cabecera}"
    textColor: "{colors.en-cabecera}"
    rounded: "{rounded.2xl}"
    padding: "40px"
  pastilla-categoria:
    backgroundColor: "transparent"
    textColor: "{colors.en-cabecera}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "44px"
  pastilla-categoria-activa:
    backgroundColor: "#ffffff"
    textColor: "{colors.en-cian}"
    rounded: "{rounded.full}"
  tarjeta-producto:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.lg}"
    padding: "12px"
  etiqueta-precio:
    backgroundColor: "{colors.cian}"
    textColor: "{colors.en-cian}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  chip:
    backgroundColor: "{colors.seccion}"
    textColor: "{colors.texto}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  boton-oferta:
    backgroundColor: "{colors.accion}"
    textColor: "{colors.en-accion}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "44px"
  boton-oferta-hover:
    backgroundColor: "{colors.accion-fuerte}"
    textColor: "{colors.en-accion}"
  boton-contorno:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.enlace}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "44px"
  boton-secundario:
    backgroundColor: "transparent"
    textColor: "{colors.texto}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "44px"
  fila-oferta-barata:
    backgroundColor: "{colors.resalte}"
    textColor: "{colors.texto}"
    rounded: "{rounded.lg}"
    padding: "16px"
  pie:
    backgroundColor: "{colors.pie}"
    textColor: "{colors.en-pie}"
    padding: "40px 16px"
---

# Design System: DecideAqui

## Overview

**Creative North Star: "El precio con fecha"**

DecideAqui se lee como un catálogo de tienda online, pero honesto. Una franja de hechos y una cabecera en azul acero con buscador en píldora abren todas las páginas; debajo, paneles blancos sobre un fondo gris claro. El pie repite el acero de la cabecera y cierra la página. La estructura es familiar a propósito: el comprador ya sabe usarla.

Lo propio del sistema es la disciplina de funciones. El acero es la casa: cabecera, pie, bandas de título y la voz de actuar ("Ver oferta"). El cian solo señala el precio: el botón Buscar, la etiqueta "Precio más bajo", la marca "Más barato", el borde de la oferta más barata y el punto "hoy" del historial. El grafito lee y el gris separa. La portada está en modo Persuade (banda de bienvenida con producto); la búsqueda y la ficha están en modo Operate (densas y escaneables).

El registro es formal (usted), breve y sin explicaciones obvias.

**Key Characteristics:**
- Paneles blancos de 16 px de radio sobre fondo `--fondo` gris; nada de sombras en reposo.
- Cabecera y pie en el mismo acero; la franja superior en acero fuerte.
- Cian siempre con tinta profunda, y solo para señalar precio; acero siempre con blanco.
- Un único botón sólido por decisión: el de la mejor oferta. El resto, en contorno.
- Mayúsculas solo en la franja de hechos y en el menú de categorías.
- Extra negrita solo para h1 y precios.
- Toda hora se muestra en America/Guayaquil; objetivos táctiles de 44 px.

## Colors

Fondo gris neutro, paneles blancos, azul acero para la casa y la acción, cian como acento de precio.

### Primary
- **Azul acero** (`--cabecera`, `--pie`, `--accion`, `--enlace`, `--borde-accion`): cabecera, pie, banda de título de portada y de búsqueda, botón "Ver oferta", enlaces de texto, casillas de filtro activas. Siempre con texto blanco (5.83:1). Como enlace sobre blanco da 5.83:1 y sobre `--fondo` 5.10:1.
- **Acero fuerte** (`--cabecera-fuerte`, `--accion-fuerte`): franja de hechos y hover de los botones acero (blanco encima 7.82:1).
- **Texto suave de cabecera** (`--en-cabecera-suave`): franja de hechos (6.23:1 sobre acero fuerte), pestañas inactivas y entradillas sobre acero (4.64:1).

### Secondary
- **Cian DecideAqui** (`--cian`): botón Buscar, detalle "Aqui" del logotipo, etiqueta "Precio más bajo", marca "Más barato", borde de la fila más barata, barra de orden activo en búsqueda, `::selection` y punto "hoy". Igual en claro y en oscuro.
- **Tinta profunda** (`--en-cian`): lo único que va sobre cian (5.84:1).
- **Resalte** (`--resalte`): fondo de la fila de la oferta más barata (cian al 10 % sobre blanco, opaco).

### Neutral
- **Gris página** (`--fondo` #eef0f3): fondo de todas las páginas.
- **Gris sección** (`--seccion` #e3e6eb): chips de la ficha, hover de controles secundarios, esqueleto, cabecera de la tabla de tiendas.
- **Blanco** (`--superficie`): paneles, tarjetas, filas de ofertas.
- **Grafito** (`--texto`): texto principal, 11.68:1 sobre blanco y 10.23:1 sobre `--fondo`.
- **Gris suave** (`--suave` #5f6070): texto secundario, notas, "leído …", conteos. 6.19:1 sobre blanco, 5.42:1 sobre `--fondo`, 4.95:1 sobre `--seccion`.
- **Borde** (`--borde`): borde de tarjetas, filas de oferta y figura del historial.
- **Borde de control** (`--borde-control` #737a88): botón "Ver en la tienda", casillas de filtro, salidas rápidas. 4.31:1 sobre blanco, 3.78:1 sobre `--fondo`, 3.45:1 sobre `--seccion`; también hover de borde de la tarjeta.
- **Arena** (`--arena`): solo la barra de desplazamiento. Sigue en la paleta, pero ya no se usa como superficie.
- **Foco** (`--foco`): anillo de 2 px en tinta; dentro de `.en-cabecera` el anillo pasa a blanco y en `.sobre-oscuro` a cian.

### Tema oscuro (redefinido en `@media (prefers-color-scheme: dark)`)

| Token | Oscuro | Par medido |
|---|---|---|
| `--fondo` | #1c1c2b | texto 13.85:1 |
| `--seccion` | #25253a | |
| `--superficie` | #2a2a40 | suave 7.25:1 |
| `--texto` | #efe8e3 | |
| `--suave` | #b9bac6 | |
| `--borde` | #4a4a66 | |
| `--borde-control` | #8a90a0 | sobre superficie 4.37:1 |
| `--accion-fuerte` | #3f7ba3 | blanco 4.59:1 |
| `--borde-accion` | #7fb2d4 | |
| `--enlace` | #8ccbe6 | sobre superficie 7.85:1 |
| `--resalte` | #1f3a4a | texto 9.83:1 |
| `--foco` | #13a9cf | |
| `--serie-1/2/3` | #13a9cf / #cfb8aa / #efe8e3 | |

La cabecera, el pie, `--cian`, `--en-cian`, `--accion` y `--en-accion` no cambian entre temas. Las imágenes de producto viven siempre en un pozo blanco literal (`bg-white`), porque las fotos de tienda vienen recortadas sobre blanco.

### Series del historial
`--serie-1` a `--serie-5` repiten acero, marrón y grafito (en oscuro: cian, arena y crema). Lo que distingue cada tienda es el trazo (continuo, `8 5`, `2 4`, `12 4 2 4`, `1 5`), no el color.

### Named Rules
**The Tinta Profunda Rule.** Todo lo que va sobre cian lleva `--en-cian` (#1F1F33). Nunca blanco, en ningún tema.

**The Cian Señala Rule.** El cian marca el precio y la búsqueda; no es indicador sobre el acero de la cabecera (2.11:1). Ahí los estados activos van en blanco.

**The Un Botón Sólido Rule.** En cada decisión hay un solo botón acero sólido: el de la mejor oferta (recuadro de precio y fila más barata). Las demás ofertas con stock usan contorno acero; las que no tienen stock, contorno gris.

## Typography

**Display Font:** Hanken Grotesk (next/font, variable `--fuente`), con system-ui, sans-serif
**Body Font:** la misma familia

**Character:** una grotesca única, cálida y de lectura rápida; la jerarquía la hacen el tamaño y el peso, no un cambio de familia.

### Hierarchy
- **Display** (800, 2.25rem en móvil a 3rem desde 640 px, -0.025em): titular de la portada.
- **Headline** (800, 1.5rem a 2.25rem, -0.025em): h1 de búsqueda, ficha, tiendas y 404.
- **Title** (700, 1.25rem a 1.5rem, sin tracking): h2 de sección ("Productos en varias tiendas", "Ofertas en 3 tiendas", "Historial de precios") y encabezados de filtros ("Ordenar por", "Mostrar") a 1rem.
- **Body** (400, 1rem, 1.5): párrafos con medida de 60–65ch.
- **Label** (600, 0.875rem): etiquetas, chips, stock y botones. Siempre en mayúscula inicial normal.
- **Nav** (600, 0.875rem, 0.08em, mayúsculas): solo pestañas de categorías. La franja de hechos usa 0.75rem en mayúsculas con tracking ancho.
- **Precio** (800, tabular): 3rem en el recuadro de la ficha, 1.875rem en la fila más barata, 1.5rem en las demás filas y 1.25rem en la tarjeta.

### Named Rules
**The Peso con Motivo Rule.** El peso 800 es solo para h1 y precios. Los h2 van en 700 y las etiquetas en 600.

**The Mayúsculas Contadas Rule.** Mayúsculas forzadas solo en la franja de hechos y en el menú de categorías. Ninguna etiqueta, chip, botón o encabezado de panel va en mayúsculas.

**The Cifra Tabular Rule.** Todo importe y precio del historial usa `tabular-nums`; en las filas de oferta los precios se alinean a la derecha.

## Layout

Contenedor central de 1152 px (`max-w-6xl`) con 16 px de margen lateral; franja, cabecera, contenido y pie comparten ese eje. Ritmo en múltiplos de 4 px: 24 px entre paneles y 20–24 px de relleno dentro de cada uno.

- **Portada:** banda acero (texto y categorías a la izquierda, tres productos en círculos blancos a la derecha), rejilla "Productos en varias tiendas" y línea de tiendas incluidas.
- **Búsqueda:** banda acero con el título y las categorías; debajo, columna de filtros de 15rem y rejilla de 4 columnas desde 1024 px. En móvil los filtros se pliegan en un `details` ("Ordenar y filtrar") que resume los activos.
- **Ficha:** dos columnas desde 1024 px: a la izquierda los paneles de producto, ofertas e historial; a la derecha un recuadro de precio de 21rem fijo (`sticky`) al desplazarse. En móvil todo se apila.
- **Rejilla de productos:** 2 columnas en móvil, 3 desde 640 px, 4 desde 1024 px y 5 desde 1280 px fuera de la búsqueda.
- **Fila de oferta:** en escritorio cuatro columnas (tienda 10rem, título flexible, precio, botón 10rem). En móvil, tienda y precio arriba; título y botón a todo el ancho debajo.
- **Cabecera:** fija desde 640 px. Las pestañas de categorías se ocultan en portada y búsqueda, porque allí la banda ya ofrece las categorías.
- **Historial:** SVG de 480 × 230 que se encoge; el eje sube a 16 px en móvil y baja a 11 px desde 640 px (en unidades del SVG).

Todo control pulsable mide al menos 44 px de alto.

## Elevation & Depth

Sistema plano. La profundidad la hacen el contraste entre el gris de página y el blanco de los paneles, los bordes `--borde` y el pozo blanco de las imágenes. No hay sombras de caja. La única sombra del código es interior (`inset 3px 0 0 var(--cian)`) y marca el orden activo en la columna de filtros.

### Named Rules
**The Plano en Reposo Rule.** Nada flota. Para separar algo se usa un panel, un borde o un fondo tonal. El hover de la tarjeta oscurece su borde y subraya el título; no la eleva.

## Shapes

Tres radios con un papel cada uno:
- **16 px** (`rounded-2xl`): paneles, bandas acero de portada y búsqueda, recuadro de precio y tabla de tiendas.
- **8 px** (`rounded-lg`): tarjetas, filas de oferta, botones, imagen de la ficha, figura del historial, opciones de filtro y esqueleto.
- **Píldora** (`rounded-full`): buscador, categorías, etiqueta "Precio más bajo", marca "Más barato", chips de la ficha y círculos de producto de la portada.

Quedan dos excepciones pequeñas: el detalle "Aqui" del logotipo (6 px) y la casilla de filtro (4 px). El buscador es una sola pieza: campo blanco redondeado a la izquierda y botón cian redondeado a la derecha.

## Components

### Franja de hechos
Primera línea de la cabecera, fondo acero fuerte, texto `--en-cabecera-suave` de 0.75rem en mayúsculas con icono por hecho: "Precios leídos el {día}, {hora}", "Mismo producto por EAN o modelo", "Precio que publica la tienda", "Sin patrocinios". Centrada desde 640 px; en móvil se desliza en horizontal sin barra visible.

### Cabecera y buscador
Fondo acero, logotipo "Decide" en blanco con "Aqui" sobre cian, buscador en píldora (campo blanco con lupa y marcador "Buscar un producto", botón cian "Buscar") y enlace "Tiendas" con icono desde 768 px. Formulario GET que funciona sin JavaScript.

### Pestañas de categorías
Fila centrada bajo el buscador, 44 px, mayúsculas con 0.08em. Inactiva en `--en-cabecera-suave` con subrayado blanco translúcido al pasar el cursor; activa en blanco con subrayado inferior de 3 px y `aria-current`.

### Bandas acero
Panel acero de 16 px en portada ("Encuentre el precio más bajo") y búsqueda ("{N} resultados para «…»"), con píldoras de categoría: activa en blanco con tinta, inactivas con contorno blanco al 60 %.

### Tarjeta de producto
- Borde `--borde`, fondo blanco, 8 px de radio.
- Imagen cuadrada en pozo blanco con 16 px de relleno y filete inferior.
- Cuerpo: título 600 recortado a 4 líneas en móvil y 3 en escritorio; "desde" y precio 800; una sola línea de meta en `--suave`: "En 3 tiendas · más barato en Comandato" cuando hay datos de oferta, "En 3 tiendas" cuando no.
- Toda la tarjeta es enlace (pseudo-elemento que cubre el `article`). Al pasar el cursor el borde pasa a `--borde-control` y el título se subraya. No lleva botón ni etiqueta sobre la imagen.

### Recuadro de precio (ficha)
Panel blanco fijo con etiqueta cian "Precio más bajo" en píldora, precio de 3rem en 800, precio de lista tachado si la tienda lo publica, lista Tienda / Leído / Stock y botón acero sólido "Ver oferta en {tienda}" de 48 px. Debajo no lleva aviso: el aviso único va bajo la lista de ofertas.

### Lista de ofertas
- **Fila más barata:** borde cian de 2 px, fondo `--resalte`, marca "Más barato" en píldora cian junto al precio (encima en móvil), precio 1.875rem y botón acero sólido.
- **Otras filas con stock:** borde `--borde`, fondo blanco, precio 1.5rem y botón de contorno acero.
- **Sin stock:** botón de contorno gris "Ver en la tienda".
- Bajo cada precio, "leído hoy 11:11" en hora de Guayaquil. Si la lectura va más de un día por detrás de la más reciente, añade "· puede haber cambiado" en grafito 600.
- Aviso único debajo: "Precios según la última lectura de cada tienda. Confírmelos en la tienda antes de comprar."

### Filtros de búsqueda
Columna con "Ordenar por" (opciones de 44 px; activa en blanco con barra interior cian a la izquierda) y "Mostrar" (casillas de 20 px: activa acero con check blanco, inactiva con borde `--borde-control`; conteo a la derecha en `--suave`). Son enlaces normales que funcionan sin JavaScript.

### Chips de la ficha
Píldoras `--seccion` en 0.875rem 600: "En 3 tiendas", "Con stock".

### Stock
Icono SVG de trazo (check o aspa) más texto "En stock" / "Sin stock", 0.875rem 600; con stock en `--texto` y sin stock en `--suave`.

### Historial de precios
- Tramos escalonados por tienda con trazo de 2.5 px, color `--serie-n` y patrón de rayas propio; rejilla en `--borde` y ejes en `--suave`.
- Leyenda fuera del SVG: muestra de trazo, nombre de tienda, precio sobre cian y "leído …" sobre `--seccion`.
- Con menos de 7 días no se dibuja: se dice desde cuándo se registra y se listan los cambios. Sin historial: una frase en `--suave`.

### Pie
Fondo acero (igual que la cabecera), texto blanco, logotipo repetido, dos frases de método en registro formal y listas "Buscar" y "Los datos"; foco en blanco.

### Estados de carga y vacío
- **Esqueleto:** bloques `--seccion` de 8 px con pulso de opacidad de 1.4 s que reproducen la rejilla o la ficha.
- **Vacío y 404:** titular, una frase concreta en `--suave` y las salidas rápidas como botones secundarios.

## Do's and Don'ts

### Do:
- **Do** poner `--en-cian` (#1F1F33) sobre todo fondo cian.
- **Do** poner texto blanco sobre el acero (#346A8F) y usar acero para la casa (cabecera, pie, bandas) y para actuar.
- **Do** dejar un único botón sólido por decisión: el de la mejor oferta.
- **Do** escribir en registro formal (usted), con frases cortas y sin explicar lo obvio.
- **Do** mostrar "leído …" en hora de Guayaquil una vez por oferta en la ficha, y "puede haber cambiado" cuando la lectura está atrasada.
- **Do** expresar stock, filtro activo y serie del gráfico con icono, marca o trazo además del color.
- **Do** dar 44 px de alto a todo lo que se pulsa y mantener visible el foco de 2 px.

### Don't:
- **Don't** usar el cian como indicador sobre el acero de la cabecera (2.11:1).
- **Don't** poner mayúsculas forzadas fuera de la franja de hechos y del menú de categorías.
- **Don't** usar peso 800 en h2, etiquetas o botones.
- **Don't** repetir el aviso de confirmar el precio: va una sola vez, bajo las ofertas.
- **Don't** añadir botones, etiquetas sobre la imagen ni sombras a la tarjeta de producto.
- **Don't** repetir en la página los hechos que ya dice la franja de la cabecera.
- **Don't** dibujar el historial con menos de 7 días de datos.
- **Don't** introducir una segunda familia tipográfica.
