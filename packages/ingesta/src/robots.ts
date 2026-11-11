// robots.txt según RFC 9309: grupos por User-agent, comodín * y ancla $,
// gana la regla más larga que coincide y, si empatan, Allow.

type Regla = { permitir: boolean; patron: string };

function aRegex(patron: string): RegExp {
  const ancla = patron.endsWith('$');
  const cuerpo = (ancla ? patron.slice(0, -1) : patron)
    .split('*')
    .map(p => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp('^' + cuerpo + (ancla ? '$' : ''));
}

function reglasPara(robotsTxt: string, agente: string): Regla[] {
  const grupos: { agentes: string[]; reglas: Regla[] }[] = [];
  let actual: { agentes: string[]; reglas: Regla[] } | null = null;
  let leyendoAgentes = false;
  for (const linea of robotsTxt.split(/\r?\n/)) {
    const sinComentario = linea.replace(/#.*/, '').trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(sinComentario);
    if (!m) continue;
    const campo = m[1]!.toLowerCase();
    const valor = m[2]!.trim();
    if (campo === 'user-agent') {
      if (!leyendoAgentes || !actual) { actual = { agentes: [], reglas: [] }; grupos.push(actual); }
      actual.agentes.push(valor.toLowerCase());
      leyendoAgentes = true;
    } else if ((campo === 'allow' || campo === 'disallow') && actual) {
      leyendoAgentes = false;
      if (valor) actual.reglas.push({ permitir: campo === 'allow', patron: valor });
    } else {
      leyendoAgentes = false;
    }
  }
  const token = agente.toLowerCase();
  const propios = grupos.filter(g => g.agentes.some(a => a !== '*' && token.includes(a)));
  const elegidos = propios.length ? propios : grupos.filter(g => g.agentes.includes('*'));
  // Varios grupos para el mismo agente se combinan (RFC 9309 §2.2.1).
  return elegidos.flatMap(g => g.reglas);
}

/** ¿Puede el agente pedir esta ruta (con su query string)? */
export function permitido(robotsTxt: string, ruta: string, agente = 'DecideAqui'): boolean {
  let mejor: Regla | null = null;
  for (const r of reglasPara(robotsTxt, agente)) {
    if (!aRegex(r.patron).test(ruta)) continue;
    if (!mejor || r.patron.length > mejor.patron.length ||
        (r.patron.length === mejor.patron.length && r.permitir)) mejor = r;
  }
  return mejor ? mejor.permitir : true;
}
