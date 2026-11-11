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
    async buscar(q: string, orden: Orden = 'relevancia', limite = 24): Promise<Producto[]> {
      const { data, error } = await cliente.rpc('buscar_productos', { p_q: q, p_orden: orden, p_limite: limite, p_desde: 0 });
      if (error) throw new Error(`buscar_productos: ${error.message}`);
      return ((data as FilaProducto[] | null) ?? []).map(aProducto);
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
