// Catálogo: única puerta de la web hacia Supabase. Solo usa funciones públicas (buscar_catalogo de la migración 2300,
// registrar_salida de la 0400) y lecturas permitidas por RLS.

/** Lo mínimo de supabase-js que necesitamos; permite pasar un cliente simulado en pruebas. */
export type ClienteSupabase = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export type Orden = 'relevancia' | 'precio_asc' | 'precio_desc';
export const ORDENES: Orden[] = ['relevancia', 'precio_asc', 'precio_desc'];

export type Oferta = {
  id: number;
  tiendaId: string;
  tienda: string;
  titulo: string;
  precio: number;
  precioLista: number | null;
  disponible: boolean;
  vistoUltimaVez: string;
  ir: string;
};

export type Producto = {
  id: string;
  titulo: string;
  marca: string | null;
  imagen: string | null;
  desde: number | null;
  numTiendas: number;
  ofertas: Oferta[];
};

type FilaOferta = {
  id: number; tienda_id: string; tienda: string; titulo: string; precio: number | string;
  precio_lista: number | string | null; disponible: boolean; visto_ultima_vez: string;
};
type FilaProducto = {
  id: string; titulo: string; marca: string | null; imagen_url: string | null;
  precio_desde: number | string | null; num_tiendas: number; ofertas: FilaOferta[] | null;
};
type FilaFacetas = {
  total?: number | string; disponibles?: number | string; varias?: number | string; tiendas?: { id: string; nombre: string; n: number | string }[];
  precio?: { min: number | string | null; max: number | string | null } | null;
  categorias?: { slug: string; nombre: string; n: number | string }[];
  atributos?: Record<string, { valor: string; n: number | string }[]>;
};
/** Lo que devuelve public.buscar_catalogo: la página, el total con filtros y las facetas, en una sola llamada. */
type RespuestaBusqueda = { total: number | string; limitado: boolean; productos: FilaProducto[] | null; facetas: FilaFacetas | null };

/** Productos por página de resultados. */
export const POR_PAGINA = 24;
/** La búsqueda se queda con los mejores 1.000 resultados (migración 2700). */
export const TOPE_RESULTADOS = 1000;
/** Última página que se puede pedir: 42 de 24. */
export const MAX_PAGINA = Math.ceil(TOPE_RESULTADOS / POR_PAGINA);

export type OpcionesBusqueda = {
  pagina?: number; soloDisponibles?: boolean; soloVarias?: boolean; tienda?: string;
  /** Slug de la categoría (migración 2500). */
  categoria?: string;
  /** Filtros por atributo de la categoría: {"ram": ["16", "32"]}. */
  filtros?: Record<string, string[]>;
  precioMin?: number | null; precioMax?: number | null;
};
export type Facetas = {
  total: number; disponibles: number; varias: number; tiendas: { id: string; nombre: string; n: number }[];
  /** Rango de precios de los resultados (sin filtros). */
  precio: { min: number; max: number } | null;
  /** Sin categoría elegida: cuántos resultados hay de cada categoría. */
  categorias: { slug: string; nombre: string; n: number }[];
  /** Con categoría: cuántos productos tiene cada valor de cada atributo, con los demás filtros aplicados. */
  atributos: Record<string, { valor: string; n: number }[]>;
};
/** limitado: la búsqueda tiene más de TOPE_RESULTADOS coincidencias y solo se muestran las mejores. */
export type ResultadoBusqueda = { productos: Producto[]; total: number; limitado: boolean; facetas: Facetas; pagina: number; porPagina: number };
/** Sugerencia del buscador: una marca (lleva a su búsqueda) o un producto (lleva a su ficha). */
export type Sugerencia = { tipo: 'categoria' | 'marca' | 'producto'; texto: string; href: string; desde?: number };
type FilaSugerencia = { tipo: string; texto: string; id?: string; slug?: string; precio_desde?: number | string | null };

/** Número de página válido: entero entre 1 y MAX_PAGINA; cualquier otra cosa es la primera. */
export const leerPagina = (v: string | null | undefined): number => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, MAX_PAGINA) : 1;
};

const num = (v: number | string | null) => (v === null ? null : Number(v));

/** Error que puede ver cualquiera: el detalle técnico (función, texto de Postgres) va en cause, nunca en message. */
export function errorDeBase(mensaje: string, detalle: string): Error {
  return new Error(mensaje, { cause: new Error(detalle) });
}

export function aProducto(f: FilaProducto): Producto {
  return {
    id: f.id,
    titulo: f.titulo,
    marca: f.marca,
    imagen: f.imagen_url,
    desde: num(f.precio_desde),
    numTiendas: Number(f.num_tiendas),
    ofertas: (f.ofertas ?? []).map((o, i) => ({
      id: Number(o.id),
      tiendaId: o.tienda_id,
      tienda: o.tienda,
      titulo: o.titulo,
      precio: Number(o.precio),
      precioLista: num(o.precio_lista),
      disponible: o.disponible,
      vistoUltimaVez: o.visto_ultima_vez,
      ir: `/ir/${o.id}?pos=${i + 1}`,
    })),
  };
}

