# La ingesta corre en GitHub Actions, no en Vercel Cron ni en Supabase Edge Functions

Una corrida de Kywi dura unos 11 minutos. En Vercel el cron del plan Hobby solo corre una vez al día y las funciones tienen un tiempo máximo de ejecución. Las Edge Functions de Supabase también se cortan en pocos minutos. Un workflow programado de GitHub Actions puede correr hasta 6 horas, guarda logs de cada corrida y no cuesta nada en un repositorio público. En uno privado, una corrida diaria de unos 11 minutos son unos 330 de los 2.000 minutos gratuitos al mes (con 4 al día serían 1.320; ver ADR 0008). El worker se conecta a Postgres por el pooler de Supabase con una cadena de conexión guardada como secreto.

## Considered Options

- Supabase Cron + Edge Functions: todo dentro de Supabase, pero obliga a partir cada corrida en trozos de pocos minutos y a coordinarlos con colas.
- Un servidor propio (VPS) con cron: no tiene límites de tiempo, pero es otra máquina que mantener y pagar.
