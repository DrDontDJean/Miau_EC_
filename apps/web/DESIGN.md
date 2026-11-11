---
name: DecideAqui
description: Comparador honesto de precios entre tiendas online de Ecuador; cada precio lleva su hora de lectura.
colors:
  fondo: "#ffffff"
  seccion: "#f3ece7"
  superficie: "#ffffff"
  texto: "#36364f"
  suave: "#7a5b4e"
  borde: "#e0d2c8"
  arena: "#cfb8aa"
  borde-control: "#957868"
  cian: "#13a9cf"
  en-cian: "#1f1f33"
  accion: "#346a8f"
  accion-fuerte: "#2a5675"
  en-accion: "#ffffff"
  borde-accion: "#346a8f"
  enlace: "#346a8f"
  arena-fondo: "#cfb8aa"
  pie: "#36364f"
  en-pie: "#f3ece7"
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
    fontSize: "2.25rem"
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
  precio-sello-grande:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1.1
    fontFeature: "tnum"
  precio-sello:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 1.4
    fontFeature: "tnum"
  precio-oferta:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.33
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
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  6: "24px"
  8: "32px"
  10: "40px"
  12: "48px"
  objetivo-tactil: "44px"
  contenedor: "1152px"
components:
  barra-aviso:
    backgroundColor: "{colors.cian}"
    textColor: "{colors.en-cian}"
    typography: "{typography.label}"
    padding: "6px 16px"
  sello-precio:
    backgroundColor: "{colors.cian}"
    textColor: "{colors.en-cian}"
    typography: "{typography.precio-sello}"
    rounded: "{rounded.lg}"
    padding: "4px 10px"
  sello-hora:
    backgroundColor: "{colors.arena-fondo}"
    textColor: "{colors.texto}"
    padding: "4px 10px"
  boton-oferta:
    backgroundColor: "{colors.accion}"
    textColor: "{colors.en-accion}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "44px"
  boton-oferta-hover:
    backgroundColor: "{colors.accion-fuerte}"
    textColor: "{colors.en-accion}"
  boton-secundario:
    backgroundColor: "transparent"
    textColor: "{colors.texto}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "44px"
  boton-secundario-hover:
    backgroundColor: "{colors.seccion}"
  buscador-campo:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "44px"
  buscador-boton:
    backgroundColor: "{colors.accion}"
    textColor: "{colors.en-accion}"
    rounded: "{rounded.lg}"
    padding: "0 20px"
    height: "44px"
  opcion:
    backgroundColor: "transparent"
    textColor: "{colors.texto}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "44px"
  opcion-activa:
    backgroundColor: "{colors.cian}"
    textColor: "{colors.en-cian}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "44px"
  pestana:
    textColor: "{colors.suave}"
    padding: "0 12px"
    height: "44px"
  pestana-activa:
    textColor: "{colors.texto}"
  tarjeta-producto:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.xl}"
    padding: "12px"
  banda-confianza:
    backgroundColor: "{colors.arena-fondo}"
    textColor: "{colors.texto}"
    rounded: "{rounded.2xl}"
    padding: "32px 20px"
  pie:
    backgroundColor: "{colors.pie}"
    textColor: "{colors.en-pie}"
    padding: "40px 16px"
---

# Design System: DecideAqui

## Overview

**Creative North Star: "El precio con fecha"**

DecideAqui es un catálogo de tienda online leído con honestidad: barra de aviso, cabecera con buscador ancho, pestañas de búsquedas rápidas, rejilla de productos, bloque de confianza y pie en columnas. La estructura es familiar a propósito; lo propio está en un único gesto que se repite en todas partes: el sello de precio, donde la cifra sobre cian y la hora de lectura sobre arena forman una sola pieza. Ningún precio aparece suelto.

La paleta separa funciones con disciplina. El cian es la marca y la señal de "esto es un precio o una lectura"; el azul acero es la única voz para actuar (comparar, ver oferta, enlaces); el grafito lee; la arena separa y respalda. La densidad es de catálogo: rejilla de 2 a 5 columnas, filas de ofertas apretadas, cifras tabulares en negrita extrema. El sistema funciona en claro y en oscuro con los mismos papeles; el cian y su tinta profunda no cambian entre temas.

