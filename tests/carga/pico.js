// Pico tipo Black Friday / Cyber Day: de 10 a 400 búsquedas por segundo en 30 s.
import { recorrido, calentar } from './lib/comun.js';

const tope = Number(__ENV.RPS || 400);
export const options = {
  scenarios: {
    black_friday: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: Number(__ENV.MAX_VUS || 600),
      stages: [
        { duration: '30s', target: 10 },
        { duration: '30s', target: tope },
        { duration: __ENV.MESETA || '2m', target: tope },
        { duration: '30s', target: 10 },
      ],
    },
  },
  thresholds: {
    'http_req_failed{tipo:buscar}': ['rate<0.02'],
    'http_req_duration{tipo:buscar}': ['p(95)<1500'],
    dropped_iterations: ['count<100'],
  },
};

export function setup() { calentar(); }
export default function () { recorrido(() => {}); }
