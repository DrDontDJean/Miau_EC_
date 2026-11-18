// Uso: node scripts/hash-clave-admin.mjs "<contraseña>"
// Imprime el valor para ADMIN_CLAVE_HASH (scrypt con sal aleatoria) y un ADMIN_SECRETO nuevo.
import { randomBytes, scryptSync } from 'node:crypto';

const clave = process.argv[2];
if (!clave) {
  console.error('Uso: node scripts/hash-clave-admin.mjs "<contraseña>"');
  process.exit(1);
}
const sal = randomBytes(16);
console.log(`ADMIN_CLAVE_HASH='scrypt:${sal.toString('hex')}:${scryptSync(clave, sal, 64).toString('hex')}'`);
console.log(`ADMIN_SECRETO='${randomBytes(32).toString('base64url')}'`);
