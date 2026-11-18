'use client';

import { useActionState } from 'react';
import { iniciarSesion, type EstadoIngreso } from './acciones';

const CAMPO = 'min-h-11 rounded-lg border border-borde-control bg-superficie px-3 text-base aria-invalid:border-[#b42318]';

export function FormularioIngreso() {
  const [estado, accion, enviando] = useActionState<EstadoIngreso, FormData>(iniciarSesion, {});
  const error = estado.error;
  return (
    <form action={accion} className="mt-6 flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Correo</span>
        <input type="text" inputMode="email" name="correo" autoComplete="username" required defaultValue={estado.correo}
          aria-invalid={error ? true : undefined} aria-describedby={error ? 'error-ingreso' : undefined} className={CAMPO} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Contraseña</span>
        <input type="password" name="clave" autoComplete="current-password" required
          aria-invalid={error ? true : undefined} aria-describedby={error ? 'error-ingreso' : undefined} className={CAMPO} />
      </label>
      {error && <p id="error-ingreso" role="alert" className="text-sm font-semibold text-[#b42318]">{error}</p>}
      <button type="submit" disabled={enviando}
        className="mt-2 min-h-11 rounded-lg bg-accion px-4 font-semibold text-en-accion transition-colors hover:bg-accion-fuerte disabled:cursor-wait disabled:opacity-70">
        {enviando ? 'Entrando…' : 'Iniciar sesión'}
      </button>
    </form>
  );
}
