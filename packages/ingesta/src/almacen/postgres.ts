// Almacén sobre las funciones SQL de ingesta (migración 0300). Recibe una función
// `ejecutar` para funcionar igual con postgres.js (Supabase) que con PGlite (pruebas).
// Los parámetros jsonb se pasan como objetos: postgres.js y PGlite los serializan solos
// (un texto JSON se volvería a serializar en postgres.js y llegaría como escalar).
import type { Advertencia, OfertaCruda, OfertaValida } from '@comparador/dominio';

export type Ejecutar = (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

export type EstadoCorrida = 'ok' | 'parcial' | 'fallida' | 'sin_permiso';

export type ResumenCorrida = {
  corrida_id: number; tienda_id: string; estado: EstadoCorrida | 'en_curso';
  leidas: number; validas: number; en_cuarentena: number;
  nuevas: number; actualizadas: number; sin_cambios: number; desactivadas: number; error: string | null;
  agotadas: number;
};

export type Lote = {
  validas: OfertaValida[];
  cuarentena: { sku_tienda: string | null; reglas: string[]; payload: OfertaCruda }[];
  advertencias: Advertencia[];
  /** SKUs sin stock y sin precio: se marcan agotados conservando su último precio. */
  agotadas: string[];
};

/** Seam 2 de la ingesta: dónde quedan las ofertas. */
export interface Almacen {
  abrirCorrida(tiendaId: string): Promise<number>;
  cargar(corridaId: number, lote: Lote): Promise<void>;
  cerrar(corridaId: number, estado: EstadoCorrida, error?: string): Promise<ResumenCorrida>;
  /** Fuentes sitemap: desactiva las ofertas que ya no están en el sitemap o que la tienda retiró. */
  reconciliar(corridaId: number, vigentes: string[], retiradas: string[]): Promise<number>;
}

const MAX_LOTE = 1000; // límite de ingesta.cargar_lote

export function almacenPostgres(ejecutar: Ejecutar): Almacen {
  return {
    async abrirCorrida(tiendaId) {
      const [fila] = await ejecutar('select ingesta.abrir_corrida($1) as id', [tiendaId]);
      return Number(fila!.id);
    },
    async cargar(corridaId, { validas, cuarentena, advertencias, agotadas }) {
      for (let i = 0; i < validas.length; i += MAX_LOTE) {
        await ejecutar('select ingesta.cargar_lote($1::bigint, $2::jsonb)', [corridaId, validas.slice(i, i + MAX_LOTE)]);
      }
      // Una agotada no puede pasar por cargar_lote: la base exige precio > 0.
      for (let i = 0; i < agotadas.length; i += MAX_LOTE) {
        await ejecutar('select ingesta.marcar_agotadas($1::bigint, $2::jsonb)', [corridaId, agotadas.slice(i, i + MAX_LOTE)]);
      }
      if (cuarentena.length) await ejecutar('select ingesta.registrar_cuarentena($1::bigint, $2::jsonb)', [corridaId, cuarentena]);
      if (advertencias.length) await ejecutar('select ingesta.registrar_incidencias($1::bigint, $2::jsonb)', [corridaId, advertencias]);
    },
    async reconciliar(corridaId, vigentes, retiradas) {
      const [fila] = await ejecutar('select ingesta.desactivar_fuera_de_sitemap($1::bigint, $2::jsonb, $3::jsonb) as n',
        [corridaId, vigentes, retiradas]);
      return Number(fila!.n);
    },
    async cerrar(corridaId, estado, error) {
      const [c] = await ejecutar(
        'select * from ingesta.cerrar_corrida($1::bigint, $2::ingesta.estado_corrida, $3::text)',
        [corridaId, estado, error ?? null]);
      const n = (k: string) => Number(c![k] ?? 0);
      return {
        corrida_id: n('id'), tienda_id: String(c!.tienda_id), estado: c!.estado as ResumenCorrida['estado'],
        leidas: n('leidas'), validas: n('validas'), en_cuarentena: n('en_cuarentena'), nuevas: n('nuevas'),
        actualizadas: n('actualizadas'), sin_cambios: n('sin_cambios'), desactivadas: n('desactivadas'),
        error: (c!.error as string | null) ?? null, agotadas: n('agotadas'),
      };
    },
  };
}
