// Carga supabase/seed.sql (tiendas y categorías) en la base de DATABASE_URL. Idempotente.
// Uso: node --env-file=.env scripts/cargar-seed.mjs
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1, prepare: false, onnotice: () => {} });
try {
  await sql.unsafe(readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8'));
  const t = await sql`select estado::text, count(*)::int n from public.tienda group by 1 order by 1`;
  console.log('tiendas por estado:', Object.fromEntries(t.map(r => [r.estado, r.n])));
  console.log('categorías:', (await sql`select count(*)::int n from public.categoria`)[0].n);
} finally { await sql.end(); }
