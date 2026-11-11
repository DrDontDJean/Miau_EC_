// Empaqueta el proyecto para pasarlo a otra persona sin datos ni secretos del autor.
// Uso (desde la carpeta del proyecto):  node scripts/empaquetar-entrega.mjs [--salida ruta.zip]
//
// - Incluye solo los archivos versionados y los nuevos no ignorados (git ls-files). Así quedan fuera
//   .env, .git (historial y autores), node_modules, .next, .vercel, supabase/.temp y los clics locales.
// - Antes de escribir el zip busca en cada archivo los valores del .env, los emails de git y patrones
//   de claves. Si encuentra algo, no crea el zip y dice dónde y de qué tipo es, nunca el valor.
// - El zip se escribe fuera del proyecto (por defecto ../DecideAqui-entrega.zip) para no versionarlo.
// Sin dependencias: zip con deflate de node:zlib.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateRawSync } from 'node:zlib';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(raiz);

const iSalida = process.argv.indexOf('--salida');
const salida = resolve(iSalida > 0 ? process.argv[iSalida + 1] : '../DecideAqui-entrega.zip');
if (salida.startsWith(raiz + (process.platform === 'win32' ? '\\' : '/'))) {
  console.error('✖ El zip debe quedar fuera del proyecto para no versionarlo.'); process.exit(1);
}

const git = (...a) => { try { return execFileSync('git', a, { encoding: 'utf8' }).trim(); } catch { return ''; } };
if (!git('rev-parse', '--is-inside-work-tree')) {
  console.error('✖ Hace falta git: el script usa .gitignore para decidir qué entra.'); process.exit(1);
}

// Además de .gitignore, nunca se incluyen estos, aunque alguien los añada al índice por error.
const PROHIBIDOS = [/(^|\/)\.env($|\.(?!example$))/, /(^|\/)\.git\//, /(^|\/)node_modules\//, /(^|\/)\.next\//,
  /(^|\/)\.vercel\//, /^supabase\/\.temp\//, /\.(pem|key|p12|pfx)$/i, /(^|\/)id_(rsa|ed25519)/];
const archivos = git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0')
  .filter(f => f && existsSync(f) && statSync(f).isFile());
const vetados = archivos.filter(f => PROHIBIDOS.some(r => r.test(f)));
if (vetados.length) { console.error('✖ Archivos que nunca deben salir:', vetados); process.exit(1); }

// ── Qué buscar ────────────────────────────────────────────────────────────────
const buscados = [];   // [tipo, valor]
if (existsSync('.env')) {
  for (const linea of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const i = linea.indexOf('=');
    if (i < 1 || linea.trimStart().startsWith('#')) continue;
    const clave = linea.slice(0, i).trim();
    const valor = linea.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (valor.length >= 8) buscados.push([`valor de ${clave} (.env)`, valor]);
    if (clave === 'DATABASE_URL') {
      try {
        const u = new URL(valor);
        if (u.password.length >= 6) buscados.push(['contraseña dentro de DATABASE_URL', decodeURIComponent(u.password)]);
        if (u.hostname) buscados.push(['host de la base (DATABASE_URL)', u.hostname]);
        if (u.username.length >= 8) buscados.push(['usuario de la base (DATABASE_URL)', u.username]);
      } catch { /* URI inválida: igual se busca completa */ }
    }
    if (clave === 'GITHUB_REPO' && valor.includes('/')) buscados.push(['usuario de GitHub (GITHUB_REPO)', valor.split('/')[0]]);
  }
} else {
  console.warn('⚠ No hay .env: solo se buscan patrones genéricos.');
}
for (const ambito of ['--local', '--global']) {
  const email = git('config', ambito, 'user.email');
  if (email) buscados.push([`email de git (${ambito.slice(2)})`, email]);
}
const PATRONES = [
  ['clave secreta de Supabase', /sb_secret_[A-Za-z0-9_-]{10,}/],
  ['clave publicable de Supabase', /sb_publishable_[A-Za-z0-9_-]{10,}/],
  ['URI de Postgres con contraseña', /postgres(?:ql)?:\/\/[^\s:'"/@]+:(?!\[YOUR-PASSWORD\])[^\s'"@]{4,}@/i],
  ['JWT', /eyJhbGciOi[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['token de GitHub', /\b(?:ghp|gho|ghs|ghu)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/],
  ['clave privada', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

// ── Revisión ──────────────────────────────────────────────────────────────────
const hallazgos = [];
const contenidos = new Map();
for (const f of archivos) {
  const datos = readFileSync(f);
  contenidos.set(f, datos);
  const texto = datos.toString('latin1') + '\n' + datos.toString('utf8');
  for (const [tipo, valor] of buscados) if (texto.includes(valor)) hallazgos.push(`${f}: ${tipo}`);
  for (const [tipo, re] of PATRONES) if (re.test(texto)) hallazgos.push(`${f}: ${tipo}`);
}
if (hallazgos.length) {
  console.error(`✖ No se crea el zip. ${hallazgos.length} hallazgo(s) (se muestra el tipo, nunca el valor):`);
  for (const h of [...new Set(hallazgos)]) console.error('   -', h);
  process.exit(1);
}

// ── Zip ───────────────────────────────────────────────────────────────────────
const carpeta = basename(raiz);
const ahora = new Date();
const dosHora = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1);
const dosFecha = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();
const locales = [], centrales = [];
let offset = 0;
for (const f of archivos.sort()) {
  const nombre = Buffer.from(`${carpeta}/${f}`, 'utf8');
  const datos = contenidos.get(f);
  const comprimido = deflateRawSync(datos, { level: 9 });
  const crc = crc32(datos) >>> 0;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(8, 8); local.writeUInt16LE(dosHora, 10); local.writeUInt16LE(dosFecha, 12);
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(comprimido.length, 18); local.writeUInt32LE(datos.length, 22);
  local.writeUInt16LE(nombre.length, 26); local.writeUInt16LE(0, 28);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10); central.writeUInt16LE(dosHora, 12);
  central.writeUInt16LE(dosFecha, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(comprimido.length, 20);
  central.writeUInt32LE(datos.length, 24); central.writeUInt16LE(nombre.length, 28);
  central.writeUInt32LE(offset, 42);
  locales.push(local, nombre, comprimido);
  centrales.push(central, nombre);
  offset += local.length + nombre.length + comprimido.length;
}
const dir = Buffer.concat(centrales);
const fin = Buffer.alloc(22);
fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(archivos.length, 8); fin.writeUInt16LE(archivos.length, 10);
fin.writeUInt32LE(dir.length, 12); fin.writeUInt32LE(offset, 16);
writeFileSync(salida, Buffer.concat([...locales, dir, fin]));

console.log(`✔ ${archivos.length} archivos revisados: sin valores del .env, emails de git ni claves.`);
console.log(`✔ Paquete: ${salida} (${(statSync(salida).size / 1024).toFixed(0)} KB)`);
console.log('  Fuera: .env, .git (historial y autores), node_modules, .next, .vercel, supabase/.temp.');
console.log('  Quien lo reciba sigue GUIA-REPLICA.md desde la sección 1.');
