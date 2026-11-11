/** Búsquedas rápidas: las pestañas de la cabecera y las salidas de los estados vacíos. */
export const RAPIDAS = [
  { etiqueta: 'Televisores', q: 'televisor' },
  { etiqueta: 'Refrigeradoras', q: 'refrigeradora' },
  { etiqueta: 'Laptops', q: 'laptop' },
  { etiqueta: 'Lavadoras', q: 'lavadora' },
  { etiqueta: 'Celulares', q: 'celular' },
] as const;

export const rutaBusqueda = (q: string) => `/buscar?q=${encodeURIComponent(q)}`;
