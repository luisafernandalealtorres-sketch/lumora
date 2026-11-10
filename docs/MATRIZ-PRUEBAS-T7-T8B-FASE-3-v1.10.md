# Fase 3: matriz de pruebas locales para T-7 y T-8b (v1.10)

Fecha: 9 nov 2026. Complementa `docs/PRUEBAS-FASE-3-v1.10.md` §12b.

> **Es un diseño de comprobaciones para tu revisión. No se ejecutó nada**: ni SQL local, ni remoto, ni pruebas. No se tocó Supabase.
> **La lógica de T-7 no se cambió.** Los resultados esperados que siguen describen el SQL actual (`docs/MIGRACIONES-FASE-3-v1.10.md`). Donde el SQL actual produce un resultado que considero un riesgo, se marca **RIESGO** y se propone una decisión pendiente (T-7b o T-8c), sin aplicarla.
> Ningún resultado esperado es un resultado observado.

---

## 1. Definiciones comunes

### 1.1 Contextos de ejecución
| Código | Contexto | `auth.uid()` | ¿Omite RLS? | Cómo se simularía en local |
|---|---|---|---|---|
| **C1** | Rol `authenticated` con identidad del dueño de los datos (U1) | U1 | No | `set_config('request.jwt.claims', '{"sub":"<U1>","role":"authenticated"}', true)` + `set local role authenticated` |
| **C2** | Rol `authenticated` con la identidad de **otro** usuario (U2) | U2 | No | Igual con U2 |
| **C3** | Contexto **administrativo**: propietario/`postgres` sin identidad | **NULL** | Sí | Sesión del propietario, claims vacíos |
| **C4** | `service_role` (clave de servicio): rol con `BYPASSRLS`, JWT sin `sub` | **NULL** | Sí | `set local role service_role`, claims `{"role":"service_role"}` |
| **C5** | Rol `anon` | **NULL** | No | `set local role anon`, claims `{"role":"anon"}` |
| **C6** | `authenticated` con claims **sin `sub`** (identidad rota) | **NULL** | No | `set local role authenticated`, claims `{"role":"authenticated"}` |
| **C7** | Sesión que lleva la identidad de U1 ejecutando una función `SECURITY DEFINER` hipotética de «borrar mi cuenta» | U1 | Sí (por la función definer) | Claims de U1 y operación como propietario |

### 1.2 Semanas de referencia
Con «hoy» en America/Bogota y `L0` el lunes de la semana actual: **pasada** = `L0 − 7` o anterior; **actual** = `L0`; **futura** = `L0 + 7` o posterior. `semana_inicio` siempre es lunes (restricción de la tabla).

### 1.3 Convenciones
- **OK** = la operación se aplica. **semana_cerrada** = excepción `P0001` con ese mensaje y detalle del disparador. **42501** = `permission denied`. **RLS** = `new row violates row-level security policy` (INSERT) o 0 filas afectadas (UPDATE/DELETE).
- «Atómico» = si una fila de la sentencia es rechazada, **la sentencia completa falla y ninguna fila cambia**.
- El tiempo no se puede adelantar en una prueba (`now()` es constante en la transacción): las pruebas usan semanas **relativas** a hoy. Las fronteras de reloj se prueban por separado (§2.4).

---

## 2. T-7: objetivos de semanas anteriores inmutables

### 2.1 INSERT, UPDATE y DELETE por semana, con identidad (C1)

| ID | Operación | Semana | Esperado | Razón |
|---|---|---|---|---|
| T7-01 | INSERT | actual | OK | `new.semana_inicio ≥ L0` |
| T7-02 | INSERT | futura (`L0+7`, `L0+364`) | OK | Sin tope superior |
| T7-03 | INSERT | pasada (`L0−7`) | **semana_cerrada** | `new.semana_inicio < L0` |
| T7-04 | INSERT | muy pasada (`L0−364`) | **semana_cerrada** | Igual |
| T7-05 | UPSERT (`on conflict do update`) | pasada, **sin** fila previa | **semana_cerrada** | El disparador `BEFORE INSERT` actúa antes de resolver el conflicto |
| T7-06 | UPSERT | pasada, **con** fila previa | **semana_cerrada** | Igual: se rechaza antes de decidir insertar o actualizar |
| T7-07 | UPSERT | actual, con fila previa | OK | Camino de actualización permitido; `actualizado_en` cambia |
| T7-08 | UPDATE de `puntos` | actual | OK | |
| T7-09 | UPDATE de `puntos` | futura | OK | |
| T7-10 | UPDATE de `puntos` | pasada | **semana_cerrada** | `old.semana_inicio < L0` |
| T7-11 | UPDATE de `semana_inicio` | actual → pasada | **semana_cerrada** | Comprobación sobre `new` |
| T7-12 | UPDATE de `semana_inicio` | pasada → actual | **semana_cerrada** | Comprobación sobre `old` |
| T7-13 | UPDATE de `semana_inicio` | actual → futura | OK | |
| T7-14 | UPDATE de `frente_id` | pasada | **semana_cerrada** | Cualquier UPDATE de una fila pasada |
| T7-15 | DELETE | actual | OK | |
| T7-16 | DELETE | futura | OK | |
| T7-17 | DELETE | pasada | **semana_cerrada** | |

