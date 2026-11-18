import { randomBytes, scryptSync } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearValorSesion, sesionValida, verificarCredenciales } from '../src/lib/admin';

const sal = randomBytes(16);

beforeEach(() => {
  process.env.ADMIN_CORREO = 'admin@ejemplo';
  process.env.ADMIN_CLAVE_HASH = `scrypt:${sal.toString('hex')}:${scryptSync('clave-de-prueba', sal, 64).toString('hex')}`;
  process.env.ADMIN_SECRETO = 'secreto-de-prueba';
});

describe('verificarCredenciales', () => {
  it('acepta el correo (sin importar mayúsculas) y la clave configurados', () => {
    expect(verificarCredenciales('Admin@Ejemplo', 'clave-de-prueba')).toBe(true);
  });
  it('rechaza una clave o un correo distintos', () => {
    expect(verificarCredenciales('admin@ejemplo', 'otra')).toBe(false);
    expect(verificarCredenciales('otro@ejemplo', 'clave-de-prueba')).toBe(false);
  });
  it('rechaza todo si falta la configuración', () => {
    delete process.env.ADMIN_CLAVE_HASH;
    expect(verificarCredenciales('admin@ejemplo', 'clave-de-prueba')).toBe(false);
  });
});

describe('sesión', () => {
  it('valida una cookie recién firmada', () => {
    expect(sesionValida(crearValorSesion())).toBe(true);
  });
  it('rechaza una cookie vencida, alterada o firmada con otro secreto', () => {
    const valor = crearValorSesion(0);
    expect(sesionValida(valor)).toBe(false);
    const actual = crearValorSesion();
    expect(sesionValida(actual.replace(/^\d+/, '9999999999999'))).toBe(false);
    process.env.ADMIN_SECRETO = 'otro-secreto';
    expect(sesionValida(actual)).toBe(false);
  });
});
