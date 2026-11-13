// Uso: node scripts/avisos-operacion.mjs  (necesita DATABASE_URL)
// Revisa los avisos de operación (calidad.revisar_operacion), los escribe en el resumen del job de GitHub Actions
// y termina con código 1 si hay avisos de las últimas 26 h, para que GitHub avise por correo.
import postgres from 'postgres';
import { appendFileSync } from 'node:fs';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1, prepare: false });
try {
  await sql`select calidad.revisar_operacion()`;
  const avisos = await sql`
    select regla_id, tienda_id, detalle, creado_en
      from calidad.incidencia
     where regla_id in ('tienda_falla_repetida', 'base_grande', 'tienda_desactualizada')
       and creado_en > now() - interval '26 hours'
     order by creado_en desc`;
  const lineas = avisos.length === 0
    ? ['✔ Sin avisos de operación.']
    : ['## ⚠ Avisos de operación', '', ...avisos.map((a) => `- **${a.regla_id}** · ${a.tienda_id} · ${JSON.stringify(a.detalle)}`)];
  console.log(lineas.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lineas.join('\n') + '\n');
  if (avisos.length > 0) process.exitCode = 1;
} finally {
  await sql.end();
}
