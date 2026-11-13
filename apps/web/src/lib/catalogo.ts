// Catálogo: única puerta de la web hacia Supabase. Solo usa las funciones públicas
// de la migración 0400 (buscar_productos, registrar_salida) y lecturas permitidas por RLS.

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
  /** Cuántos resultados cumplen la búsqueda y los filtros, sin contar el límite (migración 1800). */
  total?: number | string | null;
};

/** Productos por página de resultados. */
export const POR_PAGINA = 24;
/** La base no entrega más allá de este desplazamiento (migración 1800): unas 416 páginas. */
export const MAX_PAGINA = Math.floor(10_000 / POR_PAGINA) + 1;

export type OpcionesBusqueda = { pagina?: number; soloDisponibles?: boolean; soloVarias?: boolean; tienda?: string };
export type ResultadoBusqueda = { productos: Producto[]; total: number; pagina: number; porPagina: number };
export type Facetas = { total: number; disponibles: number; varias: number; tiendas: { id: string; nombre: string; n: number }[] };

/** Número de página válido: entero entre 1 y MAX_PAGINA; cualquier otra cosa es la primera. */
export const leerPagina = (v: string | null | undefined): number => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, MAX_PAGINA) : 1;
};

const num = (v: number | string | null) => (v === null ? null : Number(v));

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
      const { data, error } = await cliente.rpc('buscar_productos', {
        p_q: q, p_orden: orden, p_limite: POR_PAGINA, p_desde: (pagina - 1) * POR_PAGINA,
        p_solo_disponibles: opciones.soloDisponibles === true, p_solo_varias: opciones.soloVarias === true,
        p_tienda: opciones.tienda || null,
      });
      if (error) throw new Error(`buscar_productos: ${error.message}`);
      const filas = (data as FilaProducto[] | null) ?? [];
      return { productos: filas.map(aProducto), total: Number(filas[0]?.total ?? 0), pagina, porPagina: POR_PAGINA };
    },

    /** Cuántos productos tiene la búsqueda en total, disponibles, en varias tiendas y por tienda (sin filtros). */
    async facetas(q: string): Promise<Facetas> {
      const { data, error } = await cliente.rpc('facetas_busqueda', { p_q: q });
      if (error) throw new Error(`facetas_busqueda: ${error.message}`);
      const f = (data ?? {}) as Partial<Facetas>;
      return {
        total: Number(f.total ?? 0), disponibles: Number(f.disponibles ?? 0), varias: Number(f.varias ?? 0),
        tiendas: (f.tiendas ?? []).map(t => ({ id: t.id, nombre: t.nombre, n: Number(t.n) })),
      };
    },

    /** Registra la salida y devuelve la URL de la tienda, o null si la oferta no está activa. */
    async registrarSalida(ofertaId: number, posicion: number | null, sesion: string, esPrueba: boolean): Promise<string | null> {
      const { data, error } = await cliente.rpc('registrar_salida', {
        p_oferta_id: ofertaId, p_posicion: posicion, p_sesion: sesion, p_es_prueba: esPrueba,
      });
      if (error) throw new Error(`registrar_salida: ${error.message}`);
      return typeof data === 'string' ? data : null;
    },
  };
}
