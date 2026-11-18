import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { COOKIE_ADMIN, sesionValida } from '@/lib/admin';
import { cerrarSesion } from '../acciones';

export const metadata: Metadata = { title: 'Tiendas · Administración' };

// Pestañas del panel. Por ahora solo existe «Tiendas», y aún sin funciones.
const PESTANAS = [{ href: '/admin/tiendas', etiqueta: 'Tiendas' }];

/** Sin sesión válida, de vuelta al ingreso. Todo el panel vive dentro de esta comprobación. */
async function Panel() {
  if (!sesionValida((await cookies()).get(COOKIE_ADMIN)?.value)) redirect('/admin');
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight">Administración</h1>
          <form action={cerrarSesion}>
            <button type="submit" className="min-h-11 rounded-lg border border-borde-control px-4 font-semibold transition-colors hover:bg-seccion">
              Cerrar sesión
            </button>
          </form>
        </div>
        <nav aria-label="Secciones de administración" className="mt-4 border-b border-borde">
          <ul className="flex gap-2">
            {PESTANAS.map(p => (
              <li key={p.href}>
                <Link href={p.href} aria-current="page"
                  className="-mb-px flex min-h-11 items-center border-b-[3px] border-accion px-3 font-semibold">
                  {p.etiqueta}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <section className="rounded-2xl bg-superficie p-6 sm:p-8">
        <h2 className="text-xl font-bold">Tiendas</h2>
        <p className="mt-2 max-w-[65ch] text-suave">
          Desde aquí se podrá modificar los datos de cada tienda y activarla o desactivarla en la búsqueda. Esta sección todavía no está disponible.
        </p>
      </section>
    </div>
  );
}

export default function PanelTiendas() {
  return (
    <Suspense fallback={<div role="status" aria-label="Cargando" className="esqueleto h-40" />}>
      <Panel />
    </Suspense>
  );
}