### 2.2 Sentencias masivas y atomicidad (C1)

| ID | Escenario | Esperado | Observación |
|---|---|---|---|
| T7-20 | `UPDATE … SET puntos = 0` sin `WHERE`, con filas pasadas y actuales | **semana_cerrada**; **no cambia ninguna fila** | Atómico. **RIESGO de uso:** un «reiniciar mis objetivos» falla si existe alguna semana pasada |
| T7-21 | `DELETE FROM objetivos_atencion` sin `WHERE`, con filas pasadas y actuales | **semana_cerrada**; no se borra nada | Igual: el cliente debe filtrar `semana_inicio ≥ L0` |
| T7-22 | `DELETE … WHERE semana_inicio >= L0` | OK | Forma correcta para el cliente |
| T7-23 | `INSERT … SELECT` que mezcla semanas actuales y pasadas | **semana_cerrada**; no se inserta ninguna | Atómico |

### 2.3 Orden de disparadores y mensajes
| ID | Escenario | Esperado |
|---|---|---|
| T7-30 | `objetivos_semana_cerrada` y `objetivos_tocar` (ambos `BEFORE`) | El primero corre antes (orden alfabético). En una semana editable, `actualizado_en` se actualiza |
| T7-31 | Error recibido | `SQLSTATE P0001`, mensaje `semana_cerrada`, `DETAIL` con el motivo |

### 2.4 Fronteras de reloj (sin avanzar el reloj)
El cambio de semana ocurre a las 00:00:00 de America/Bogota del lunes (Bogotá no tiene horario de verano).
| ID | Escenario | Esperado |
|---|---|---|
| T7-40 | La expresión del lunes (`d − (isodow(d) − 1)`, con `d` = fecha de Bogotá) evaluada sobre una lista fija de instantes: domingo 23:59:59.999, lunes 00:00:00, lunes 04:59:59.999 UTC, lunes 05:00:00 UTC, 29 de febrero, 31 de diciembre, 1 de enero | Cada instante da el lunes correcto, **igual que `inicioSemana` del dominio en JavaScript** |
| T7-41 | Propiedad: para todos los instantes de 2 años a paso de 1 hora, `lunes(ts)` es lunes y `0 ≤ ts − lunes < 7 días` | Se cumple |
| T7-42 | Un objetivo de la semana `L0` se edita a las 23:59 del domingo y el lunes 00:00 | **OK** el domingo; **semana_cerrada** el lunes (la semana `L0` pasa a pasada). Solo comprobable en una ventana real o con una función auxiliar parametrizada por instante (**propuesta T-7b-3**, no aplicada) |

### 2.5 Contextos con `auth.uid()` NULL (análisis expreso)

**Comportamiento del disparador:** `if (select auth.uid()) is null then return coalesce(new, old); end if;`. Cuando no hay identidad **no aplica ninguna regla** y la operación continúa.

**Por qué se hizo así:** sin esta salvaguarda, borrar un usuario por cascada (que borra sus objetivos de semanas pasadas) fallaría con `semana_cerrada`.

**Qué contextos tienen `auth.uid()` NULL:** C3 (administrativo, incluido el editor SQL y las migraciones), C4 (`service_role`), C5 (`anon`), C6 (identidad rota) y el servicio de autenticación que borra usuarios.

