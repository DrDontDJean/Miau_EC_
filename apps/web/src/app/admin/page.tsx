import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { COOKIE_ADMIN, accesoConfigurado, sesionValida } from '@/lib/admin';
import { FormularioIngreso } from './formulario';

export const metadata: Metadata = { title: 'Iniciar sesión' };

/** Con la sesión ya abierta no tiene sentido volver a pedir la clave. */
async function SiYaEntro() {
  if (sesionValida((await cookies()).get(COOKIE_ADMIN)?.value)) redirect('/admin/tiendas');
  return null;
}

export default function IngresoAdmin() {
  return (
    <section className="mx-auto max-w-md rounded-2xl bg-superficie p-6 sm:p-8">
      <Suspense><SiYaEntro /></Suspense>
      <h1 className="text-2xl font-extrabold tracking-tight">Acceso de administradores</h1>
      <p className="mt-2 text-suave">Para gestionar las tiendas del comparador.</p>
      <FormularioIngreso disponible={accesoConfigurado()} />
    </section>
  );
}
