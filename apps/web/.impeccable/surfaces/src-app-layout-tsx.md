---
version: 1
slug: "src-app-layout-tsx"
primary_target: "src/app/layout.tsx"
related_targets: ["src/app/page.tsx","src/app/buscar/page.tsx","src/app/p/[id]/page.tsx","src/app/tiendas/page.tsx","src/app/not-found.tsx"]
---

# Surface brief: apps/web (rediseño completo)

Scope: inicio, /buscar, /p/[id], /tiendas, 404, cabecera y pie. Mode: Operate.

Audience and job: comprador en Ecuador, móvil primero, busca un producto concreto, quiere saber dónde está más barato y si conviene esperar. Acción: buscar, abrir ficha, salir por "Ver oferta".

Constraints: no cambiar rutas, consultas a Supabase (buscar_productos), /ir ni pruebas. Filtros solo sobre los datos que llegan. Sin dependencias pesadas. Next 16 Cache Components, Tailwind 4. Tuteo, vocabulario de GLOSSARY.md. Tema claro y oscuro. Objetivos táctiles de 44 px. Fuera: comparación lado a lado, alertas, búsquedas recientes.

Confirmed adjustments: hora del sello en America/Guayaquil calculada de visto_ultima_vez; bloque de confianza solo con hechos verificables (EAN o modelo, precio que publica la tienda, actualizado cada día, sin patrocinios); tienda sin corrida completa: "Última lectura incompleta · reintentamos cada día"; Hanken Grotesk con next/font; logo solo texto con detalle cian; frescura global en el inicio.

Unresolved: ninguna.

Roll note: un concept-seed de dirección (seed:b180c890518ed0ed) quedó registrado en .impeccable/questions/roll.json; su mano se descartó porque el usuario fijó la dirección completa (paleta, estructura de referencia y gesto). FORM queda como pinned.

## Direction contract

THESIS: el precio nunca aparece sin su fecha. Rechaza el comparador genérico de cabecera azul, chip amarillo "mejor precio" y ofertas desplegadas en el listado.

OWN-WORLD: cian #13A9CF para marca, barra de aviso, sello de precio y pestaña activa, siempre con tinta profunda #1F1F33. Azul acero #346A8F para "Ver oferta" y enlaces con texto blanco. Grafito #36364F para texto. Arena #CFB8AA y su tono claro #F3ECE7 para fondos de sección. Marrón #7A5B4E para texto secundario. Hanken Grotesk, cifras tabulares. Tarjetas de producto con imagen arriba, esquinas de 12 px, bordes arena.

STORY: el visitante entiende que cada precio viene de una tienda y tiene hora de lectura; cree porque ve la fecha junto al precio y el aviso de confirmar; busca, abre la ficha y sale a la tienda.

FIRST VIEWPORT: barra cian fina con la frescura global; cabecera blanca con el nombre DecideAqui a la izquierda y el buscador ancho con botón acero; debajo, fila de pestañas de búsquedas rápidas; luego el titular y la rejilla de productos destacados, cada uno con su sello de precio. La acción primaria es el buscador de la cabecera.

FORM: estructura de tienda online tipo catálogo (barra de aviso, cabecera con buscador, pestañas, rejilla, bloque de confianza, pie en columnas). Signature move: el sello de precio, precio y hora de lectura como una sola pieza sobre cian, repetido en tarjeta, ficha y como punto "hoy" del historial. seed: none (pinned) "Toma de ella: organización, distribución de espacios, pestañas, y la forma de presentar productos e información" + "PALETA (sustituye a la actual)" + "precio con fecha e historial como gesto visual".

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
