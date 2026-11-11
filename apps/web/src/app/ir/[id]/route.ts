// Redirector de salida (equivalente al /relocator/relocate de idealo): registra la salida y redirige.
import { crearCatalogo } from '@/lib/catalogo';
import { crearIrGET } from '@/lib/rutas';
import { clienteSupabase } from '@/lib/supabase';

export const GET = crearIrGET((...args) => crearCatalogo(clienteSupabase()).registrarSalida(...args));
