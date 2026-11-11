// Estrés: sube por escalones hasta 300 usuarios para encontrar el punto de quiebre.
// Se aborta solo si los errores pasan del 10 %.
import { sleep } from 'k6';
import { recorrido, calentar } from './lib/comun.js';

const tope = Number(__ENV.VUS || 300);
export const options = {
  scenarios: {
    escalones: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [0.25, 0.5, 0.75, 1].flatMap(f => [
        { duration: '1m', target: Math.round(tope * f) },
        { duration: __ENV.ESCALON || '2m', target: Math.round(tope * f) },
      ]).concat([{ duration: '1m', target: 0 }]),
    },
  },
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.10', abortOnFail: true, delayAbortEval: '30s' }],
    'http_req_duration{tipo:buscar}': ['p(95)<2000'],
  },
};

export function setup() { calentar(); }
export default function () { recorrido(() => sleep(0.5 + Math.random())); }
