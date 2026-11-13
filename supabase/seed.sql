-- Tiendas conocidas (ADR 0007: se lee solo lo que el robots.txt de la tienda permite).
--
-- Se puede volver a cargar sin duplicar: si la tienda ya existe, solo se actualiza su configuración de lectura
-- (plataforma, hosts, sitemap y patrón), nunca su estado. Una tienda 'sin_permiso' vuelve sola a 'activa' en la
-- primera corrida cuya lectura de robots.txt lo permita (migración 1300).
--
-- Orden de preferencia de fuentes: API pública permitida (vtex, woocommerce, shopify, magento, frecuento),
-- luego sitemap + datos estructurados de cada página de producto (sitemap) y, por acuerdo con la tienda, feed.
--
-- plataforma 'sitemap': url_sitemap es el sitemap raíz o el índice; patron_producto es la expresión regular que,
-- aplicada a la ruta de una URL del sitemap, dice que es una página de producto.
insert into public.tienda (id, nombre, origen, plataforma, estado, motivo_estado, origen_api, url_sitemap, patron_producto) values
  -- API pública: VTEX y WooCommerce
  ('comandato', 'Comandato',            'https://www.comandato.com',       'vtex',        'activa',      null, null, null, null),
  ('novicompu', 'Novicompu',            'https://www.novicompu.com',       'vtex',        'activa',      null, null, null, null),
  ('kywi',      'Kywi',                 'https://www.kywi.com.ec',         'vtex',        'activa',      null, null, null, null),
  ('pycca',     'Pycca',                'https://www.pycca.com',           'vtex',        'activa',      null, null, null, null),
  ('marcimex',  'Marcimex',             'https://www.marcimex.com',        'vtex',        'activa',      null, null, null, null),
  ('computron', 'Computron',            'https://www.computron.com.ec',    'woocommerce', 'activa',      null, null, null, null),
  -- API pública: Shopify
  ('colineal',  'Colineal',             'https://colineal.com',            'shopify',     'activa',      null, null, null, null),
  ('ekustore',  'EkuStore',             'https://ekustore.com',            'shopify',     'activa',      null, null, null, null),
  ('newstore',  'NewStore',             'https://www.newstoregye.com',     'shopify',     'activa',      null, null, null, null),
  ('randall',   'Randall Tech',         'https://randall-tech.com',        'shopify',     'activa',      null, null, null, null),
  -- API pública: Magento (GraphQL)
  ('laganga',   'La Ganga',             'https://laganga.com',             'magento',     'activa',      null, null, null, null),
  ('pintulac',  'Pintulac',             'https://www.pintulac.com.ec',     'magento',     'activa',      null, null, null, null),
  ('steren',    'Steren Ecuador',       'https://www.steren.com.ec',       'magento',     'pausada',     '403 desde los servidores de GitHub Actions (responde 200 desde otras redes); pendiente de un feed o un permiso', null, null, null),
  -- API propia en otro host
  ('frecuento', 'Frecuento',            'https://www.frecuento.com',       'frecuento',   'activa',      null, 'https://app.frecuento.com', null, null),
  -- Sitemap + datos estructurados: su API de catálogo no se puede leer (robots.txt, 403 o clave)
  ('crecos',    'Créditos Económicos',  'https://www.crecos.com',          'sitemap',     'activa',      null, null, 'https://www.crecos.com/sitemap.xml',                           '/p$'),
  ('japon',     'Almacenes Japón',      'https://www.almacenesjapon.com',  'sitemap',     'activa',      null, null, 'https://www.almacenesjapon.com/sitemap.xml',                   '/p$'),
  ('orve',      'Orve Hogar',           'https://www.orvehogar.com',       'sitemap',     'activa',      null, null, 'https://www.orvehogar.com/sitemap.xml',                        '/p$'),
  ('artefacta', 'Artefacta',            'https://www.artefacta.com',       'sitemap',     'activa',      null, null, 'https://www.artefacta.com/media/sitemap/sitemap_art_ec_index.xml', '/p$'),
  ('coral',     'Coral Hipermercados',  'https://coralhipermercados.com',  'sitemap',     'activa',      null, null, 'https://coralhipermercados.com/media/sitemap/coralsitemap.xml', '^/[^/]+-(\d+|x[0-9a-z]+-un)\.html$'),
  ('tia',       'TIA',                  'https://www.tia.com.ec',          'sitemap',     'activa',      null, null, 'https://www.tia.com.ec/media/sitemap_TIA.xml',                 '-\d{6,}\.html$'),
  ('sukasa',    'Sukasa',               'https://www.sukasa.com',          'sitemap',     'activa',      null, null, 'https://www.sukasa.com/sitemap.xml',                           '^/productos/'),
  ('tventas',   'Tventas',              'https://www.tventas.com',         'sitemap',     'activa',      null, null, 'https://www.tventas.com/1_index_sitemap.xml',                  '/\d+-[^/]+\.html$'),
  ('boyaca',    'Almacenes Boyacá',     'https://www.boyaca.com',          'sitemap',     'activa',      null, null, 'https://www.boyaca.com/sitemap.php',                           '^/[^/]+/[^/]+/[^/]+-\d+$'),
  ('fybeca',    'Fybeca',               'https://www.fybeca.com',          'sitemap',     'activa',      null, null, 'https://www.fybeca.com/sitemap_index.xml',                     '/ECFY_\d+\.html$'),
  -- Sin acceso: solo entran con un feed o un permiso de la tienda
  ('smarthome', 'Smart Home EC',        'https://smarthomeecstore.com',    'shopify',     'sin_permiso', 'robots.txt: Disallow: /', null, null, null),
  ('deprati',   'De Prati',             'https://www.deprati.com.ec',      'sitemap',     'pausada',     '403: bloquea el acceso automático; pendiente de un feed o un permiso', null,
                                                                                          'https://www.deprati.com.ec/sitemap.xml', '.'),
  ('elbarbaro', 'El Bárbaro',           'https://elbarbaro.ec',            'sitemap',     'pausada',     '403: bloquea el acceso automático; pendiente de un feed o un permiso', null,
                                                                                          'https://elbarbaro.ec/sitemap_index.xml', '.')
on conflict (id) do update set
  nombre          = excluded.nombre,
  origen          = excluded.origen,
  plataforma      = excluded.plataforma,
  origen_api      = excluded.origen_api,
  url_sitemap     = excluded.url_sitemap,
  patron_producto = excluded.patron_producto;

insert into public.categoria (nombre, slug) values
  ('Televisores', 'televisores'), ('Línea blanca', 'linea-blanca'), ('Computación', 'computacion'),
  ('Celulares', 'celulares'), ('Hogar', 'hogar'), ('Ferretería', 'ferreteria')
on conflict (slug) do nothing;
