// Contrato JSON que usan k6 (tests/carga) y cualquier cliente: ver src/lib/rutas.ts.
import { buscarCacheado } from '@/lib/datos';
import { crearBuscarGET } from '@/lib/rutas';

export const GET = crearBuscarGET(buscarCacheado);
