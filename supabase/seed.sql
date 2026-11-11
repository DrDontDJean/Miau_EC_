-- Tiendas conocidas (ADR 0007: las que prohíben la búsqueda en robots.txt quedan sin permiso).
insert into public.tienda (id, nombre, origen, plataforma, estado, motivo_estado) values
  ('comandato', 'Comandato',           'https://www.comandato.com',      'vtex',        'activa',      null),
  ('novicompu', 'Novicompu',           'https://www.novicompu.com',      'vtex',        'activa',      null),
  ('kywi',      'Kywi',                'https://www.kywi.com.ec',        'vtex',        'activa',      null),
  ('pycca',     'Pycca',               'https://www.pycca.com',          'vtex',        'activa',      null),
  ('computron', 'Computron',           'https://www.computron.com.ec',   'woocommerce', 'activa',      null),
  ('crecos',    'Créditos Económicos', 'https://www.crecos.com',         'vtex',        'sin_permiso', 'robots.txt: Disallow: /*?'),
  ('japon',     'Almacenes Japón',     'https://www.almacenesjapon.com', 'vtex',        'sin_permiso', 'robots.txt: Disallow: /*?'),
  ('orve',      'Orve Hogar',          'https://www.orvehogar.com',      'vtex',        'sin_permiso', 'robots.txt: Disallow: /*?'),
  ('marcimex',  'Marcimex',            'https://www.marcimex.com',       'vtex',        'sin_permiso', 'robots.txt: Disallow: /*?')
on conflict (id) do nothing;

insert into public.categoria (nombre, slug) values
  ('Televisores', 'televisores'), ('Línea blanca', 'linea-blanca'), ('Computación', 'computacion'),
  ('Celulares', 'celulares'), ('Hogar', 'hogar'), ('Ferretería', 'ferreteria')
on conflict (slug) do nothing;