export function crearCatalogo(cliente: ClienteSupabase) {
  return {
    async buscar(q: string, orden: Orden = 'relevancia', opciones: OpcionesBusqueda = {}): Promise<ResultadoBusqueda> {
      const pagina = Math.min(Math.max(1, Math.floor(opciones.pagina ?? 1)), MAX_PAGINA);
      const { data, error } = await cliente.rpc('buscar_catalogo', {
        p_q: q, p_orden: orden, p_pagina: pagina, p_por_pagina: POR_PAGINA,
        p_solo_disponibles: opciones.soloDisponibles === true, p_solo_varias: opciones.soloVarias === true,
        p_tienda: opciones.tienda || null,
        p_categoria: opciones.categoria || null,
        p_filtros: opciones.filtros && Object.keys(opciones.filtros).length ? opciones.filtros : null,
        p_precio_min: opciones.precioMin ?? null, p_precio_max: opciones.precioMax ?? null,
      });
      if (error) throw errorDeBase('La búsqueda no respondió.', `buscar_catalogo: ${error.message}`);
      // Sin datos y sin error no es "sin resultados": es una respuesta rota, y así se trata.
      if (data === null || typeof data !== 'object') throw errorDeBase('La búsqueda no respondió.', 'buscar_catalogo: respuesta vacía');
      const r = data as RespuestaBusqueda;
      const f = r.facetas ?? {};
      return {
        productos: (r.productos ?? []).map(aProducto),
        total: Number(r.total ?? 0),
        limitado: r.limitado === true,
        facetas: {
          total: Number(f.total ?? 0), disponibles: Number(f.disponibles ?? 0), varias: Number(f.varias ?? 0),
          tiendas: (f.tiendas ?? []).map(t => ({ id: t.id, nombre: t.nombre, n: Number(t.n) })),
          precio: f.precio && f.precio.min !== null && f.precio.max !== null ? { min: Number(f.precio.min), max: Number(f.precio.max) } : null,
          categorias: (f.categorias ?? []).map(x => ({ slug: x.slug, nombre: x.nombre, n: Number(x.n) })),
          atributos: Object.fromEntries(Object.entries(f.atributos ?? {}).map(([k, vs]) => [k, vs.map(x => ({ valor: x.valor, n: Number(x.n) }))])),
        },
        pagina, porPagina: POR_PAGINA,
      };
    },

    /** Hasta 8 sugerencias mientras se escribe (migración 2400). */
    async sugerir(q: string): Promise<Sugerencia[]> {
      const { data, error } = await cliente.rpc('sugerir_busqueda', { p_q: q });
      if (error) throw errorDeBase('No se pudieron cargar sugerencias.', `sugerir_busqueda: ${error.message}`);
      return ((data as FilaSugerencia[] | null) ?? []).flatMap((s): Sugerencia[] => {
        if (s.tipo === 'categoria' && s.slug && /^[a-z0-9-]+$/.test(s.slug)) return [{ tipo: 'categoria', texto: s.texto, href: `/categoria/${s.slug}` }];
        if (s.tipo === 'marca') return [{ tipo: 'marca', texto: s.texto, href: `/buscar?q=${encodeURIComponent(s.texto)}` }];
        if (s.tipo === 'producto' && s.id) {
          const desde = s.precio_desde == null ? undefined : Number(s.precio_desde);
          return [{ tipo: 'producto', texto: s.texto, href: `/p/${s.id}`, ...(desde === undefined ? {} : { desde }) }];
        }
        return [];
      });
    },

    /** Hasta 3 términos parecidos que sí existen, para una búsqueda sin resultados. */
    async quizasBuscaba(q: string): Promise<string[]> {
      const { data, error } = await cliente.rpc('quizas_buscaba', { p_q: q });
      if (error) throw errorDeBase('La búsqueda no respondió.', `quizas_buscaba: ${error.message}`);
      return Array.isArray(data) ? data.filter((t): t is string => typeof t === 'string') : [];
    },

    /** Registra la salida y devuelve la URL de la tienda, o null si la oferta no está activa. */
    async registrarSalida(ofertaId: number, posicion: number | null, sesion: string, esPrueba: boolean): Promise<string | null> {
      const { data, error } = await cliente.rpc('registrar_salida', {
        p_oferta_id: ofertaId, p_posicion: posicion, p_sesion: sesion, p_es_prueba: esPrueba,
      });
      if (error) throw errorDeBase('No se pudo abrir la tienda.', `registrar_salida: ${error.message}`);
      return typeof data === 'string' ? data : null;
    },
  };
}
