// Carga esperada: hasta 50 compradores simultáneos (≈ 15 búsquedas/s) durante 5 minutos.
import { sleep } from 'k6';
import { recorrido, calentar, UMBRALES_BASE } from './lib/comun.js';

export const options = {
  scenarios: {
    compradores: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: Number(__ENV.VUS || 50) },
        { duration: __ENV.MESETA || '3m', target: Number(__ENV.VUS || 50) },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '20s',
    },
  },
  thresholds: {
    ...UMBRALES_BASE,
    'http_req_duration{tipo:buscar}': ['p(95)<500', 'p(99)<1200'],
    'http_req_duration{tipo:salida}': ['p(95)<250'],
  },
};

export function setup() { calentar(); }
export default function () { recorrido(() => sleep(1 + Math.random() * 3)); }
