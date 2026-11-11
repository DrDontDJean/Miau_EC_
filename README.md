# DecideAqui

Comparador de precios de tiendas online de **Ecuador**, inspirado en cómo funciona idealo: un worker lee el
catálogo de cada tienda una vez al día, agrupa las ofertas del mismo producto y la web muestra
"N tiendas desde $X", llevando al comprador a la tienda por un redirector que registra la salida.

Monorepo con npm workspaces (Node.js 24 o superior):

| Carpeta | Qué es |
|---|---|
| `apps/web` | Web en Next.js 16 (App Router, Cache Components): inicio, `/buscar`, `/p/[id]` con historial de precios, `/tiendas`, `/api/buscar` e `/ir/[id]` |
| `packages/dominio` | Reglas puras: `validar` (calidad de datos) y `claveDeProducto` (EAN o código de modelo) |
| `packages/ingesta` | Worker: fuentes VTEX, WooCommerce y feed; robots.txt; `ejecutarCorrida` contra Supabase |
| `supabase/` | Migraciones (OLTP, ingesta y calidad, seguridad, ROLAP) y `seed.sql` |
| `prototipo/` | Primera versión, que consultaba las tiendas en vivo en cada búsqueda |
| `tests/carga/` | Pruebas k6 (humo, carga, estrés, pico), de ejecución manual |

```bash
npm install
npm test                    # todas las pruebas: prototipo, dominio, ingesta (contra PGlite) y web
npm run validar:esquema     # migraciones + escenario de ingesta en Postgres (PGlite)
npm run dev                 # web en http://localhost:3000 (lee las claves del .env de la raíz)
npm run ingesta             # corrida de todas las tiendas activas contra DATABASE_URL
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

Activas: Comandato, Novicompu, Kywi, Pycca (VTEX) y Computron (WooCommerce). Créditos Económicos,
Almacenes Japón, Orve Hogar y Marcimex quedan `sin_permiso` porque su robots.txt prohíbe la búsqueda
(`Disallow: /*?`); pueden entrar con un feed acordado (`plataforma = 'feed'`, `url_feed`).

## Limitaciones conocidas

- La búsqueda también encuentra accesorios ("televisor 55" devuelve soportes). Falta filtrar por categoría.
- El código de modelo no sirve para ferretería ni hogar (Kywi, Pycca): esas ofertas quedan como producto propio.
- Mercado Libre Ecuador no está incluido: su API de búsqueda pide autenticación de aplicación.
