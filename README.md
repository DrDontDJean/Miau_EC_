# DecideAqui

Comparador de precios de tiendas online de **Ecuador**, inspirado en cómo funciona idealo: un worker lee el
catálogo de cada tienda una vez al día, agrupa las ofertas del mismo producto y la web muestra
"N tiendas desde $X", llevando al comprador a la tienda por un redirector que registra la salida.

Monorepo con npm workspaces (Node.js 24 o superior):

| Carpeta | Qué es |
|---|---|
| `apps/web` | Web en Next.js 16 (App Router, Cache Components): inicio, `/buscar`, `/p/[id]` con historial de precios, `/tiendas`, `/api/buscar` e `/ir/[id]` |
| `packages/dominio` | Reglas puras: `validar` (calidad de datos) y `claveDeProducto` (EAN o código de modelo) |
| `packages/ingesta` | Worker: fuentes VTEX, WooCommerce, Shopify, Magento, Frecuento, sitemap con datos estructurados y feed; robots.txt; `ejecutarCorrida` contra Supabase |
| `supabase/` | Migraciones (OLTP, ingesta y calidad, seguridad, ROLAP) y `seed.sql` |
| `prototipo/` | Primera versión, que consultaba las tiendas en vivo en cada búsqueda |
| `tests/carga/` | Pruebas k6 (humo, carga, estrés, pico), de ejecución manual |

```bash
npm install
npm test                    # todas las pruebas: prototipo, dominio, ingesta (contra PGlite) y web
npm run validar:esquema     # migraciones + escenario de ingesta en Postgres (PGlite)
npm run dev                 # web en http://localhost:3000 (lee las claves del .env de la raíz)
npm run ingesta             # corrida de las tiendas activas y sin permiso (se revisan) contra DATABASE_URL
LIMITE_PAGINAS=2 npm run ingesta   # corrida corta de prueba (cierra como 'parcial')
node --env-file=.env scripts/resumen-catalogo.mjs   # resumen de solo lectura de lo cargado
```

El `.env` lo crea `bash scripts/wizard-configuracion.sh` (GitHub, Supabase y Vercel). Ver `.env.example`.

## Despliegue

- **Web (Vercel):** proyecto con Root Directory `apps/web`; la región `iad1` está en `apps/web/vercel.json`. Solo lleva
  `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, de tipo **Config** (son públicas por diseño), sin comillas.
  Vercel instala solo `apps/web`, así que toda dependencia que use la web, incluidas las de sus pruebas, va en su `package.json`.
- **Autor de los commits:** el plan Hobby solo despliega commits de la cuenta dueña del proyecto de Vercel. Configura en
  el repositorio `git config user.email` con el email noreply de esa cuenta de GitHub.
- **Replicar el proyecto en otras cuentas:** [GUIA-REPLICA.md](GUIA-REPLICA.md).
- **Base (Supabase):** `migraciones.yml` aplica `supabase/migrations` al hacer push a `main`.
- **Ingesta:** `ingesta.yml` corre a diario a las 06:17 UTC (ADR 0008); también a mano con "Run workflow".

## Documentación

- [docs/arquitectura.md](docs/arquitectura.md): ingesta, OLTP + ROLAP, diseño de la base, calidad de datos, stack, pruebas y CI/CD
- [docs/adr/](docs/adr/): decisiones y por qué
- [GLOSSARY.md](GLOSSARY.md): vocabulario del dominio (oferta, producto, corrida, cuarentena, salida…)

## Tiendas

24 tiendas activas, según cómo se lee cada una (ADR 0009):

| Fuente | Tiendas |
|---|---|
| API VTEX | Comandato, Novicompu, Kywi, Pycca, Marcimex y SuperPaco |
| API WooCommerce | Computron |
| API Shopify | Colineal, EkuStore, NewStore y Randall Tech |
| API Magento (GraphQL) | La Ganga y Pintulac |
| API propia | Frecuento |
| Sitemap + datos estructurados de cada página de producto | Créditos Económicos, Almacenes Japón, Orve Hogar, Artefacta, Coral, TIA, Sukasa, Tventas, Almacenes Boyacá y Fybeca |

Créditos Económicos, Almacenes Japón, Orve Hogar, Artefacta y Coral prohíben su API de catálogo en el robots.txt
(`Disallow: /*?`), pero permiten sus páginas de producto: se leen por sitemap. Siguen sin poder leerse, y entran solo con
un feed o un permiso ([docs/feed-tiendas.md](docs/feed-tiendas.md)): Smart Home EC (su robots.txt prohíbe todo el sitio,
`sin_permiso`) y De Prati, El Bárbaro y Steren Ecuador (responden 403 a todo acceso automático, o a las direcciones de GitHub Actions en el caso de Steren; `pausada`). Una tienda `sin_permiso`
vuelve sola a `activa` cuando su robots.txt lo permite.

## Limitaciones conocidas

- La búsqueda también encuentra accesorios ("televisor 55" devuelve soportes), aunque ahora van después de los productos
  (salvo que se busque uno, como "soporte tv"). Falta una categoría real por producto para poder filtrar.
- El código de modelo no sirve para ferretería ni hogar (Kywi, Pycca): esas ofertas quedan como producto propio.
- Mercado Libre Ecuador no está incluido: su API de búsqueda pide autenticación de aplicación.
- Las tiendas leídas por sitemap se revisan por tandas (2.500 páginas por corrida, a 1 por segundo): el precio de una
  oferta puede tener entre 1 y unos 8 días. La web muestra cuándo se actualizó cada oferta.
- Una categoría VTEX de más de 5.000 productos sin subcategorías no se alcanza completa: la corrida de esa tienda queda
  `parcial` y no desactiva nada. Lo mismo ocurre si el robots.txt de la tienda prohíbe el orden por nombre.
- Una oferta agotada que nunca se vio con precio no se publica: no hay ningún precio que conservar.
- Frecuento no entrega las variantes de sus productos en su lista (solo el producto): se publica una oferta por producto.
