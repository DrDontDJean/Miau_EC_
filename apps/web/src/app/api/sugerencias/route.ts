// Sugerencias del buscador mientras se escribe: ver crearSugerenciasGET en src/lib/rutas.ts.
import { sugerenciasCacheadas } from '@/lib/datos';
import { crearSugerenciasGET } from '@/lib/rutas';

export const GET = crearSugerenciasGET(sugerenciasCacheadas);
