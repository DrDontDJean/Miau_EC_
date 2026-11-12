---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: []
---

# Surface brief: portada (src/app/page.tsx)

Scope: solo la portada. Mode: Persuade (escaparate de tienda). /buscar y /p/[id] siguen en Operate bajo el brief src-app-layout-tsx.

Audience and job: comprador en Ecuador que llega sin un producto decidido o a curiosear. Debe sentir que entra a una tienda con escaparate, no a un panel, y empezar a navegar: elegir una categoría, abrir un producto o buscar.

Reference: Freshbox (tienda online) como estructura: hero con producto o categorías visuales, fila de categorías con icono y estado activo, rejillas de producto limpias. Solo estructura y armonía; nada de su marca, textos ni imágenes.

Visual world: hereda la paleta y la tipografía del brief src-app-layout-tsx (cian #13A9CF con tinta #1F1F33, azul acero #346A8F, grafito #36364F, arena, Hanken Grotesk).

Constraints:
- Sin cambiar consultas a Supabase: la portada solo tiene productosDestacados (id, título, marca, imagen, precio desde, nº de tiendas) y tiendasActivas. No hay datos de bajada de precio en la portada.
- Imágenes de producto reales de las tiendas; nada inventado.
- Iconos dibujados en SVG, no emoji.
- Texto secundario en grafito o gris neutro, no marrón.
- Sello cian más ligero y no repetido en cada tarjeta; sin "leído…" en tarjetas.
- Sin bloque "Cómo comparamos" en la portada (como mucho una línea en el pie).
- Barra superior sin "confirma siempre en la tienda".

Problems to solve: mitad derecha del hero vacía; bloque arena apagado; marrón sucio; sello pesado y repetido.

Unresolved: variante de portada pendiente de elección del usuario; dirección y contrato se fijan tras la elección.
