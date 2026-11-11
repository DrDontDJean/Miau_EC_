// Prueba de humo: 1 usuario durante 30 s. Corre en cada vista previa de Vercel.
import { sleep } from 'k6';
import { recorrido, calentar, salida, buscar, UMBRALES_BASE } from './lib/comun.js';

export const options = {
  vus: 1,
  duration: __ENV.DURACION || '30s',
  thresholds: {
    ...UMBRALES_BASE,
    'http_req_duration{tipo:buscar}': ['p(95)<800'],
    'http_req_duration{tipo:salida}': ['p(95)<300'],
  },
};

export function setup() { calentar(); salida(buscar('televisor 55', 'relevancia', 'calentamiento')); }
export default function () { recorrido(() => sleep(1)); }