| ID | Contexto | Operación | Esperado | ¿Hay hueco? |
|---|---|---|---|---|
| T7-50 | **C3** | INSERT, UPDATE y DELETE en semana pasada | **OK** (el disparador no actúa) | Es **intencional**: mantenimiento y correcciones por el administrador. Esos cambios **tampoco** generan historial en tablas con `registrar_cambios`, y en `objetivos_atencion` no hay historial de cambios |
| T7-51 | **C4** `service_role` | Igual | **OK** | Igual. La aplicación no usa esa clave |
| T7-52 | **C5** `anon` | INSERT | **RLS** (violación de política) | **No hay hueco:** el disparador salta, pero RLS exige `auth.uid() = user_id`; con `auth.uid()` NULL esa condición es NULL y deniega |
| T7-53 | **C5** `anon` | UPDATE y DELETE | 0 filas | No hay hueco: RLS filtra todo |
| T7-54 | **C6** | INSERT | **RLS** | No hay hueco, mismo motivo |
| T7-55 | **C6** | UPDATE y DELETE | 0 filas | No hay hueco |
| T7-56 | **C2** (otro usuario) | UPDATE y DELETE de filas de U1 | 0 filas | RLS |
| T7-57 | **C2** | INSERT con `user_id = U1` | **RLS** | RLS |
| T7-58 | Orden de evaluación: ¿el `BEFORE INSERT` corre antes de la política RLS? | El disparador corre primero; si se salta (NULL), la política decide | Comprobar que ningún camino con identidad NULL llega a escribir bajo RLS |
| T7-59 | **C1** que manipula `request.jwt.claims` a mitad de la transacción para ponerlo en NULL | **No alcanzable desde la API:** PostgREST no expone `set_config` | **RIESGO FUTURO:** una función `SECURITY DEFINER` que limpiara los claims abriría el hueco |

**Conclusión del análisis:** la omisión con `auth.uid()` NULL **solo es alcanzable por roles que omiten RLS** (C3 y C4), porque cualquier rol sujeto a RLS necesita `auth.uid() = user_id`. No es un hueco para el cliente. Es una puerta intencional para el administrador.

### 2.6 Borrado de un usuario en cascada

| ID | Escenario | Esperado | Observación |
|---|---|---|---|
| T7-60 | **C3** borra `auth.users` de U con objetivos de semanas pasadas, actual y futuras | **OK**: la cascada borra todo; sin error | `auth.uid()` NULL, el disparador no actúa |
| T7-61 | **C7**: la sesión lleva la identidad de U (U1) y borra a U1 | **semana_cerrada** (la cascada borra filas pasadas con identidad no nula): **el borrado del usuario falla** | **RIESGO:** afecta a una futura función «borrar mi cuenta» ejecutada con el JWT del usuario, o a cualquier flujo que borre al usuario conservando sus claims |
| T7-62 | **C3** borra a U mientras la sesión lleva los claims de **otro** usuario (suplantación administrativa) | **semana_cerrada** | **RIESGO** de la misma clase |
| T7-63 | Medir `pg_trigger_depth()` en el disparador: borrado directo del cliente, cascada desde `auth.users`, cascada desde `metas` (no aplica a objetivos) | Se espera **1** en el borrado directo y **2** en la cascada desde `auth.users` | Dato para evaluar la **opción T-7b-1** |
| T7-64 | `TRUNCATE objetivos_atencion` como propietario | **OK**: no dispara disparadores de fila | Camino que omite la inmutabilidad (administrativo) |
| T7-65 | `TRUNCATE` por `authenticated` | Depende de si conserva el privilegio `TRUNCATE` (ver T-8c) | **RIESGO** de privilegios por defecto |

### 2.7 Opciones para cerrar los riesgos (**no aplicadas**; requieren tu decisión)

| ID | Opción | Qué cambia | Resultados esperados con la opción | Riesgo de la opción |
|---|---|---|---|---|
| **T-7b-1** | Además de `auth.uid() IS NULL`, **no actuar** cuando `pg_trigger_depth() > 1` | El borrado en cascada pasa siempre, tenga o no identidad (T7-61 y T7-62 pasarían a OK) | Borrado de usuario correcto en C7; el borrado directo del cliente sigue bloqueado (T7-17) | Un borrado anidado dentro de otro disparador o función también saltaría la regla; hoy no existe ninguno |
| **T-7b-2** | Eliminar la salvaguarda de NULL y exigir una bandera explícita (`set_config('app.mantenimiento','on',true)`) para operaciones administrativas | El administrador debe activarla; el borrado de usuario por cascada también | Un paso más para el administrador; más explícito | Más fricción; la cascada depende de que quien borra la active |
| **T-7b-3** | Extraer el cálculo del lunes a una función auxiliar con parámetro de instante (para probar fronteras) | Una función nueva, mismo resultado | T7-42 pasa a ser comprobable localmente | Una función más; cambio mínimo |
| **T-7b-4** | Mantener la lógica actual y documentar T7-61 como límite conocido | Nada | El borrado de usuario con claims del propio usuario falla | Se asume el riesgo hasta que exista «borrar mi cuenta» |

