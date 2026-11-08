-- PRUEBA DE BASE DE DATOS 3/4: borrar los registros de prueba y verificar cascadas.
-- Borra únicamente filas marcadas [PRUEBA-CRUD] / [PRUEBA-FRENTES] / PRUEBA-CRUD.
-- Comprueba: borrar una meta borra sus hitos y deja el pendiente con meta_id nulo (SET NULL);
-- borrar un hábito borra sus registros (CASCADE).
do $$
declare
  uid uuid := (select id from auth.users limit 1);
  n int; v_meta uuid;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  select id into v_meta from metas where titulo like '[PRUEBA-CRUD]%';
  delete from metas where id = v_meta;
  select count(*) into n from hitos where meta_id = v_meta;
  if n <> 0 then raise exception 'cascada: los hitos no se borraron'; end if;
  select count(*) into n from pendientes where texto like '[PRUEBA-CRUD]%' and meta_id is null;
  if n <> 1 then raise exception 'SET NULL: el pendiente no quedó sin meta (%)', n; end if;
  delete from pendientes where texto like '[PRUEBA-CRUD]%';

  delete from habitos where nombre like '[PRUEBA-CRUD]%';
  select count(*) into n from habito_registros;
  if n <> 0 then raise exception 'cascada: quedaron registros de hábitos (%)', n; end if;

  delete from gastos where lugar like '[PRUEBA-CRUD]%';
  delete from ingresos where fuente like '[PRUEBA-CRUD]%';
  delete from presupuestos where categoria = 'Otros' and monto_cop = 2000;
  delete from recurrentes where nombre like '[PRUEBA-CRUD]%';
  delete from deudas where nombre like '[PRUEBA-CRUD]%';
  delete from jornadas where relato like '[PRUEBA-CRUD]%';
  delete from medidas where tipo like 'PRUEBA-CRUD%';
  delete from objetivos_salud where titulo like '[PRUEBA-CRUD]%';
  delete from biblioteca where titulo like '[PRUEBA-CRUD]%';
  delete from notas where titulo like '[PRUEBA-CRUD]%' or titulo like '[PRUEBA-FRENTES]%';
  delete from agenda_hoy where titulo like '[PRUEBA-CRUD]%';
  delete from correos_hoy where remitente like '[PRUEBA-CRUD]%';
  delete from resumen_dia where texto like '[PRUEBA-CRUD]%';

  execute 'reset role';
end $$;
select 'OK 3/4: borrado, cascadas y SET NULL verificados' as resultado;