Rechazo confirmado: el comparador genérico de cabecera azul, chip amarillo de "mejor precio" y ofertas desplegadas dentro del listado.

**Key Characteristics:**
- Un solo gesto de firma, el sello de precio, repetido en tarjeta, ficha, fila de ofertas, leyenda del historial y punto "hoy" del gráfico.
- Cian siempre con tinta profunda; acero siempre con blanco.
- Plano: profundidad por bordes arena y fondos tonales; una sola sombra, en el hover de la tarjeta.
- Significado nunca solo por color: icono + texto en stock, trazo + color en series, marca de verificación en filtros activos.
- Toda hora se muestra en America/Guayaquil.
- Objetivos táctiles de 44 px en todo lo que se pulsa.

## Colors

Paleta de catálogo cálido: cian de marca, azul acero para actuar, grafito para leer, arena para separar.

### Primary
- **Cian DecideAqui** (`--cian`): marca y señal de precio. Fondo de la barra de aviso, del detalle "Aqui" del logotipo, de la cifra del sello, de la opción de filtro activa, del subrayado de la pestaña activa, de `::selection` y del punto "hoy" del historial. Es el mismo valor en claro y en oscuro.
- **Tinta profunda** (`--en-cian`): el único color de texto o trazo permitido sobre cian (5.84:1). También es el contorno del punto "hoy".

### Secondary
- **Azul acero** (`--accion`, `--borde-accion`, `--enlace`): la voz de actuar. Botón "Comparar" del buscador, botón "Ver oferta", enlaces de texto subrayados. Siempre con texto blanco (`--en-accion`, 5.83:1).
- **Acero fuerte** (`--accion-fuerte`): hover de los botones acero (blanco encima 7.82:1 en claro; en oscuro sube a un acero más claro, 4.59:1).

### Neutral
- **Grafito** (`--texto`): todo el texto principal, 11.68:1 sobre fondo blanco. En claro también es el color del pie (`--pie`).
- **Marrón tierra** (`--suave`): texto secundario, notas, metadatos de oferta, pestañas inactivas, ejes del gráfico. 6.12:1 sobre blanco, 5.23:1 sobre `--seccion`.
- **Arena** (`--arena`): subrayado hover de pestaña y barra de desplazamiento.
- **Borde de control** (`--borde-control`): borde del campo de búsqueda, de las pastillas de orden, filtro y salida, y del botón "Ver en la tienda". Claro #957868: 4.07:1 sobre blanco y 3.48:1 sobre `--seccion`; oscuro #9c8578: 4.83:1 sobre `--fondo`, 4.02:1 sobre `--superficie` y 4.30:1 sobre `--seccion`. Nunca se sustituye por `--arena`, que no llega a 3:1.
- **Arena de fondo** (`--arena-fondo`): mitad horaria del sello, banda "Cómo comparamos", cabecera de la tabla de tiendas. Sobre ella solo va `--texto` (6.17:1).
- **Lino** (`--seccion`): hover de controles secundarios y color del esqueleto de carga.
- **Borde cálido** (`--borde`): divisores de lista, borde de tarjetas, cabecera, figura del historial y tabla.
- **Blanco** (`--fondo`, `--superficie`): página y tarjetas.
- **Crema de pie** (`--en-pie`): texto del pie sobre grafito (9.99:1).
- **Foco** (`--foco`): anillo de foco de 2 px; en zonas `.sobre-oscuro` el anillo pasa a cian.

### Tema oscuro (valores redefinidos en `@media (prefers-color-scheme: dark)`)

| Token | Oscuro | Par medido |
|---|---|---|
| `--fondo` | #1c1c2b | texto 13.85:1 |
| `--seccion` | #25253a | texto 12.33:1 |
| `--superficie` | #2a2a40 | texto 11.52:1, suave 7.38:1 |
| `--texto` | #efe8e3 | |
| `--suave` | #cfb8aa | sobre fondo 8.87:1 |
| `--borde` | #4a4a66 | |
| `--arena` | #7a5b4e | |
| `--borde-control` | #9c8578 | 4.02:1 a 4.83:1 contra fondos |
| `--accion-fuerte` | #3f7ba3 | blanco 4.59:1 |
| `--borde-accion` | #7fb2d4 | sobre fondo 7.37:1 |
| `--enlace` | #8ccbe6 | sobre fondo 9.44:1 |
| `--arena-fondo` | #4a3a33 | texto 8.91:1 |
| `--pie` | #141421 | en-pie 15.60:1 |
| `--foco` | #13a9cf | sobre fondo 6.08:1 |
| `--serie-1/2/3` | #13a9cf / #cfb8aa / #efe8e3 | |

