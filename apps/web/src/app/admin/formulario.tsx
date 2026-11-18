'use client';

import { useActionState, useState } from 'react';
import { iniciarSesion, type EstadoIngreso } from './acciones';

const CAMPO = 'min-h-11 rounded-lg border border-borde-control bg-superficie px-3 text-base aria-invalid:border-[#b42318]';

/** `disponible` es falso si el servidor no tiene ADMIN_*: entonces el botón no se puede pulsar. */
export function FormularioIngreso({ disponible }: { disponible: boolean }) {
  const [estado, accion, enviando] = useActionState<EstadoIngreso, FormData>(iniciarSesion, {});
  const [correo, setCorreo] = useState(estado.correo ?? '');
  const [clave, setClave] = useState('');
  const error = estado.error;
  const bloqueado = !disponible || !correo.trim() || !clave;
  return (
    <form action={accion} className="mt-6 flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Correo</span>
        <input type="text" inputMode="email" name="correo" autoComplete="username" required value={correo} onChange={(e) => setCorreo(e.target.value)}
          aria-invalid={error ? true : undefined} aria-describedby={error ? 'error-ingreso' : undefined} className={CAMPO} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Contraseña</span>
        <input type="password" name="clave" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)}
          aria-invalid={error ? true : undefined} aria-describedby={error ? 'error-ingreso' : undefined} className={CAMPO} />
      </label>
      {error && <p id="error-ingreso" role="alert" className="text-sm font-semibold text-[#b42318]">{error}</p>}
      <button type="submit" disabled={enviando || bloqueado}
        className={`mt-2 min-h-11 rounded-lg bg-accion px-4 font-semibold text-en-accion transition-colors enabled:hover:bg-accion-fuerte disabled:opacity-50 ${enviando ? 'disabled:cursor-wait' : 'disabled:cursor-not-allowed'}`}>
        {enviando ? 'Entrando…' : 'Iniciar sesión'}
      </button>
    </form>
  );
}
