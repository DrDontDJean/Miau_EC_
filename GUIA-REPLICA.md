# Guía para replicar DecideAqui

Con esta guía otra persona levanta el mismo producto en **sus propias cuentas**: un comparador de precios de tiendas
online de Ecuador. Tiene ingesta diaria de catálogos, base en Supabase, web en Vercel, CI en GitHub y pruebas de carga
con k6.

El paquete trae todo el código, las migraciones, las pruebas, los workflows y la documentación. **No trae** ninguna
clave, contraseña, URL de proyecto, dato cargado ni historial de git del autor original. Cada quien crea sus propias
cuentas y secretos. Los datos de precios se generan solos con la primera ingesta.

Tiempo estimado: unas 2 horas la primera vez, contando la ingesta completa (hasta una hora) y las pruebas de carga (25 minutos).

---

## Índice

0. [Para quien entrega: cómo pasar el proyecto sin exponer nada](#0-para-quien-entrega-cómo-pasar-el-proyecto-sin-exponer-nada)
1. [Qué necesitas](#1-qué-necesitas)
2. [Qué hay en el paquete](#2-qué-hay-en-el-paquete)
3. [Preparar la copia local](#3-preparar-la-copia-local)
4. [Cuentas y secretos con el wizard](#4-cuentas-y-secretos-con-el-wizard)
5. [Primer despliegue: GitHub y Supabase](#5-primer-despliegue-github-y-supabase)
6. [La web en Vercel](#6-la-web-en-vercel)
7. [Operación diaria](#7-operación-diaria)
8. [Pruebas de carga con k6](#8-pruebas-de-carga-con-k6)
9. [Si cambias el nombre del producto](#9-si-cambias-el-nombre-del-producto)
10. [Reglas que no se deben romper](#10-reglas-que-no-se-deben-romper)
11. [Problemas conocidos y su solución](#11-problemas-conocidos-y-su-solución)
12. [Lista final de verificación](#12-lista-final-de-verificación)

---

## 0. Para quien entrega: cómo pasar el proyecto sin exponer nada

### Genera el paquete

Desde la carpeta del proyecto:

```bash
node scripts/empaquetar-entrega.mjs
```

Crea `DecideAqui-entrega.zip` **fuera** del proyecto, en la carpeta de arriba, para que nunca acabe en un commit. El script:

- Incluye solo los archivos versionados y los nuevos que no están ignorados. **Deja fuera** `.env`, `.git`
  (historial y autores), `node_modules`, `.next` (el build, que lleva dentro la URL de tu Supabase),
  `.vercel`, `supabase/.temp` y `prototipo/data/clics.jsonl`.
- Busca dentro de cada archivo los valores reales de tu `.env`: contraseña, URI de conexión, claves, ref del proyecto,
  host y usuario de la base, y el repositorio. También busca los emails de tu configuración de git y patrones de claves
  (`sb_secret_`, `sb_publishable_`, URIs `postgresql://` con contraseña, JWT, tokens de GitHub).
- Si encuentra algo, **no crea el zip** y dice en qué archivo está y de qué tipo es, sin mostrar el valor.

Pasa solo ese `.zip`.

### Qué no hacer

| No hagas esto | Por qué |
|---|---|
| Enviar la carpeta tal cual, o un zip hecho a mano | Lleva `.env` con todas tus claves, `.git` con tu nombre y email en cada commit, y `.next` con la URL de tu Supabase |
| Hacer público tu repositorio de GitHub o añadir colaboradores | El historial muestra el nombre y el email de cada autor. Si quieres compartirlo por GitHub, crea un repositorio nuevo a partir del zip |
| Compartir capturas de Supabase, Vercel o GitHub con valores visibles | Las claves y las URIs se leen en la imagen |
| Compartir los enlaces de claude.ai (informe de idealo, arquitectura) sin revisarlos | Son privados. Si los compartes, revisa antes que no muestren nada tuyo |
| Dar acceso a tu proyecto de Supabase o de Vercel | Quien replica crea los suyos; no necesita los tuyos para nada |

### Si algo se filtra

| Qué se filtró | Qué hacer |
|---|---|
| `DATABASE_URL` o la contraseña de la base | Supabase → Project Settings → Database → **Reset database password**. Luego actualiza `DATABASE_URL` en `.env` y en GitHub (`gh secret set DATABASE_URL`, o vuelve a correr la etapa 5 del wizard) |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Vercel → Settings → Deployment Protection → borra el secreto y crea otro. Actualízalo con la etapa 7 del wizard |
| La publishable key o la URL de Supabase | Son públicas por diseño (van al navegador). Lo que protege los datos es RLS y los permisos de la migración 0400. Si aun así quieres cambiarla: Supabase → API Keys → crea otra y borra la anterior, y actualízala en Vercel |
| Un token de GitHub (`gh auth`) | GitHub → Settings → Applications → revoca el acceso de GitHub CLI y vuelve a iniciar sesión con `gh auth login` |

---

## 1. Qué necesitas

### Herramientas

| Herramienta | Versión | Para qué | Cómo instalar (Windows) |
|---|---|---|---|
| Node.js | 24 o superior | Todo el monorepo. El worker corre `.ts` directo con el type stripping de Node 24 | https://nodejs.org (LTS 24) |
| Git | cualquiera reciente | Repositorio | https://git-scm.com. Trae **Git Bash**, que el wizard necesita |
| GitHub CLI (`gh`) | 2.x | Guardar los secretos de Actions y lanzar workflows | `winget install --id GitHub.cli` y luego cierra y abre la terminal |
| k6 | 2.3.0 | Pruebas de carga (solo al final) | https://github.com/grafana/k6/releases, descarga `k6-v2.3.0-windows-amd64.zip` y verifica el checksum con `checksums.txt` |
| Supabase CLI | no hace falta en local | Las migraciones las aplica GitHub Actions | — |

En macOS o Linux funciona igual. El wizard es bash y los comandos de esta guía están en bash.

### Cuentas (todas gratuitas)

| Cuenta | Plan | Límites que importan |
|---|---|---|
| GitHub | Free | Repositorio privado: 2.000 minutos de Actions al mes. La ingesta diaria gasta hasta unos 1.800 con el presupuesto completo de las tiendas leídas por sitemap (ver §7) y CI unos 3 por push, así que en un repositorio privado conviene bajar `paginas_por_corrida`. Uno público no tiene límite |
| Supabase | Free | 500 MB de base (el proyecto usa unos 100 MB el primer año). **Se pausa tras 7 días sin actividad**; la ingesta diaria lo evita |
| Vercel | Hobby | **Solo uso no comercial**. Solo despliega commits del dueño de la cuenta (ver 5.2). 1 millón de invocaciones al mes |

---

## 2. Qué hay en el paquete

| Carpeta o archivo | Qué es |
|---|---|
| `apps/web` | Web Next.js 16 (App Router, Cache Components): inicio, `/buscar`, `/p/[id]` con historial, `/tiendas`, `/api/buscar` e `/ir/[id]`. `vercel.json` fija la región `iad1` |
| `packages/dominio` | Reglas puras: `validar` (calidad de datos) y `claveDeProducto` (EAN o código de modelo) |
| `packages/ingesta` | Worker: fuentes VTEX, WooCommerce, Shopify, Magento, Frecuento, sitemap con datos estructurados y feed, robots.txt, 1 petición/s por tienda, `ejecutarCorrida` y CLI |
| `supabase/migrations` | 17 migraciones: base, catálogo, ingesta y calidad, seguridad y API, ROLAP y pg_cron, emparejamiento, ingesta diaria, nombre, plataformas nuevas, columnas de tienda para las fuentes, precio desde solo con tiendas activas, ofertas agotadas, vuelta desde `sin_permiso`, lectura por sitemap, cierre de corridas abandonadas frescura sin avisos duplicados y accesorios al final de la búsqueda |
| `supabase/seed.sql` | 28 tiendas (24 activas, Smart Home EC `sin_permiso` por su robots.txt, y De Prati, El Bárbaro y Steren `pausada` porque responden 403) y 6 categorías |
| `scripts/` | Wizard de configuración, validador del esquema (PGlite), carga del seed, resumen del catálogo y empaquetador |
| `.github/workflows` | `ci.yml`, `migraciones.yml`, `ingesta.yml` (diaria) y `carga-k6.yml` (manual) |
| `tests/carga` | Escenarios k6: humo, carga, estrés y pico |
| `prototipo/` | Primera versión, que consultaba las tiendas en vivo. Solo como referencia |
| `docs/` | Arquitectura (`arquitectura.md` y `.html`), 9 ADR con el porqué de cada decisión y `feed-tiendas.md`, el contrato del feed para las tiendas que no se pueden leer |
| `pruebas/` | Evidencia: investigación de idealo, pruebas del prototipo y resultados k6 contra Vercel |
| `GLOSSARY.md` | Vocabulario del dominio: oferta, producto, corrida, cuarentena, salida… |

---

## 3. Preparar la copia local

```bash
# 1. Descomprime el zip y entra en la carpeta
cd comparador-ecuador

# 2. Instala dependencias (todas las del monorepo, desde la raíz)
npm install

# 3. Comprueba que todo funciona sin ninguna cuenta todavía
npm test                  # 185 pruebas: prototipo 8, dominio 30, ingesta 142 (contra PGlite), web 5
npm run validar:esquema   # aplica las 17 migraciones en Postgres-WASM y recorre un escenario: 59 comprobaciones ✔
```

Si alguna falla aquí, no sigas: revisa la versión de Node (`node -v` debe ser 24 o más).

---

## 4. Cuentas y secretos con el wizard

El wizard te lleva por las 7 etapas, abre cada página y guarda lo que pegas en `.env` y en los secretos de GitHub, sin
mostrarlo. Es seguro pararlo con Ctrl-C y volver a correrlo: recuerda lo ya guardado (Enter conserva el valor).

**Córrelo siempre desde la carpeta del proyecto**, porque escribe `.env` en la carpeta actual:

```bash
bash scripts/wizard-configuracion.sh
```

En PowerShell: `& "C:\Program Files\Git\bin\bash.exe" scripts/wizard-configuracion.sh`, también dentro de la carpeta.

### Etapa 1: GitHub CLI
Instala `gh` si falta y acepta `gh auth login` (abre el navegador). Si el navegador no deja autorizar, copia el código
de un solo uso que muestra la terminal en https://github.com/login/device.

### Etapa 2: repositorio
- Crea un repositorio **vacío**: sin README, sin `.gitignore` y sin licencia, porque ya vienen en el paquete.
- **Privado** gasta minutos de Actions (sección 1). **Público** no gasta, pero cualquiera ve el código; los secretos
  siguen protegidos igual.
- Escribe el repositorio como `usuario/nombre`.
- Como el paquete no trae `.git`, el wizard ofrece hacer `git init` y conectar el remoto: acepta.
- **Antes del primer commit**, configura el autor (explicado en 5.2):
  ```bash
  git config user.email "<id>+<usuario>@users.noreply.github.com"   # GitHub → Settings → Emails, "Keep my email private"
  git config user.name "<usuario>"
  ```

### Etapa 3: proyecto de Supabase
- **Region: East US (North Virginia)** (us-east-1), junto a la región `iad1` de Vercel.
- En las opciones de seguridad: **desmarca "Automatically expose new tables"** y **marca "Enable automatic RLS"**.
  La migración 0400 concede cada permiso a mano: `anon` solo lee las tablas públicas y ejecuta `buscar_productos` y
  `registrar_salida`. Con la exposición automática quedarían abiertas tablas que no deben estarlo.
- Genera la contraseña de la base y **cópiala antes de crear el proyecto**. Mejor solo letras y números: los símbolos
  hay que codificarlos dentro de la URI.
- Pega el `<ref>`: las 20 letras de `supabase.com/dashboard/project/<ref>`.

### Etapa 4: claves de API
- Copia la **Publishable key** (`sb_publishable_…`). Es pública: la web la usa con los permisos de `anon`.
- **No crees una Secret key.** Ni la web ni la ingesta la usan; la ingesta entra con `DATABASE_URL`.

### Etapa 5: conexión para la ingesta
- Botón **Connect** → Connection string → **Session pooler** (puerto 5432). La conexión directa es solo IPv6 y los
  runners de GitHub no tienen IPv6.
- Reemplaza `[YOUR-PASSWORD]` por la contraseña, sin corchetes, y pega **una sola URI**. Si pegas la plantilla y la URI
  juntas, todas las conexiones fallan.
- El wizard la guarda en `.env` y como secreto `DATABASE_URL` de GitHub.

### Etapa 6: Vercel
Puedes posponerla hasta el paso 6 de esta guía; ahí está el detalle.

### Etapa 7: bypass para k6
Puedes posponerla hasta el paso 8. Para volver a una etapa, corre el wizard otra vez y pulsa Enter en las anteriores.

### Qué queda en cada sitio

| Valor | `.env` local | Secreto de GitHub | Vercel |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | — | ✓ (Config) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✓ | — | ✓ (Config) |
| `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `GITHUB_REPO` | ✓ | — | — |
| `DATABASE_URL` | ✓ | ✓ | — |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | ✓ | ✓ | — (lo genera Vercel) |

`.env.example` documenta cada una. Sin `gh`, cárgalas a mano en GitHub: Settings → Secrets and variables → Actions →
New repository secret.

---

## 5. Primer despliegue: GitHub y Supabase

### 5.1 Primer push

```bash
git add -A
git status            # revisa: no debe aparecer .env (está en .gitignore)
git commit -m "DecideAqui: primera versión"
git push -u origin main
```

Esto lanza dos workflows (en GitHub → Actions):

- **CI**: tipos, 185 pruebas, validación del esquema y sintaxis k6. Unos 3 minutos.
- **Migraciones Supabase**: `supabase db push --db-url` aplica las 17 migraciones a tu proyecto. Usa el environment
  `produccion`, que GitHub crea solo. Si quieres aprobar a mano cada migración, añade una regla en Settings →
  Environments → produccion → Required reviewers.

La ingesta (`ingesta.yml`) queda programada para las 06:17 UTC de cada día.

### 5.2 Por qué importa el autor de los commits

El plan Hobby de Vercel **bloquea** ("Blocked") los commits cuyo autor no es la cuenta dueña del proyecto. GitHub
atribuye cada commit por su email. Usa en el repositorio el email noreply de la cuenta con la que creaste Vercel. Se
configura solo en este repositorio (sin `--global`), así no tocas tus otros proyectos.

### 5.3 Comprobar las migraciones

En Supabase → Table Editor deben aparecer `tienda`, `categoria`, `producto`, `oferta`, `precio_historial` y `salida`,
más los esquemas `ingesta`, `calidad` y `analitica`. En SQL Editor:

```sql
select jobname, schedule from cron.job order by 1;
-- purgar-antiguos '30 3 * * *' · refrescar-analitica '17 8 * * *' · revisar-frescura '0 * * * *'
```

### 5.4 Cargar las tiendas y categorías (seed)

`supabase db push` no carga el seed. Hazlo una vez, desde la carpeta del proyecto (es idempotente):

```bash
node --env-file=.env scripts/cargar-seed.mjs
# tiendas por estado: { activa: 24, pausada: 3, sin_permiso: 1 } · categorías: 6
```

### 5.5 Primera ingesta

Primero una corrida corta para probar la conexión: GitHub → Actions → **Ingesta de tiendas** → Run workflow →
`limite_paginas: 2`. Las corridas acaban como `parcial`, que es lo esperado al cortar.

Luego la completa, con los campos vacíos, o:

```bash
gh workflow run ingesta.yml
```

También se puede correr en local con `npm run ingesta` (usa tu `.env`). Antes de la corrida completa, lanza **una tienda a la vez**
con `tienda` y `limite_paginas: 2` y revisa `calidad.resumen_corrida` (porcentaje de válidas, incidencias y cuarentena).
Una tienda que falle se pausa con `update public.tienda set estado = 'pausada' where id = '…'`.

La corrida completa tarda hasta una hora (las tiendas corren en paralelo y la más larga es una tienda leída por sitemap
con su presupuesto completo) y carga más de 100.000 ofertas. Volumen aproximado (nov 2026):

| Tienda | Ofertas válidas | Fuente |
|---|---|---|
| Frecuento | ~36.900 | API propia |
| Kywi | ~31.500 | API VTEX |
| Fybeca | hasta ~20.000 | sitemap |
| Pycca | ~10.300 | API VTEX |
| Coral | ≥10.600 | sitemap |
| Créditos Económicos, Almacenes Japón | ~7.500 cada una | sitemap |
| Pintulac | ~7.900 | API Magento |
| Boyacá | ~6.900 | sitemap |
| EkuStore | ~4.100 | API Shopify |
| Tventas | ~3.800 | sitemap |
| SuperPaco | ~6.700 | API VTEX |
| Marcimex | ~3.700 | API VTEX |
| Novicompu | ~3.570 | API VTEX |
| Artefacta | ~2.100 | sitemap |
| Colineal | ~1.700 | API Shopify |
| Computron | ~1.300 | API WooCommerce |
| NewStore | ~780 | API Shopify |
| Comandato, La Ganga | ~320 cada una | API VTEX, API Magento |
| Randall Tech | ~110 | API Shopify |
| TIA, Sukasa, Orve Hogar | por medir | sitemap |

Las tiendas leídas por sitemap llegan a su volumen completo tras varias corridas: cada corrida lee como mucho
`paginas_por_corrida` páginas (ver §7).

Unos 80 productos aparecen en dos o más tiendas. Para revisarlo, en modo de solo lectura:

```bash
node --env-file=.env scripts/resumen-catalogo.mjs
```

---

## 6. La web en Vercel

1. https://vercel.com/new → **Import Git Repository** → tu repositorio. Si no aparece: "Adjust GitHub App Permissions"
   y dale acceso a ese repositorio.
2. **Root Directory**: Edit → `apps/web`. Framework Preset: Next.js. No cambies los comandos de build ni de install.
3. **Environment Variables**, solo estas dos:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

   Reglas:
   - **Type: Config**, no Secret. Con el prefijo `NEXT_PUBLIC_`, Vercel rechaza el tipo Secret ("Remove the public
     framework prefix…") y el valor no llega al build. Un Secret guardado no se puede pasar a Config: bórralo y créalo
     de nuevo.
   - **Pega el valor sin comillas.** En `.env` están como `KEY='valor'`. Con comillas, el build falla con
     `Invalid supabaseUrl`.
   - Environments: **Production y Preview**.
   - No subas `DATABASE_URL` ni ningún otro valor: la web no los usa.
4. **Deploy**. El build tarda alrededor de 1 minuto. Necesita las variables porque prerenderiza productos reales; por eso
   conviene haber hecho antes la primera ingesta.

Cada push a `main` despliega producción. Cada push a otra rama crea una vista previa, pero solo si el commit cambia algo
en `apps/web`; si no, Vercel la marca "Skipped - Not affected".

### Comprobar la web

```bash
B=https://<tu-proyecto>.vercel.app
for p in / /tiendas "/buscar?q=lavadora" "/api/buscar?q=lavadora" "/api/buscar?q=a" /ir/abc; do
  printf '%-28s ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "$B$p"; done
# 200, 200, 200, 200, 400 (consulta de 1 letra), 404 (id no numérico)
```

Para probar la redirección sin que cuente como salida real, usa la cabecera de prueba y no sigas el 302:

```bash
curl -sI -H "X-Prueba-Carga: verificacion" "$B/ir/<id-de-oferta>?pos=1" | grep -iE "^HTTP|^location|^cache-control"
# 302 · Location: https://<tienda>/…?utm_source=decideaqui&utm_medium=cpc&utm_content=pos-1 · Cache-Control: no-store
```

El `<id>` sale del campo `ir` de cualquier oferta en `/api/buscar`.

---

## 7. Operación diaria

| Qué | Cuándo (UTC) | Dónde |
|---|---|---|
| Ingesta de las tiendas activas (y revisión de las `sin_permiso`) | 06:17 (01:17 en Ecuador) | GitHub Actions, `ingesta.yml` |
| Refresco de las vistas ROLAP | 08:17 | pg_cron, `analitica.refrescar()` |
| Aviso de frescura (sin corrida correcta en 30 h; uno por día y tienda, no uno por hora) | cada hora | pg_cron, `calidad.revisar_frescura()` |
| Purga: cuarentena > 30 días, incidencias > 90 días | 03:30 | pg_cron, `ingesta.purgar_antiguos()` |

- **Por qué una vez al día y no cada 6 horas** (ADR 0008): ahorra minutos de Actions, carga menos a las tiendas, y
  los precios en Ecuador cambian sobre todo al empezar el día. El precio puede tener hasta un día de atraso, y la web
  lo dice.
- **Promociones** (Black Friday, Cyber Monday): lanza corridas extra con "Run workflow", o cambia el cron a
  `'17 */6 * * *'` esos días.
- **Tiendas leídas por sitemap** (Créditos Económicos, Almacenes Japón, Orve Hogar, Artefacta, Coral, TIA, Sukasa,
  Tventas, Boyacá y Fybeca; ADR 0009): una página por producto, a 1 por segundo. Cada corrida lee como mucho
  `paginas_por_corrida` páginas (2.500 por omisión, unos 42 minutos): primero las nunca vistas, luego las modificadas
  desde la última visita y luego las más viejas. Una vuelta completa tarda `ceil(productos / 2.500)` días, así que el precio
  de una oferta puede tener hasta ese atraso, y la web lo dice. Para bajar el consumo de Actions, o subirlo en Black
  Friday, cambia `paginas_por_corrida` (entre 1 y 10.000): `update public.tienda set paginas_por_corrida = 1000 where id = 'fybeca'`.
  No subas el ritmo de 1 petición por segundo.
- **Salvaguardas automáticas:**
  - Una oferta se desactiva tras 2 ausencias. En las tiendas leídas por sitemap no aplica: se desactivan las que salen del
    sitemap o devuelven 404 o 410, y solo si el sitemap trae al menos la mitad de las ofertas activas.
  - Una fuente que no cubre todo el catálogo (categoría VTEX de más de 5.000 productos, tramo con error 500 que no se
    recupera, productos que faltan del total que declara la tienda, más del 20 % de páginas sin datos) cierra `parcial`,
    con el motivo en `ingesta.corrida.error`, y no desactiva nada.
  - Una tienda `sin_permiso` se vuelve a revisar en cada corrida con una sola petición, y vuelve a `activa` sola.
  - Un salto de precio de más del 70 % espera la corrida siguiente.
  - Si una tienda trae menos de la mitad que en la corrida anterior, la corrida cierra como `parcial` y no desactiva nada.
- **Calidad**: `select * from calidad.resumen_corrida;` y las tablas `ingesta.cuarentena` y `calidad.incidencia`.
- **Si Supabase se pausó** por inactividad: Dashboard → Restore project.

---

## 8. Pruebas de carga con k6

Déjalas para el final, con la web y la ingesta funcionando. Nunca contra producción: `tests/carga/lib/comun.js` solo
acepta `localhost` o la URL de rama de una vista previa (`<proyecto>-git-<rama>-<equipo>.vercel.app`, salvo `main` y
`master`).

Toda petición de k6 lleva la cabecera `X-Prueba-Carga`, así que sus salidas quedan con `es_prueba = true` y la analítica
las excluye. Nunca sigue la redirección a la tienda.

> La vista previa usa **la misma base** que producción, porque las variables están en Production y Preview. Por eso
> estrés y pico se corren con tope 100, no con los valores por defecto (300 usuarios y 400 búsquedas/s), que están
> pensados para el servidor local.

### 8.1 Secreto de bypass
Las vistas previas piden iniciar sesión en Vercel. Corre la etapa 7 del wizard: Settings → Deployment Protection →
Protection Bypass for Automation → crea el secreto → pégalo.

### 8.2 Vista previa para las pruebas
Hace falta un commit que toque `apps/web`; si no, Vercel no la despliega:

```bash
git switch -c prueba-k6
echo "Rama solo para pruebas k6. No se fusiona a main." > apps/web/PRUEBA-K6.md
git add apps/web/PRUEBA-K6.md && git commit -m "Vista previa para k6" && git push -u origin prueba-k6
git switch main
```

La URL de la rama la ves en Vercel → Deployments → ese despliegue → Domains.

### 8.3 Comprobar que la vista previa responde la API (y no una página de Vercel)

```bash
export BASE_URL=https://<proyecto>-git-prueba-k6-<equipo>.vercel.app
export VERCEL_BYPASS="$(grep '^VERCEL_AUTOMATION_BYPASS_SECRET=' .env | cut -d= -f2- | tr -d "\r'")"   # no se imprime
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' -H "x-vercel-protection-bypass: $VERCEL_BYPASS" "$BASE_URL/api/buscar?q=lavadora"
# 200 application/json   ← si sale text/html, el despliegue se saltó o se canceló (ver sección 11)
```

### 8.4 Correr los escenarios (desde la carpeta del proyecto, en la misma terminal)

```bash
k6 run tests/carga/humo.js                                    # 1 usuario, 30 s
k6 run tests/carga/carga.js                                   # 50 usuarios, 5 min
VUS=100 ESCALON=1m k6 run tests/carga/estres.js               # escalones hasta 100 usuarios, 9 min
RPS=100 MESETA=1m MAX_VUS=300 k6 run tests/carga/pico.js      # de 10 a 100 búsquedas/s, 3 min
```

También desde GitHub: Actions → **Pruebas de carga (k6)** → Run workflow, con escenario, `base_url` y `tope`
(100 por defecto).

Resultados de referencia (6 nov 2026, desde Quito; detalle en `pruebas/k6-vercel.txt`). Los 17 umbrales se cumplieron,
sin ninguna petición fallida en 48.378:

| Escenario | Búsqueda p95 | Umbral |
|---|---|---|
| humo | 233 ms | 800 ms |
| carga | 229 ms (p99 303 ms) | 500 ms (p99 1,2 s) |
| estrés | 250 ms | 2 s |
| pico | 419 ms, 20 iteraciones descartadas | 1,5 s y menos de 100 descartadas |

### 8.5 Limpiar después
- Las salidas de prueba no afectan a la analítica. Para borrarlas, en el SQL Editor de Supabase (no se puede deshacer):
  `delete from public.salida where es_prueba;`
- Puedes conservar la rama `prueba-k6` para repetir las pruebas, o borrarla: `git push origin --delete prueba-k6`.

---

## 9. Si cambias el nombre del producto

Si tu copia va a tener otro nombre, cambia todos estos sitios para que las tiendas y la analítica no te confundan con
el proyecto original:

| Qué | Dónde |
|---|---|
| Nombre en la web (logo y títulos) | `apps/web/src/app/layout.tsx` |
| User-Agent con el que la ingesta se presenta a las tiendas | `AGENTE` en `packages/ingesta/src/http.ts`. Pon tu nombre y, si puedes, un contacto |
| Nombre para robots.txt | parámetro `agente` en `packages/ingesta/src/robots.ts` y el test `packages/ingesta/test/robots.test.ts` |
| `utm_source` de las salidas | migración **nueva** que reemplace `public.registrar_salida` (copia la 0800 con tu valor). Actualiza también `apps/web/test/rutas.test.ts` y `scripts/validar-esquema.mjs` |
| User-Agent de k6 | `tests/carga/lib/comun.js` |
| Textos y documentación | `README.md`, `GLOSSARY.md`, `docs/arquitectura.*`, banner de `scripts/wizard-configuracion.sh` |

Nunca edites una migración ya aplicada: crea una nueva. Después corre `npm test` y `npm run validar:esquema`.

---

## 10. Reglas que no se deben romper

- **robots.txt manda.** El worker lo lee antes de cada tienda y no entra si lo prohíbe. Una tienda que prohíbe su API
  (`Disallow: /*?`) se lee por sitemap, que sí permite; si prohíbe todo el sitio (Smart Home EC), solo entra con un feed
  acordado (`plataforma = 'feed'`, `url_feed`; ver `docs/feed-tiendas.md`), nunca saltándose la regla (ADR 0007 y 0009).
  Cada URL de producto se comprueba contra el robots.txt antes de pedirla, y las consultas Magento van por `GET`, nunca por
  `POST` para esquivar un `Disallow`.
- **Un 403 no se evade.** Ni con otro User-Agent, ni con un navegador sin interfaz, ni rotando direcciones. De Prati y
  El Bárbaro están pausadas por eso.
- **Ritmo amable**: 1 petición por segundo por tienda, reintentos que respetan `Retry-After` y un User-Agent honesto.
  No subas el ritmo.
- **Sin payload crudo**: se guarda solo lo normalizado y el historial SCD2 (ADR 0003).
- **k6 nunca contra producción**, siempre con `X-Prueba-Carga`, y sin seguir las redirecciones a las tiendas.
- **No hagas clic en los enlaces de salida de idealo** si repites la investigación: generan clics de pago a sus
  tiendas.
- **Vercel Hobby es para uso no comercial.** Si el comparador cobra por salidas, necesitas el plan Pro (ADR 0005).
- **Secretos**: nunca en el código, en commits, en capturas ni en mensajes. Solo en `.env` (ignorado), en los
  secretos de GitHub y en las variables de Vercel.

---

## 11. Problemas conocidos y su solución

Todos ocurrieron al construir el proyecto. Los del código ya están corregidos; los de configuración dependen de ti.

| Síntoma | Causa | Solución |
|---|---|---|
| Vercel: `Cannot find module 'vitest'` al revisar tipos | Vercel instala solo `apps/web`, sin la raíz del monorepo | Ya corregido. Toda dependencia que use la web, incluidas las de sus pruebas, va en `apps/web/package.json` |
| `npm ERESOLVE … @types/node` al instalar `apps/web` sola | vitest 5 pide `@types/node` 22 o superior | Ya corregido (`^24`) |
| Despliegue de Vercel en **Blocked** | El autor del commit no es la cuenta dueña (Hobby) | `git config user.email` con el noreply de esa cuenta (5.2), y un commit nuevo o Redeploy |
| Vercel: "Remove the public framework prefix…" | Variable `NEXT_PUBLIC_` guardada como Secret | Bórrala y créala como **Config** |
| Build: `Invalid supabaseUrl` | El valor se pegó con las comillas de `.env` | Pégalo sin comillas y haz Redeploy |
| Rama en Vercel: "Skipped - Not affected" | El commit no cambia nada en `apps/web` | Cambia un archivo de `apps/web` en esa rama (8.2) |
| La URL de la vista previa responde 200 con HTML "Deployment was cancelled" | Igual que el anterior: el alias apunta a un despliegue saltado | Igual. k6 lo detecta porque falla el check "trae productos" |
| Ingesta: `cannot get array length of a scalar` | postgres.js volvía a serializar como texto un JSON ya serializado | Ya corregido: los parámetros jsonb van como objetos. No uses `JSON.stringify` en `almacen/postgres.ts` |
| Ingesta o migraciones: error de autenticación o de host | `DATABASE_URL` con `[YOUR-PASSWORD]`, dos URIs pegadas juntas o un símbolo sin codificar | Una sola URI del Session pooler. Vuelve a la etapa 5 del wizard |
| Timeout desde GitHub Actions a Postgres | Se usó la conexión directa (IPv6) | Session pooler, puerto 5432 |
| El wizard escribió `.env` en otra carpeta | Se ejecutó desde fuera del proyecto | Ejecútalo desde la carpeta del proyecto |
| `gh: command not found` tras instalarlo | La terminal no recargó el PATH | Cierra y abre la terminal. El wizard también prueba `C:\Program Files\GitHub CLI` |
| Aviso `tienda_desactualizada` sin motivo | El cron de GitHub se retrasa a veces más de 1 hora | El umbral ya es de 30 h. Revisa si de verdad falló una corrida |
| Corrida `parcial` sin límite de páginas | La tienda devolvió menos de la mitad que la vez anterior | Es una salvaguarda. Revisa la tienda; la siguiente corrida normal lo resuelve |
| Corrida `parcial` con el error "categorías truncadas", "tramo(s) con error del servidor" o "se leyeron N de los M productos" | La fuente VTEX no pudo cubrir todo: una categoría de más de 5.000 productos sin subcategorías, un tramo que sigue dando 500 o productos fuera del árbol de categorías | Es una salvaguarda: no desactiva nada. El motivo exacto está en `ingesta.corrida.error`. Si la tienda prohíbe el orden por nombre en su robots.txt, solo se alcanzan 2.500 productos por categoría |
| Una oferta de una tienda sitemap muestra un precio de hace días | Se revisa por tandas, a 1 página por segundo | Es lo esperado: la web muestra cuándo se actualizó. Sube `paginas_por_corrida` si hace falta (§7) |
| Una tienda sitemap queda `parcial` con "no trajeron datos de producto" | Más del 20 % de sus páginas no trae JSON-LD ni Open Graph con precio: la tienda cambió su formato, o el `patron_producto` deja pasar páginas que no son de producto | Revisa `patron_producto` de esa tienda y una de sus páginas. Mientras tanto no desactiva nada |
| Una tienda responde 403 desde GitHub Actions y 200 desde otra red (Steren) | Su protección (Cloudflare) bloquea las direcciones de los servidores de GitHub | No se evade: la tienda queda `pausada` hasta tener un feed o un permiso |
| Una tienda sitemap no carga ninguna oferta | Pidió la ficha con un `Accept` que el servidor responde vacío, o el JSON-LD está después del tope de lectura (600 KB) | Revisa una ficha con `curl` y el `patron_producto`; las fichas se leen solo hasta que aparece su JSON-LD |
| Una tienda no vuelve a correr y su última corrida sigue `en_curso` | El proceso murió sin cerrarla (workflow cancelado o con tiempo agotado) | Ya se resuelve sola: al abrir la siguiente corrida, las que llevan más de 3 horas `en_curso` se cierran como `fallida` |
| Shopify: "robots.txt prohíbe /meta.json" o moneda distinta de USD | La moneda de las tiendas Shopify se lee de `/meta.json` (no de `/cart.js`, que su robots.txt prohíbe) | Si la tienda prohíbe `/meta.json`, pásala a feed. Una moneda distinta de USD manda las ofertas a cuarentena (`moneda_no_usd`) |
| Next.js: error con `useSearchParams` o con `Date.now()` al compilar | Reglas de Cache Components | Ya resuelto. Si editas páginas: hooks de cliente dentro de `<Suspense>` y la hora como prop después de leer los `searchParams` |
| `npm install -w packages/x` no registra la dependencia | npm espera el nombre del workspace | `npm install <paquete> --workspace @comparador/x` |
| Avisos de CRLF en Windows | Saltos de línea de Windows | `.gitattributes` ya fuerza LF |
| La búsqueda de "televisor 55" trae soportes | Falta filtrar por categoría | Limitación conocida (README) |

---

## 12. Lista final de verificación

- [ ] `npm test`: 185 pruebas pasan · `npm run validar:esquema`: 59 ✔
- [ ] `.env` creado por el wizard. `git status` no lo muestra
- [ ] Secretos de GitHub: `DATABASE_URL` (y `VERCEL_AUTOMATION_BYPASS_SECRET` para k6)
- [ ] Supabase: "Automatically expose new tables" desmarcado y "automatic RLS" activado
- [ ] Workflows **CI** y **Migraciones Supabase** en verde tras el primer push
- [ ] 3 trabajos en `cron.job`
- [ ] Seed cargado: 24 tiendas activas, 1 `sin_permiso`, 3 `pausada`, 6 categorías
- [ ] Primera ingesta: cada tienda probada sola con `limite_paginas: 2`; luego la completa, con las tiendas en `ok` (las leídas por sitemap llegan a su volumen completo tras varias corridas) y más de 100.000 ofertas
- [ ] Vercel: Root Directory `apps/web`, 2 variables Config sin comillas, despliegue `Ready`
- [ ] La web responde 200 en `/`, `/tiendas`, `/buscar`, `/api/buscar`; 400 y 404 en los casos inválidos; `/ir` da 302 con `utm_source`
- [ ] Los commits salen con el email de la cuenta dueña de Vercel (no hay despliegues "Blocked")
- [ ] k6 humo, carga, estrés y pico contra la vista previa, con todos los umbrales ✓
- [ ] Ningún secreto en el repositorio, en capturas ni en mensajes