`--cian`, `--en-cian`, `--accion`, `--en-accion` y `--en-pie` no cambian entre temas. Las imágenes de producto viven siempre en un pozo blanco literal (`bg-white`), también en oscuro, porque las fotos de tienda vienen recortadas sobre blanco.

### Series del historial
`--serie-1` a `--serie-5` repiten la paleta fijada (acero, marrón, grafito; en oscuro cian, arena, crema). `--serie-4` y `--serie-5` repiten a 1 y 2: lo que distingue cada tienda es el trazo (continuo, `8 5`, `2 4`, `12 4 2 4`, `1 5`), no el color.

### Named Rules
**The Tinta Profunda Rule.** Todo lo que va sobre cian lleva `--en-cian` (#1F1F33). Nunca blanco, nunca grafito, en ningún tema.

**The Acero con Blanco Rule.** El azul acero (#346A8F) es fondo de acción con texto blanco, o color de enlace subrayado sobre fondo claro. No se usa como superficie decorativa.

**The Arena sin Suave Rule.** Sobre `--arena-fondo` claro solo va `--texto`; `--suave` cae a 3.23:1 y no se usa ahí.

## Typography

**Display Font:** Hanken Grotesk (next/font, variable `--fuente`), con system-ui, sans-serif
**Body Font:** la misma familia

**Character:** una grotesca única, cálida y de lectura rápida; la jerarquía la hacen el peso (de 400 a 800) y el tamaño, no un cambio de familia. Las cifras de precio van siempre en `tabular-nums` y peso 800.

### Hierarchy
- **Display** (800, 1.875rem en móvil a 3rem desde 640 px, interlínea 1.25, -0.025em): titular del inicio, máximo 22ch.
- **Headline** (800, 1.5rem a 2.25rem, -0.025em): h1 de ficha, búsqueda, tiendas y 404 (1.5–1.875rem en búsqueda/tiendas/404, hasta 2.25rem en la ficha).
- **Title** (700, 1.25rem): h2 de sección ("Ofertas por tienda", "Historial de precios", "Cómo comparamos"); nombre de tienda en la fila de ofertas a 1.125rem.
- **Body** (400, 1rem, 1.5): párrafos con medida de 60–65ch; entradillas a 1.125rem en `--suave`.
- **Label** (600, 0.875rem): barra de aviso, chips de orden y filtro, stock, notas. Sin mayúsculas forzadas ni tracking ancho en ninguna etiqueta.
- **Precio** (800, tabular): 2.25rem en el sello grande de ficha, 1.5rem en filas de oferta, 1.25rem en el sello de tarjeta. La palabra "desde" y la hora van a 0.75–1rem.

### Named Rules
**The Cifra Tabular Rule.** Todo importe, fecha de tabla y precio del historial usa `tabular-nums`; los precios en lista se alinean a la derecha.

**The Un Solo Rostro Rule.** No se añade una segunda familia tipográfica; el contraste viene del peso 800 frente al 400.

## Layout

Contenedor central de 1152 px (`max-w-6xl`) con 16 px de margen lateral en todos los anchos; la cabecera, las pestañas, el contenido y el pie comparten ese eje. Ritmo en múltiplos de 4 px (escala de Tailwind): 12 px de relleno en tarjeta, 12–16 px de separación en rejilla, 32–48 px entre secciones del inicio, 40 px en la ficha.

- **Rejilla de productos:** 2 columnas en móvil, 3 desde 640 px, 4 desde 1024 px, 5 desde 1280 px.
- **Ficha:** imagen de 240 px a la izquierda y título + sello a la derecha desde 640 px; apilado en móvil.
- **Fila de ofertas:** en escritorio cuatro columnas (tienda 10rem, título flexible, precio, botón 10rem); en móvil tienda + precio arriba, título y botón a ancho completo debajo.
- **Cabecera:** fija (`sticky`) desde 640 px; en móvil se desplaza. Las pestañas se deslizan horizontalmente sin barra visible.
- **Controles de búsqueda:** en móvil plegados en un `details` ("Ordenar y filtrar") para que los precios entren en la primera pantalla; en escritorio, a la vista entre dos filetes.
- **Pie:** tres columnas (2fr 1fr 1fr) desde 640 px.
- **Historial:** SVG de 480 × 230 que se encoge; el texto del eje sube a 16 px en móvil y baja a 11 px desde 640 px para mantener la lectura (pasos `eje-grafico-movil` y `eje-grafico`, en unidades del SVG: unos 11 px reales en móvil y 13 px en escritorio).

Todo control pulsable mide al menos 44 px de alto.

## Elevation & Depth

Sistema plano. La profundidad se construye con bordes `--borde`, fondos tonales (`--seccion`, `--arena-fondo`) y el contraste entre el pozo blanco de la imagen y la superficie. Hay una sola sombra en todo el producto, y aparece solo como respuesta al hover de la tarjeta de producto.

### Shadow Vocabulary
- **Elevación de tarjeta** (`box-shadow: 0 8px 20px -10px rgb(31 31 51 / 0.45)`, transición 200 ms): hover de la tarjeta de producto, que es enlace en toda su superficie.

### Named Rules
**The Plano en Reposo Rule.** Nada tiene sombra en reposo. Si un elemento necesita separarse, recibe borde o fondo tonal, no sombra.

## Shapes

Esquinas suaves y consistentes por escala de tamaño: 8 px para todo lo que se pulsa o se lee como pieza (sello, botones, campo, chips, esqueleto), 12 px para contenedores (tarjeta, pozo de imagen de ficha, figura del historial, tabla), 16 px para la banda de confianza, 6 px para el detalle "Aqui" del logotipo, 4 px para el mini sello de la leyenda. El buscador es una sola pieza: campo redondeado a la izquierda y botón acero redondeado a la derecha, sin hueco. Las listas de ofertas y cambios no son tarjetas: van entre filetes superiores e inferiores con divisores. El sello recorta (`overflow-hidden`) sus dos mitades para que lean como un único objeto.

## Components

### Sello de precio (firma)
Precio y hora de lectura como una sola pieza.
- **Forma:** bloque de esquinas 8 px que recorta dos franjas.
- **Mitad de precio:** fondo `--cian`, tinta `--en-cian`, "desde" opcional en 600 y cifra en 800 tabular.
- **Mitad de hora:** fondo `--arena-fondo`, texto `--texto`, "leído hoy 11:11" / "ayer" / "9 nov 01:17" en hora de Guayaquil.
- **Tamaños:** compacto en tarjeta (apilado, 4 × 10 px de relleno); grande en ficha (8 × 16 px, apilado en móvil y en fila desde 640 px).
- **Variantes:** en la fila de ofertas, solo la oferta que da el "precio desde" lleva sello; las demás muestran la cifra en grafito con "leído …" debajo en `--suave`. En la leyenda del historial, un mini sello de 4 px de radio. En el gráfico, el punto "hoy" es un círculo cian de radio 5 con contorno de tinta profunda.
- **Estado atrasado:** una oferta leída más de un día antes que la más reciente pierde la hora gris y muestra "leído … · puede haber cambiado" en grafito 600 (en el sello: "Puede haber cambiado" debajo).

### Barra de aviso
Franja cian a todo el ancho sobre la cabecera, texto de 0.875rem en tinta profunda: la lectura global más reciente en 600 y "· confirma siempre en la tienda" en 400. Se acorta en móvil y nunca salta de línea.

### Botones
- **Forma:** 8 px, 44 px de alto, texto en 600.
- **Primario ("Ver oferta", "Comparar"):** fondo `--accion`, borde `--borde-accion`, texto blanco; hover `--accion-fuerte` con `transition-colors`.
- **Secundario ("Ver en la tienda", salidas rápidas):** transparente, borde `--borde-control`, texto `--texto`; hover fondo `--seccion`. Se usa cuando la oferta no tiene stock.
- **Enlace de texto:** `--enlace`, subrayado, 600, en un área de 44 px.

### Chips de orden y filtro
- **Reposo:** borde `--borde-control`, texto `--texto` 0.875rem 600, 44 px de alto; hover `--seccion`.
- **Activo:** fondo y borde `--cian`, tinta profunda y una marca de verificación SVG delante. El estado activo se lee por la marca, no solo por el color. Son enlaces normales que funcionan sin JavaScript.

### Tarjeta de producto
- **Esquinas:** 12 px, borde `--borde`, fondo `--superficie`.
- **Imagen:** pozo blanco 4:3 con 12 px de relleno y filete inferior; `object-contain`.
- **Cuerpo:** 12 px de relleno; título 600 recortado a 4 líneas en móvil y 3 en escritorio; sello abajo; nota en `--suave` ("3 tiendas · más barato en Comandato").
- **Interacción:** toda la tarjeta es enlace (pseudo-elemento que cubre el `article`); hover subraya el título y aplica la elevación de tarjeta.

### Campo de búsqueda
Campo de 44 px, borde `--borde-control` sin lado derecho, fondo `--superficie`, marcador en `--suave`, unido al botón acero "Comparar". Formulario GET que funciona sin JavaScript.

### Navegación
- **Pestañas de búsquedas rápidas:** fila bajo el buscador, 44 px, texto 600 en `--suave`; hover subrayado inferior de 3 px en `--arena` y texto `--texto`; activa con subrayado `--cian` y `aria-current`.
- **Pie:** fondo `--pie`, texto `--en-pie`, logotipo repetido, listas de enlaces con subrayado al hover; foco cian (`.sobre-oscuro`).

### Stock
Icono SVG de trazo (check o aspa) más texto "En stock" / "Sin stock", 0.875rem 600; en stock en `--texto`, sin stock en `--suave`.

### Historial de precios
- Tramos escalonados por tienda con trazo de 2.5 px; color de `--serie-n` y patrón de rayas propio. Rejilla horizontal en `--borde`, ejes en `--suave`.
- Leyenda fuera del SVG, en lista: muestra de trazo, nombre de tienda y mini sello.
- **Menos de 7 días:** no se dibuja; se dice con palabras desde cuándo se guarda y se listan los cambios registrados. **Sin historial:** una frase en `--suave`.
- Cambios registrados en lista con divisores: "Kywi bajó de $X a **$Y**" y la fecha a la derecha.

### Estados de carga y vacío
- **Esqueleto:** bloques `--seccion` de 8 px con pulso de opacidad 1.4 s (`latido`) que reproducen la forma de la rejilla o de la ficha.
- **Vacío y 404:** titular, una frase concreta en `--suave` y las salidas rápidas como botones secundarios.

## Do's and Don'ts

### Do:
- **Do** poner `--en-cian` (#1F1F33) sobre todo fondo cian, en claro y en oscuro.
- **Do** poner texto blanco sobre el azul acero (#346A8F) y usar acero solo para actuar o enlazar.
- **Do** acompañar cada precio con su hora de lectura en America/Guayaquil ("leído hoy 01:17"), y marcar "puede haber cambiado" cuando la lectura va más de un día por detrás.
- **Do** expresar stock, filtro activo y serie del gráfico con icono, marca o trazo además del color.
- **Do** usar `tabular-nums` y peso 800 en todas las cifras de precio.
- **Do** dar 44 px de alto a todo lo que se pulsa y mantener el foco visible de 2 px.
- **Do** mostrar las imágenes de producto en un pozo blanco con `object-contain`.

### Don't:
- **Don't** usar cabecera azul, chip amarillo de "mejor precio" ni desplegar las ofertas dentro del listado de resultados.
- **Don't** mostrar un precio sin su hora de lectura donde esa hora existe.
- **Don't** poner `--suave` sobre `--arena-fondo` claro (3.23:1).
- **Don't** añadir sombras en reposo; la única sombra es el hover de la tarjeta.
- **Don't** dibujar el historial con menos de 7 días de datos.
- **Don't** introducir una segunda familia tipográfica.
