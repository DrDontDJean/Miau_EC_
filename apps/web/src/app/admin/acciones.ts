'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_ADMIN, DURACION_SESION_S, accesoConfigurado, crearValorSesion, verificarCredenciales } from '@/lib/admin';

export type EstadoIngreso = { error?: string; correo?: string };

export async function iniciarSesion(_previo: EstadoIngreso, datos: FormData): Promise<EstadoIngreso> {
  const correo = String(datos.get('correo') ?? '');
  const clave = String(datos.get('clave') ?? '');
  if (!accesoConfigurado()) return { error: 'El acceso de administradores no está configurado en este servidor.', correo };
  if (!correo || !clave) return { error: 'Escriba el correo y la contraseña.', correo };
  if (!verificarCredenciales(correo, clave)) return { error: 'Correo o contraseña incorrectos.', correo };

  (await cookies()).set(COOKIE_ADMIN, crearValorSesion(), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: DURACION_SESION_S,
  });
  redirect('/admin/tiendas');
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE_ADMIN);
  redirect('/admin');
}
