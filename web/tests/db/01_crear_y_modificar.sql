-- PRUEBA DE BASE DE DATOS 1/4: crear y modificar en las 18 tablas de datos.
-- Actúa como tu usuario (rol "authenticated") con los mismos datos que envía la app.
-- Todos los registros llevan la marca [PRUEBA-CRUD] y se eliminan con 03_borrar.sql.
-- Requisito: las 18 tablas de datos deben estar vacías antes de empezar (ver 04_verificar_limpio.sql).
-- Solo funciona con un único usuario en auth.users.
-- Cómo ejecutarlo: en el editor SQL de Supabase, o pidiéndoselo a Claude con el conector de Supabase.
do $$
declare
  uid uuid := (select id from auth.users limit 1);
  m text := '[PRUEBA-CRUD] ';
  v_meta uuid; v_hito uuid; v_pend uuid; v_hab1 uuid; v_hab2 uuid; v_rec uuid; v_deu uuid; n int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  -- Metas, hitos y pendientes vinculados
  insert into metas (titulo, descripcion, frente, fecha_meta) values (m||'meta', 'prueba', 'tanku', current_date + 30) returning id into v_meta;
  insert into hitos (meta_id, titulo) values (v_meta, m||'hito') returning id into v_hito;
  insert into pendientes (texto, frente, meta_id) values (m||'pendiente', 'tanku', v_meta) returning id into v_pend;
  update pendientes set hecho = true, hecho_en = now() where id = v_pend;
  update hitos set hecho = true where id = v_hito;
  update metas set estado = 'pausada' where id = v_meta;

  -- Gastos, ingresos y presupuesto (el segundo upsert debe actualizar, no duplicar)
  insert into gastos (fecha, lugar, categoria, valor_cop, frente) values (current_date, m||'gasto', 'Comida', 12345, 'personal');
  insert into ingresos (fecha, fuente, valor_cop, frente) values (current_date, m||'ingreso', 50000, 'tanku');
  insert into presupuestos (user_id, categoria, monto_cop) values (uid, 'Otros', 1000)
    on conflict (user_id, categoria) do update set monto_cop = excluded.monto_cop;
  insert into presupuestos (user_id, categoria, monto_cop) values (uid, 'Otros', 2000)
    on conflict (user_id, categoria) do update set monto_cop = excluded.monto_cop;
  select count(*) into n from presupuestos where categoria = 'Otros';
  if n <> 1 then raise exception 'presupuestos: el upsert duplicó filas (%)', n; end if;

  -- Recurrente -> pagar (gasto + ultimo_pago)
  insert into recurrentes (nombre, valor_cop, dia_mes, categoria, frente) values (m||'recurrente', 9999, 15, 'Servicios', 'personal') returning id into v_rec;
  insert into gastos (fecha, lugar, categoria, valor_cop, frente) values (current_date, m||'recurrente', 'Servicios', 9999, 'personal');
  update recurrentes set ultimo_pago = current_date where id = v_rec;

  -- Deudas y abonos
  insert into deudas (nombre, tipo, monto_total, saldo, cuota_cop) values (m||'deuda', 'debo', 100000, 100000, 10000) returning id into v_deu;
  update deudas set saldo = 90000 where id = v_deu;

  -- Jornada: upsert del día y luego del plan semanal (mismo día): no debe borrar el relato
  insert into jornadas (user_id, fecha, relato, salio_bien, no_salio, mejora_manana)
    values (uid, current_date, m||'relato', array['a','b','c'], 'x', 'y')
    on conflict (user_id, fecha) do update set relato = excluded.relato, salio_bien = excluded.salio_bien, no_salio = excluded.no_salio, mejora_manana = excluded.mejora_manana;
  insert into jornadas (user_id, fecha, plan_semana) values (uid, current_date, m||'plan')
    on conflict (user_id, fecha) do update set plan_semana = excluded.plan_semana;
  select count(*) into n from jornadas where fecha = current_date;
  if n <> 1 then raise exception 'jornadas: filas % (esperaba 1)', n; end if;
  select count(*) into n from jornadas where fecha = current_date and relato = m||'relato' and plan_semana = m||'plan';
  if n <> 1 then raise exception 'jornadas: el upsert del plan borró el relato'; end if;

  -- Hábitos (check y cantidad) y registros con upsert
  insert into habitos (nombre, tipo, unidad, objetivo_dia, veces_semana) values (m||'habito check', 'check', null, 1, 5) returning id into v_hab1;
  insert into habitos (nombre, tipo, unidad, objetivo_dia, veces_semana) values (m||'habito cantidad', 'cantidad', 'vasos', 8, 7) returning id into v_hab2;
  insert into habito_registros (user_id, habito_id, fecha, valor) values (uid, v_hab1, current_date, 1)
    on conflict (habito_id, fecha) do update set valor = excluded.valor;
  insert into habito_registros (user_id, habito_id, fecha, valor) values (uid, v_hab2, current_date, 3)
    on conflict (habito_id, fecha) do update set valor = excluded.valor;
  insert into habito_registros (user_id, habito_id, fecha, valor) values (uid, v_hab2, current_date, 8)
    on conflict (habito_id, fecha) do update set valor = excluded.valor;
  select count(*) into n from habito_registros where habito_id = v_hab2;
  if n <> 1 then raise exception 'habito_registros: el upsert duplicó (%)', n; end if;

  -- Medidas y objetivos de salud
  insert into medidas (fecha, tipo, unidad, valor) values (current_date, 'PRUEBA-CRUD peso', 'kg', 65.5);
  insert into objetivos_salud (titulo, medida_tipo, valor_inicial, valor_meta, fecha_meta)
    values (m||'objetivo', 'PRUEBA-CRUD peso', 65.5, 62, current_date + 60);

  -- Biblioteca y notas (incluye el frente `salud`)
  insert into biblioteca (titulo, fuente, tipo, resumen, etiquetas) values (m||'biblioteca', 'https://ejemplo.invalid', 'articulo', 'r', array['prueba','ventas']);
  insert into notas (titulo, contenido, etiquetas, frente, actualizado_en) values (m||'nota', 'c', array['idea'], 'salud', now());
  update notas set contenido = 'c editado', actualizado_en = now() where titulo = m||'nota';

  -- Tablas que escribe la tarea programada de las 6:00 a. m. (con user_id explícito)
  insert into agenda_hoy (user_id, fecha, inicio, fin, titulo, detalle) values (uid, current_date, now(), now() + interval '1 hour', m||'evento', 'd');
  insert into correos_hoy (user_id, fecha, remitente, asunto, resumen, etiqueta, urgente) values (uid, current_date, m||'remitente', 'asunto', 'r', 'Acción', true);
  insert into resumen_dia (user_id, fecha, texto) values (uid, current_date, m||'resumen')
    on conflict (user_id, fecha) do update set texto = excluded.texto;

  execute 'reset role';
end $$;
select 'OK 1/4: creación y actualización completadas sin errores' as resultado;
