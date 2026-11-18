// Sesión de administrador sin dependencias: credenciales en variables de entorno
// (la clave solo como hash scrypt) y una cookie firmada con HMAC.
//   ADMIN_CORREO      correo del administrador
//   ADMIN_CLAVE_HASH  scrypt:<sal hex>:<hash hex>  (ver scripts/hash-clave-admin.mjs)
//   ADMIN_SECRETO     secreto aleatorio para firmar la cookie
import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';

export const COOKIE_ADMIN = 'decideaqui_admin';
export const DURACION_SESION_S = 8 * 60 * 60;

const iguales = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);

function configuracion() {
  const correo = process.env.ADMIN_CORREO?.trim().toLowerCase();
  const hash = process.env.ADMIN_CLAVE_HASH?.trim();
  const secreto = process.env.ADMIN_SECRETO?.trim();
  return correo && hash && secreto ? { correo, hash, secreto } : null;
}

export const accesoConfigurado = () => configuracion() !== null;

/** true si el correo y la clave coinciden con los configurados. */
export function verificarCredenciales(correo: string, clave: string): boolean {
  const c = configuracion();
  if (!c) return false;
  const [tipo, sal, esperado] = c.hash.split(':');
  if (tipo !== 'scrypt' || !sal || !esperado) return false;
  const calculado = scryptSync(clave, Buffer.from(sal, 'hex'), 64);
  // Se calcula el hash siempre, aunque el correo no coincida, para no revelar cuál falló por el tiempo.
  const claveOk = iguales(calculado, Buffer.from(esperado, 'hex'));
  const correoOk = iguales(Buffer.from(correo.trim().toLowerCase()), Buffer.from(c.correo));
  return claveOk && correoOk;
}

const firmar = (datos: string, secreto: string) => createHmac('sha256', secreto).update(datos).digest('base64url');

/** Valor de cookie "<vence>.<firma>" para una sesión nueva. */
export function crearValorSesion(ahora = Date.now()): string {
  const c = configuracion();
  if (!c) throw new Error('Acceso de administrador sin configurar (ADMIN_CORREO, ADMIN_CLAVE_HASH, ADMIN_SECRETO).');
  const vence = String(ahora + DURACION_SESION_S * 1000);
  return `${vence}.${firmar(`${c.correo}|${vence}`, c.secreto)}`;
}

/** true si la cookie está firmada con el secreto actual y no ha vencido. */
export function sesionValida(valor: string | undefined, ahora = Date.now()): boolean {
  const c = configuracion();
  if (!c || !valor) return false;
  const [vence, firma] = valor.split('.');
  if (!vence || !firma || !/^\d+$/.test(vence) || Number(vence) < ahora) return false;
  return iguales(Buffer.from(firma), Buffer.from(firmar(`${c.correo}|${vence}`, c.secreto)));
}