**Mi recomendación (no es una aprobación):** T-7b-3 y T-7b-1, o T-7b-4 si no habrá «borrar mi cuenta» pronto. No cambio nada hasta que decidas.

---

## 3. T-8b: matriz de permisos y H-12 actualizada

### 3.1 Cambio de expectativa de H-12
La v1.8 y la v1.9 decían que `UPDATE` y `DELETE` del cliente sobre `cambios_registro` **afectan 0 filas sin error**. Con el SQL actual (`REVOKE INSERT, UPDATE, DELETE`) el resultado correcto es **`permission denied` (42501)**, porque PostgreSQL comprueba el privilegio de tabla **antes** de aplicar RLS y el error se lanza aunque ninguna fila coincidiera.

### 3.2 Matriz de permisos sobre `cambios_registro` (esperado con el SQL v1.10)

| ID | Rol | Operación | Esperado | Nota |
|---|---|---|---|---|
| H-12a | `authenticated` (C1) | `SELECT` | Solo sus filas | Política `ver propios` |
| H-12b | `authenticated` | `INSERT` | **42501** | Privilegio revocado y sin política |
| H-12c | `authenticated` | `UPDATE` (incluso con `WHERE false`) | **42501** | El privilegio se comprueba antes que RLS |
| H-12d | `authenticated` | `DELETE` (incluso con `WHERE false`) | **42501** | Igual |
| H-12e | `authenticated` | `SELECT … FOR UPDATE` | **42501** | Requiere privilegio de `UPDATE` |
| H-12f | `authenticated` | `INSERT … ON CONFLICT DO UPDATE` | **42501** | |
| H-12g | `authenticated` | `TRUNCATE` | **PERMITIDO** si conserva el privilegio por defecto | **HALLAZGO** (T-8c): `REVOKE INSERT, UPDATE, DELETE` no quita `TRUNCATE`, `REFERENCES` ni `TRIGGER`. `TRUNCATE` ignora RLS. Solo alcanzable por una conexión SQL directa con ese rol, no por la API REST |
| H-12h | `authenticated` | `REFERENCES` / `TRIGGER` (crear una clave foránea o un disparador sobre la tabla) | **PERMITIDO** si conserva el privilegio | Igual hallazgo |
| H-12i | `anon` | `SELECT` | 0 filas, sin error | Tiene el privilegio de `SELECT` por defecto; RLS filtra todo |
| H-12j | `anon` | `INSERT`, `UPDATE`, `DELETE` | **42501** | Privilegio revocado |
| H-12k | `anon` | `TRUNCATE`, `REFERENCES`, `TRIGGER` | Igual que H-12g y H-12h | Hallazgo |
| H-12l | `service_role` | todo | OK | `BYPASSRLS` y privilegios por defecto |
| H-12m | Propietario / `postgres` | todo | OK | Propietario |
| H-12n | `authenticated` (C2, otro usuario) | `SELECT` | 0 filas | RLS |

### 3.3 Inventario de privilegios (consulta de solo lectura, a incluir en la verificación de la etapa 1)
Muestra el ACL real con `aclexplode` (no depende de los privilegios de quien consulta, a diferencia de `information_schema`):
```sql
select c.relname, a.grantee::regrole as rol, a.privilege_type as privilegio, a.is_grantable
from pg_class c, aclexplode(c.relacl) a
where c.oid = 'public.cambios_registro'::regclass
order by a.grantee::regrole::text, a.privilege_type;
```
**Esperado con el SQL actual:** `authenticated`: `SELECT`, `TRUNCATE`, `REFERENCES`, `TRIGGER`; `anon`: `SELECT`, `TRUNCATE`, `REFERENCES`, `TRIGGER`; `service_role`: todos; propietario: todos.
**Esperado con T-8c:** `authenticated`: solo `SELECT`; `anon`: ninguno; `service_role` y propietario sin cambio.

### 3.4 T-8c: higiene de privilegios (propuesta, **no aplicada**)
Para toda tabla de solo lectura del cliente (`cambios_registro`, `temporizador_activo`, `focus_sesiones`, `descansos`, `habitos_config_versiones`, `habito_temporizadores`, `habito_segmentos`, `habito_tiempo`, `habito_tiempo_historial` y `operaciones` salvo su columna `notificada`):
```sql
revoke all on public.<tabla> from authenticated, anon;
grant select on public.<tabla> to authenticated;
```
| Con T-8c | Sin T-8c |
|---|---|
| El cliente solo puede leer; ningún privilegio residual | Quedan `TRUNCATE`, `REFERENCES` y `TRIGGER` para `anon` y `authenticated` |
| Hay que mantener `GRANT UPDATE (notificada)` en `operaciones` y `UPDATE (nombre, modo_registro)` en `habitos_config` | Menos líneas de SQL |
| Riesgo de la opción: ninguno funcional (los disparadores y las funciones definer usan privilegios del propietario) | Riesgo: bajo, porque la API REST no expone `TRUNCATE`; subsiste para conexiones SQL directas |

