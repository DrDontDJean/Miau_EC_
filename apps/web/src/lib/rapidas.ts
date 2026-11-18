/** Categorías de la cabecera, del pie y de los estados vacíos: cada una con su página (/categoria/<slug>). */
export const RAPIDAS = [
  { etiqueta: 'Televisores', q: 'televisor', slug: 'televisores', href: '/categoria/televisores' },
  { etiqueta: 'Refrigeradoras', q: 'refrigeradora', slug: 'refrigeradoras', href: '/categoria/refrigeradoras' },
  { etiqueta: 'Laptops', q: 'laptop', slug: 'laptops', href: '/categoria/laptops' },
  { etiqueta: 'Lavadoras', q: 'lavadora', slug: 'lavadoras', href: '/categoria/lavadoras' },
  { etiqueta: 'Celulares', q: 'celular', slug: 'celulares', href: '/categoria/celulares' },
] as const;

export const rutaBusqueda = (q: string) => `/buscar?q=${encodeURIComponent(q)}`;
