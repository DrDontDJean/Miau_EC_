import { createHash } from 'node:crypto';
import { claveDeProducto } from './clave-producto.ts';

export type Tienda = { id: string; nombre: string; origen: string };

/** Oferta tal como la entrega una fuente, antes de cualquier regla de calidad. */
export type OfertaCruda = {
  sku_tienda?: string | null;
  titulo?: string | null;
  url?: string | null;
  imagen_url?: string | null;
  precio?: number | null;
  precio_lista?: number | null;
  moneda?: string | null;
  disponible?: boolean | null;
  ean?: string | null;
  marca?: string | null;
};

/** Forma exacta que espera ingesta.cargar_lote(). */
export type OfertaValida = {
  sku_tienda: string;
  titulo: string;
  url: string;
  imagen_url: string | null;
  precio: number;
  precio_lista: number | null;
  disponible: boolean;
  ean: string | null;
  modelo: string | null;
  marca: string | null;
  huella: string;
};

/** Ids iguales a calidad.regla con severidad 'bloqueante'. */
export type ReglaBloqueante = 'precio_invalido' | 'url_fuera_de_tienda' | 'titulo_vacio' | 'sku_ausente' | 'moneda_no_usd';

/** Ids iguales a calidad.regla con severidad 'advertencia' que se detectan oferta por oferta. */
export type ReglaAdvertencia = 'ean_invalido' | 'precio_lista_menor' | 'sin_imagen' | 'sin_emparejar' | 'sku_duplicado';

export type Advertencia = { regla_id: ReglaAdvertencia; sku_tienda: string; detalle?: Record<string, unknown> };

export type Validacion =
  | { tipo: 'valida'; oferta: OfertaValida; advertencias: Advertencia[] }
  | { tipo: 'cuarentena'; sku_tienda: string | null; reglas: ReglaBloqueante[] }
  /** Sin stock y sin precio (VTEX y otras mandan Price 0): es una lectura correcta, no un fallo. */
  | { tipo: 'agotada'; sku_tienda: string };

const limpiar = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

function perteneceATienda(url: string, origen: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.origin === new URL(origen).origin;
  } catch {
    return false;
  }
}

export function validar(c: OfertaCruda, tienda: Tienda): Validacion {
  const titulo = limpiar(c.titulo);
  const sku = limpiar(c.sku_tienda);
  const reglas: ReglaBloqueante[] = [];
  if (typeof c.precio !== 'number' || !(c.precio > 0 && c.precio < 100000)) reglas.push('precio_invalido');
  if (!perteneceATienda(limpiar(c.url), tienda.origen)) reglas.push('url_fuera_de_tienda');
  if (titulo.length < 3) reglas.push('titulo_vacio');
  if (!sku) reglas.push('sku_ausente');
  if (c.moneda && c.moneda.toUpperCase() !== 'USD') reglas.push('moneda_no_usd');
  // Agotada: sin stock y sin precio (o con precio 0), sin ningún otro fallo bloqueante.
  // Un precio negativo, o precio 0 en una oferta disponible, siguen siendo precio_invalido.
  const sinPrecio = c.precio === null || c.precio === undefined || c.precio === 0;
  if (c.disponible === false && sinPrecio && reglas.length === 1 && reglas[0] === 'precio_invalido') {
    return { tipo: 'agotada', sku_tienda: sku };
  }
  if (reglas.length) return { tipo: 'cuarentena', sku_tienda: sku || null, reglas };

  const precio = Number(c.precio);
  const advertencias: Advertencia[] = [];
  const anotar = (regla_id: ReglaAdvertencia, detalle?: Record<string, unknown>) =>
    advertencias.push(detalle ? { regla_id, sku_tienda: sku, detalle } : { regla_id, sku_tienda: sku });

  const eanCrudo = limpiar(c.ean);
  const { ean, modelo } = claveDeProducto({ titulo, ean: eanCrudo });
  // Solo es "EAN inválido" si tiene forma de EAN; los códigos internos cortos se ignoran sin más.
  if (!ean && /^\d{12,14}$/.test(eanCrudo)) anotar('ean_invalido', { ean: eanCrudo });

  let precio_lista = typeof c.precio_lista === 'number' ? c.precio_lista : null;
  if (precio_lista !== null && precio_lista < precio) anotar('precio_lista_menor');
  if (precio_lista !== null && !(precio_lista > precio)) precio_lista = null; // igual = sin descuento

  const imagen_url = c.imagen_url ? limpiar(c.imagen_url) : null;
  if (!imagen_url) anotar('sin_imagen');
  if (!ean && !modelo) anotar('sin_emparejar');

  const sinHuella = {
    sku_tienda: sku,
    titulo,
    url: limpiar(c.url),
    imagen_url,
    precio,
    precio_lista,
    disponible: c.disponible !== false,
    ean,
    modelo,
    marca: limpiar(c.marca) || null,
  };
  const huella = createHash('sha256').update(JSON.stringify(sinHuella)).digest('hex');
  return { tipo: 'valida', oferta: { ...sinHuella, huella }, advertencias };
}
