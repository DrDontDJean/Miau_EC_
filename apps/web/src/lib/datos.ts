// Lecturas con caché (Cache Components). Los precios cambian como mucho una vez al día (una corrida),
// así que unos minutos de caché no esconden nada y ahorran consultas a Supabase.
import { cacheLife } from 'next/cache';
import { crearCatalogo, type Orden, type Producto } from './catalogo';
import { clienteSupabase } from './supabase';

export async function buscarCacheado(q: string, orden: Orden): Promise<Producto[]> {
  'use cache';
  cacheLife('minutes');
  return crearCatalogo(clienteSupabase()).buscar(q, orden);
}

export type Tienda = { id: string; nombre: string; origen: string; plataforma: string; ultima_corrida_ok: string | null };

export async function tiendasActivas(): Promise<Tienda[]> {
  'use cache';
  cacheLife('minutes');
  const { data, error } = await clienteSupabase()
    .from('tienda').select('id, nombre, origen, plataforma, ultima_corrida_ok').order('nombre');
  if (error) throw new Error(`tiendas: ${error.message}`);
  return data ?? [];
}

export type ProductoResumen = { id: string; titulo: string; marca: string | null; imagen_url: string | null; precio_desde: number | null; num_tiendas: number };

/** Productos presentes en más tiendas: portada y rutas que se prerenderizan. */
export async function productosDestacados(limite = 8): Promise<ProductoResumen[]> {
  'use cache';
  cacheLife('minutes');
  const { data, error } = await clienteSupabase()
    .from('producto').select('id, titulo, marca, imagen_url, precio_desde, num_tiendas')
    .gt('num_tiendas', 1).order('num_tiendas', { ascending: false }).order('precio_desde').limit(limite);
  if (error) throw new Error(`destacados: ${error.message}`);
  return (data ?? []).map(p => ({ ...p, precio_desde: p.precio_desde === null ? null : Number(p.precio_desde) }));
}

export type Periodo = { oferta_id: number; valido_desde: string; valido_hasta: string | null; precio: number };
export type FichaProducto = { producto: Producto; historial: Periodo[]; generadaEn: number };

export async function fichaProducto(id: string): Promise<FichaProducto | null> {
  'use cache';
  cacheLife('minutes');
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const db = clienteSupabase();
  const { data: p, error } = await db
    .from('producto')
    .select('id, titulo, marca, imagen_url, precio_desde, num_tiendas, oferta(id, titulo, precio, precio_lista, disponible, visto_ultima_vez, tienda(id, nombre))')
    .eq('id', id).maybeSingle();
  if (error) throw new Error(`producto: ${error.message}`);
  if (!p) return null;
  type FilaOferta = { id: number; titulo: string; precio: number; precio_lista: number | null; disponible: boolean; visto_ultima_vez: string; tienda: { id: string; nombre: string } | null };
  const ofertas = ((p.oferta ?? []) as unknown as FilaOferta[])
    .filter(o => o.tienda) // RLS oculta tiendas no activas
    .sort((a, b) => Number(b.disponible) - Number(a.disponible) || Number(a.precio) - Number(b.precio));
  const producto: Producto = {
    id: p.id, titulo: p.titulo, marca: p.marca, imagen: p.imagen_url,
    desde: p.precio_desde === null ? null : Number(p.precio_desde), numTiendas: p.num_tiendas,
    ofertas: ofertas.map((o, i) => ({
      id: o.id, tiendaId: o.tienda!.id, tienda: o.tienda!.nombre, titulo: o.titulo, precio: Number(o.precio),
      precioLista: o.precio_lista === null ? null : Number(o.precio_lista), disponible: o.disponible,
      vistoUltimaVez: o.visto_ultima_vez, ir: `/ir/${o.id}?pos=${i + 1}`,
    })),
  };
  const { data: h, error: eh } = await db
    .from('precio_historial').select('oferta_id, valido_desde, valido_hasta, precio')
    .in('oferta_id', producto.ofertas.map(o => o.id)).order('valido_desde');
  if (eh) throw new Error(`historial: ${eh.message}`);
  return { producto, historial: (h ?? []).map(x => ({ ...x, precio: Number(x.precio) })), generadaEn: Date.now() };
}