### 3.5 El disparador `SECURITY DEFINER` escribe con los permisos reales de su propietario

| ID | Comprobación | Esperado | Para qué sirve |
|---|---|---|---|
| TD-01 | `insert` de un pendiente como `authenticated` | Una fila `creado` escrita por la función definer, con `user_id` del pendiente | Camino normal |
| TD-02 | Propietario de `registrar_cambios` = propietario de `cambios_registro`; `has_table_privilege(propietario, 'cambios_registro', 'INSERT')` verdadero | Ambos verdaderos | La función definer usa **los privilegios del propietario**, no los del cliente |
| TD-03 | El cliente sigue sin poder insertar mientras el disparador sí | H-12b da 42501 y TD-01 da OK en el mismo escenario | Demuestra que las dos rutas son independientes |
| TD-04 | Fila escrita por el disparador | `user_id` = `new.user_id`/`old.user_id`, nunca otro | No se puede falsificar el usuario del historial |
| TD-05 | **Control negativo A:** revocar `INSERT` al propietario sobre `cambios_registro` (solo en la base de prueba) y luego insertar un pendiente como cliente | **Falla** con `permission denied` dentro del disparador, y el pendiente **no** se inserta | Modo de fallo: si el propietario perdiera el privilegio, **se bloquearían las escrituras de los módulos heredados** |
| TD-06 | **Control negativo B:** función con propietario **distinto** del de la tabla | Falla con `permission denied` | Detecta la clase de error «migración ejecutada por otro rol» |
| TD-07 | **Control negativo C:** `ALTER TABLE cambios_registro FORCE ROW LEVEL SECURITY` con un propietario sin `BYPASSRLS` | El `INSERT` del disparador es rechazado por RLS (no hay política de `INSERT`) y las escrituras heredadas fallan | Por eso la etapa 0 comprueba `relforcerowsecurity` |
| TD-08 | Propietario **sin** `BYPASSRLS` pero propietario de la tabla y sin `FORCE` | El `INSERT` del disparador **funciona** (el propietario omite RLS por serlo) | Matiza el criterio 1 de la etapa 0: basta `BYPASSRLS` **o** ser propietario sin `FORCE` |
| TD-09 | `registrar_cambios` no es invocable por el cliente (sin `EXECUTE`) y aun así dispara | Sin permiso para llamarla; el disparador funciona | El permiso de ejecución solo se exige al crear el disparador |
| TD-10 | `search_path` vacío | Todas las referencias calificadas; un objeto homónimo en otro esquema no la afecta | Endurecimiento |
| TD-11 | Cascada: borrar una meta con hitos como cliente | Una fila `eliminado` por hito, escritas por la función definer | Los borrados en cascada también se registran |
| TD-12 | Cambios sin identidad (C3, C4) | **No** se registran | Límite conocido |
| TD-13 | Un cliente no puede hacer que el historial de **otro usuario** reciba filas | Ninguna fila de U2 aparece tras escrituras de U1 | Aislamiento |

### 3.6 Resultados esperados de las pruebas heredadas con T-8b
Las pruebas H-01 a H-11, H-14 a H-17 y las de aislamiento deben dar el mismo resultado que en la v1.8. **H-12 cambia** a lo descrito en §3.1.

---

## 4. Riesgos de esta matriz que dependen de decisiones tuyas

| ID | Decisión | Qué evita |
|---|---|---|
| T-7b | Elegir entre T-7b-1 a T-7b-4 | Un borrado de usuario fallido en el contexto C7 y la imposibilidad de probar la frontera de reloj |
| T-8c | Aprobar o no la higiene de privilegios | Privilegios residuales (`TRUNCATE`, `REFERENCES`, `TRIGGER`) del cliente |

## 5. Qué haría falta para ejecutarla
1. Tu aprobación del diseño de estas comprobaciones y tu decisión sobre T-7b y T-8c.
2. **Autorización expresa** para ejecutarlas en una base PostgreSQL **local y desechable** (no Supabase).
3. Si decides cambios de lógica (T-7b, T-8c), actualizar primero el SQL de los documentos y luego validar.
