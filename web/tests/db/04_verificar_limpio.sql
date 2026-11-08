-- PRUEBA DE BASE DE DATOS 4/4: verificar que no quedan registros y que el catálogo no cambió.
-- Ejecutar ANTES de la serie (para confirmar la base vacía) y DESPUÉS de 03_borrar.sql.
-- Resultado esperado con la base sin datos reales: 0 filas, 10 frentes, 1 usuario.
with esperado(slug, nombre, grupo, orden) as (values
  ('ticketcode-eventos','TICKETCODE · Producción de eventos','ticketcode',1),
  ('ticketcode-eve','TICKETCODE · EVE','ticketcode',2),
  ('tanku','TANKU','tanku',3),
  ('hama','Hama beads','personal',4),
  ('crochet','Crochet','personal',5),
  ('jardin','Jardín de mamá','personal',6),
  ('salud-abuela','Salud de la abuela','personal',7),
  ('hogar','Hogar','personal',8),
  ('personal','Personal general','personal',9),
  ('salud','Salud','personal',10))
select 'filas en las 18 tablas de datos (esperado 0)' as control,
       ((select count(*) from public.pendientes)+(select count(*) from public.metas)+(select count(*) from public.hitos)+(select count(*) from public.gastos)+(select count(*) from public.ingresos)+(select count(*) from public.presupuestos)+(select count(*) from public.recurrentes)+(select count(*) from public.deudas)+(select count(*) from public.jornadas)+(select count(*) from public.habitos)+(select count(*) from public.habito_registros)+(select count(*) from public.medidas)+(select count(*) from public.objetivos_salud)+(select count(*) from public.biblioteca)+(select count(*) from public.notas)+(select count(*) from public.agenda_hoy)+(select count(*) from public.correos_hoy)+(select count(*) from public.resumen_dia))::text as resultado
union all select 'frentes idénticos a lo aprobado (esperado 10)', count(*)::text from esperado e join public.frentes f using (slug, nombre, grupo, orden)
union all select 'total de frentes (esperado 10)', count(*)::text from public.frentes
union all select 'usuarios (esperado 1)', count(*)::text from auth.users;
