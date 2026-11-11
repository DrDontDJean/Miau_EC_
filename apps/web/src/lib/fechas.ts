// Fechas siempre en hora de Ecuador: la ingesta corre a las 06:17 UTC, que son las 01:17 en Guayaquil.
const ZONA = 'America/Guayaquil';

const hora = new Intl.DateTimeFormat('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA });
const dia = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', timeZone: ZONA });
const clave = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: ZONA });

const UN_DIA = 86_400_000;

/** "11 nov" en hora de Ecuador. */
export const diaCorto = (ms: number | string) => dia.format(new Date(ms)).replace('.', '');

/** "01:17" en hora de Ecuador. */
export const horaCorta = (ms: number | string) => hora.format(new Date(ms));

/**
 * Cuándo se leyó un precio: "hoy 01:17", "ayer 01:17" o "9 nov 01:17".
 * Sin `ahora` (páginas que no pueden leer el reloj) siempre da la fecha completa.
 */
export function leido(iso: string, ahora?: number): string {
  const t = new Date(iso).getTime();
  if (ahora !== undefined) {
    if (clave.format(t) === clave.format(ahora)) return `hoy ${horaCorta(t)}`;
    if (clave.format(t) === clave.format(ahora - UN_DIA)) return `ayer ${horaCorta(t)}`;
  }
  return `${diaCorto(t)} ${horaCorta(t)}`;
}

/** Días completos entre dos instantes. */
export const diasEntre = (desde: number, hasta: number) => Math.floor((hasta - desde) / UN_DIA);
