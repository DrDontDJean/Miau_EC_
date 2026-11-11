// Una corrida (GLOSSARY): lectura completa del catálogo de una tienda, de principio a fin.
import { validar, type Advertencia, type OfertaValida } from '@comparador/dominio';
import type { Almacen, Lote, ResumenCorrida } from './almacen/postgres.ts';
import { permitido } from './robots.ts';
import type { Fuente, TiendaIngesta } from './tipos.ts';

export type DependenciasCorrida = {
  fuente: Fuente;
  almacen: Almacen;
  /** Contenido de /robots.txt de la tienda ('' si no existe). */
  leerRobots: () => Promise<string>;
  /** Para pruebas contra tiendas reales: corta tras N páginas y cierra como 'parcial'. */
  limitePaginas?: number;
};

/** Ruta que la fuente pedirá a la tienda; es la que se comprueba contra robots.txt (ADR 0007). */
export function rutaDeLectura(tienda: TiendaIngesta): string | null {
  switch (tienda.plataforma) {
    case 'vtex': return '/api/catalog_system/pub/products/search?fq=C:/1/&_from=0&_to=49';
    case 'woocommerce': return '/wp-json/wc/store/v1/products?page=1&per_page=100';
    case 'feed': return null; // el feed existe por acuerdo con la tienda
  }
}

export async function ejecutarCorrida(tienda: TiendaIngesta, deps: DependenciasCorrida): Promise<ResumenCorrida> {
  const corrida = await deps.almacen.abrirCorrida(tienda.id);
  try {
    const ruta = rutaDeLectura(tienda);
    if (ruta && !permitido(await deps.leerRobots(), ruta)) {
      return await deps.almacen.cerrar(corrida, 'sin_permiso', `robots.txt prohíbe ${ruta}`);
    }
    const mejorPrecio = new Map<string, number>(); // SKU → precio cargado en esta corrida
    let paginas = 0;
    for await (const pagina of deps.fuente.leer()) {
      paginas++;
      const lote: Lote = { validas: [], cuarentena: [], advertencias: [] };
      const enLote = new Map<string, number>(); // SKU → índice en lote.validas
      for (const cruda of pagina) {
        const r = validar(cruda, tienda);
        if (r.tipo === 'cuarentena') {
          lote.cuarentena.push({ sku_tienda: r.sku_tienda, reglas: r.reglas, payload: cruda });
          continue;
        }
        const o: OfertaValida = r.oferta;
        const previo = mejorPrecio.get(o.sku_tienda);
        if (previo !== undefined) {
          const dup: Advertencia = { regla_id: 'sku_duplicado', sku_tienda: o.sku_tienda, detalle: { precios: [previo, o.precio] } };
          lote.advertencias.push(dup);
          if (o.precio >= previo) continue; // se conserva el más barato
          const i = enLote.get(o.sku_tienda);
          if (i !== undefined) { lote.validas[i] = o; mejorPrecio.set(o.sku_tienda, o.precio); continue; }
        }
        mejorPrecio.set(o.sku_tienda, o.precio);
        enLote.set(o.sku_tienda, lote.validas.push(o) - 1);
        lote.advertencias.push(...r.advertencias);
      }
      await deps.almacen.cargar(corrida, lote);
      // Cortar aquí, antes de pedir la página siguiente a la tienda.
      if (deps.limitePaginas !== undefined && paginas >= deps.limitePaginas) {
        return await deps.almacen.cerrar(corrida, 'parcial', `limitada a ${deps.limitePaginas} páginas`);
      }
    }
    return await deps.almacen.cerrar(corrida, 'ok');
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    return await deps.almacen.cerrar(corrida, 'fallida', mensaje.slice(0, 500));
  }
}
