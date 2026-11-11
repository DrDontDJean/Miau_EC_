// Postgres real en WebAssembly con las migraciones de Supabase, para probar contra el SQL verdadero.
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Ejecutar } from '../src/almacen/postgres.ts';

const SUPABASE = fileURLToPath(new URL('../../../supabase/', import.meta.url));

export async function baseDePrueba() {
  const db = new PGlite({ extensions: { pg_trgm } });
  // Roles y esquema extensions como en Supabase; unaccent no existe en PGlite y se sustituye.
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema extensions; grant usage on schema extensions to anon, authenticated, service_role;
    create text search dictionary extensions.unaccent (template = simple, accept = false);
    create function extensions.unaccent(regdictionary, text) returns text language sql immutable as
      $$ select translate($2, 'áéíóúÁÉÍÓÚñÑüÜ', 'aeiouAEIOUnNuU') $$;`);
  for (const f of readdirSync(`${SUPABASE}migrations`).sort()) {
    await db.exec(readFileSync(`${SUPABASE}migrations/${f}`, 'utf8').replace(/create extension if not exists unaccent[^;]*;/i, ''));
  }
  await db.exec(readFileSync(`${SUPABASE}seed.sql`, 'utf8'));
  const ejecutar: Ejecutar = async (sql, params = []) => (await db.query(sql, params)).rows as Record<string, unknown>[];
  return { db, ejecutar };
}
