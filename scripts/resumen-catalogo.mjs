// Resumen de solo lectura del catálogo cargado. Uso: node --env-file=.env scripts/resumen-catalogo.mjs
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1, prepare: false });
try {
  await sql.begin('read only', async tx => {
    console.table(await tx`select c.tienda_id, c.estado::text, c.leidas, c.validas, c.en_cuarentena, c.nuevas, c.actualizadas, c.sin_cambios, c.desactivadas
                             from ingesta.corrida c where c.id in (select max(id) from ingesta.corrida group by tienda_id) order by 1`);
    console.log('productos:', (await tx`select count(*)::int n from public.producto where num_tiendas > 0`)[0].n,
      '| en 2+ tiendas:', (await tx`select count(*)::int n from public.producto where num_tiendas > 1`)[0].n);
    console.table(await tx`select left(p.titulo, 55) titulo, p.num_tiendas tiendas,
                                  string_agg(o.tienda_id || ' $' || o.precio, ', ' order by o.precio) ofertas
                             from public.producto p join public.oferta o on o.producto_id = p.id and o.activa
                            where p.num_tiendas > 1 group by p.id order by p.num_tiendas desc, p.titulo limit 8`);
  });
} finally { await sql.end(); }
