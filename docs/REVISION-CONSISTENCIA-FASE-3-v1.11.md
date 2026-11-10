# Fase 3: revisión de consistencia (fórmulas, comportamiento y esquema) — v1.10

Fecha: 9 nov 2026. Actualizada con la auditoría 3.0 y las aprobaciones P1 a P15; corresponde a la especificación v1.10.
Método: revisión documental más la auditoría 3.0 del 9 nov 2026, hecha en **solo lectura** sobre el esquema `public` de Supabase (columnas, restricciones, políticas, índices, funciones, disparadores, extensiones y conteos). **Sin cambios de código, base de datos, RLS, autenticación ni configuración.** Resultado reverificado: 0 filas en las 18 tablas de datos, 10 en `frentes`, sin funciones ni disparadores.

## 1. Fórmulas frente al esquema actual

| Indicador | Datos que necesita | Existe hoy | Brecha |
|---|---|---|---|
| **Execution, T** | Pendiente con fecha límite, completado, prioridad | `pendientes.fecha_limite` (opcional), `hecho`, `hecho_en`, `frente`, `meta_id` | **Sin prioridad.** Se necesita una columna (aprobación de esquema). Sin fecha, queda excluido (decisión A2) |
| **Execution, M** | Hito con fecha, completado, prioridad propia | `hitos.fecha` (opcional), `hecho`, `meta_id` | **Sin prioridad** (decisión B4). **Sin `hecho_en`**: no se sabe cuándo se completó, lo que afecta a D3-2 y a actividad reciente. El frente sale de `metas.frente` |
| **Balance** | Puntos por sesión completada y frente; objetivos semanales por frente | Nada | Tablas de sesiones y de objetivos. Frente por id de diseño (los seis) |
| **Wellbeing** | Frecuencia por días, duración objetivo, vigencia, tiempo vigente por ocurrencia | `habitos` (`tipo`, `unidad`, `objetivo_dia`, `veces_semana`, `activo`), `habito_registros` (`fecha`, `valor`) | Falta frecuencia por días, duración con unidad, modo de registro, vigencia, fuente e historial de cambios |

### 1.1 Comprobaciones aritméticas de las fórmulas
- **W:** `100 × Σ min(real, objetivo) / Σ objetivo`. Equivale a la fórmula del usuario con el tope aplicado a cada ocurrencia. Si `Σ objetivo = 0` no hay ocurrencias elegibles y se muestra «Sin datos». No hay división por cero.
- **W, unidades:** minutos y horas deben convertirse a una misma unidad antes de sumar.
- **W, ocurrencia sin registro:** cuenta 0 realizado. Es cero real, no «Sin datos».
- **B:** frentes con objetivo 0 se excluyen. Si `Σ g = 0` porque no existen objetivos configurados, mostrar «Sin objetivo» (D3-19b), no «Sin datos» ni 0 %. Mostrar puntos registrados por separado si los hay. Si existen objetivos pero la fuente no está disponible, mostrar «Sin datos» o estado de error según corresponda; no confundir ausencia de objetivo con ausencia de datos.
- **E:** si solo existe T o solo M, es parcial. Los pendientes e hitos sin fecha quedan fuera (hitos sin fecha: D3-1).
- **Períodos:** T, M y W se recalculan desde los registros, no promediando porcentajes diarios. Semana de lunes a domingo en America/Bogota.
- **Balance diario:** para cada frente, objetivo diario = objetivo semanal vigente ÷ 7.
- **Balance mensual:** objetivo mensual por frente = suma de (objetivo semanal vigente ÷ 7) por cada día calendario del mes. Las semanas que cruzan el inicio o fin del mes aportan solo los días que pertenecen a ese mes. El numerador usa los puntos reales registrados dentro del mes.
- **Balance semanal:** en una semana cerrada se conserva el objetivo semanal completo; en la semana en curso aplica el prorrateo de D3-19a. Los tres períodos usan la misma fórmula de Balance con sus objetivos y puntos correspondientes.
- **Períodos abiertos (D3-19a aprobado):** denominador prorrateado hasta el día actual inclusive en America/Bogota, con estado «En curso»; excluir días futuros. Verificar bordes temporales en 3.0.
- **Semana sin objetivos (D3-19b aprobado):** mostrar «Sin objetivo», sin heredar objetivos previos; puntos registrados se muestran aparte. En meses parcialmente configurados, solo días con objetivos aportan al denominador.

## 2. Comportamiento funcional: puntos que se contradicen o quedan sin definir

| # | Hallazgo | Consecuencia | Estado |
|---|---|---|---|
| F1 | `hitos` no tiene `hecho_en` | No se puede saber si un hito se completó antes o después de su fecha | D3-2 quedó aprobada funcionalmente; se necesita una marca temporal (`hecho_en` o evento equivalente) para preservar la fecha real y auditar el período de atribución |
| F2 | Los módulos heredados crean pendientes e hitos sin pedir prioridad | Habría registros sin prioridad y sin peso | Resuelto en v1.3: asignar «media» por defecto cuando no se indique otra prioridad |
| F3 | Un temporizador en pausa, ¿ocupa el lugar del temporizador único? | Aprobado en v1.4: sí, conserva exclusividad hasta completar o cancelar |
| F4 | Los descansos son un temporizador | Un descanso no debe permitir iniciar un hábito en paralelo | Resuelto en v1.3: el descanso ocupa el temporizador global y bloquea cualquier otro temporizador |
| F5 | La v1.0 habla de sesión «parcial» y de «cancelar», sin distinguirlas | Aprobado en v1.4: completar antes de tiempo guarda parcial sin punto; cancelar descarta |
| F6 | El modo sin conexión cubre cambios de sesiones activas, pero no iniciar temporizadores ni registros manuales de hábitos | Aprobado en v1.4: no iniciar temporizadores offline; permitir registros manuales de hábitos en cola |
| F7 | Un temporizador de hábito que cruza medianoche | Aprobado en v1.4: dividir el tiempo entre las ocurrencias de cada fecha local |
| F8 | Si tras un registro manual se usa el temporizador | Reemplazar y acumular pueden chocar | Resuelto en v1.3: acumula sobre el valor manual vigente; se conserva historial |
| F9 | Hora del dispositivo frente a hora del servidor | Reloj desajustado altera el tiempo restante | Resuelto en §4.9 de la especificación v1.4: validación contra recepción y «hora ajustada». La tolerancia se define en 3.0 |
| F10 | Ocurrencias antes de la vigencia de un hábito | Penalizarían hábitos recién creados | Resuelto: no existen ocurrencias anteriores a la vigencia |
| F11 | Realtime y sincronización sin conexión | Podrían parecer dependientes | Aprobado en v1.4: sin Realtime inicial; la cola se envía al reconectar y los dispositivos refrescan al recuperar foco y periódicamente |
| F12 | Frente de una sesión: id de diseño (seis) o slug (diez) | Los pendientes usan slug; Balance usa los seis | Se propone guardar el id de diseño en sesiones y objetivos; la 3.0 lo confirma. Un slug fuera del mapa queda «Sin asignar» y no entra al Balance |
| F13 | Cambiar «Mi día» por «Home» en el shell | Toca `navegacion.js` y sus pruebas (Fase 2), y el elemento de la barra inferior móvil | Derivado de B5; se ejecuta en 3.1, sin tocar código de Mi día |
| F14 | Hora de dispositivo de las operaciones pendientes frente a la regla «un solo punto por sesión» | Dos dispositivos podrían completar la misma sesión | Resuelto: la restricción de unicidad de punto y la regla de estado final definitivo |
| F15 | Balance diario y mensual usan objetivos semanales sin regla de conversión | Los porcentajes diarios y mensuales no tendrían un denominador definido | Resuelto en v1.3: prorrateo diario (objetivo semanal ÷ 7) y suma de fracciones diarias dentro del mes |
| F16 | El registro de hábitos podía cambiar Salud heredado | Un cambio incompatible rompería la funcionalidad existente | Aprobado en v1.4: interfaz nueva y Salud heredado sin modificaciones; la solución de datos debe ser aditiva |

## 3. Restricciones que deben vivir en la base de datos
La interfaz sola no basta. Para cumplir los criterios de aceptación, estas garantías se proponen como restricciones de esquema (con aprobación, en 3.0):
1. Un solo temporizador global por usuario, entre Focus, hábitos y descansos; el descanso y los temporizadores pausados conservan exclusividad hasta completar o cancelar.
2. Un punto de atención por sesión completada.
3. Un identificador único por operación (idempotencia).
4. Un total vigente por ocurrencia programada (hábito + fecha), compuesto por segmentos de esa fecha; los segmentos de días no programados no se acreditan.
5. Historial de modificaciones sin borrado.
6. Seguir el patrón RLS existente en cada tabla nueva.

## 4. Hallazgos incorporados hasta v1.6

1. **Historial de Execution:** D3-2 y D3-20 aprobadas funcionalmente. El compromiso se atribuye al período de su fecha límite y conserva la fecha real de cumplimiento. La v1.5 aprueba conservar cada cambio de fecha límite y no borrar un incumplimiento ya ocurrido; la 3.0 debe proponer el modelo técnico de eventos/historial y solicitar aprobación de esquema.
2. **Descansos:** el temporizador de descanso debe persistirse como estado global y bloquear Focus/hábitos mientras esté activo. El inicio siempre depende de la decisión del usuario. El contador solo incluye sesiones Focus completas y se reinicia al completar u omitir el descanso largo; cambiar de día no lo reinicia (D3-21b, aprobada en v1.5).
3. **Cruce de medianoche:** la duración de hábito se divide en segmentos por fecha local `America/Bogota`; solo se acreditan los segmentos de fechas con ocurrencia programada. Los segmentos de días no programados se ignoran. La unicidad debe operar por ocurrencia y segmento para evitar duplicaciones.
4. **Hábitos heredados:** la interfaz nueva no puede alterar el comportamiento ni el esquema utilizado por Salud heredado sin autorización aparte. Se debe preferir una estrategia aditiva y probar compatibilidad.
5. **Modo offline:** se prohíbe iniciar temporizadores sin conexión. Se permiten registros manuales de hábitos en la cola. Los cambios de un temporizador iniciado online pueden quedar en cola. La cola registra secuencias y dependencias causales por dispositivo y detecta concurrencia; la política exacta de reconciliación sigue siendo diseño de 3.0.
6. **Realtime:** no se activa inicialmente; refresco al recuperar foco y sincronización periódica.
7. **Balance abierto:** D3-19a/b quedan resueltas en v1.6: el período abierto usa solo días transcurridos y elegibles; una semana sin objetivos muestra «Sin objetivo» y no hereda objetivos anteriores.

## 5. Resumen
- Las fórmulas son coherentes entre sí y con las decisiones aprobadas.
- El esquema actual no puede sostener Balance, Wellbeing, Focus Mode ni la prioridad de hitos y pendientes: hacen falta cambios de esquema, todos sujetos a tu aprobación.
- Las decisiones v1.3 y v1.4 cierran el prorrateo de Balance, la exclusividad durante descansos y pausas, la acumulación tras registro manual, la prioridad por defecto, el comportamiento parcial/cancelado, el alcance offline, el cruce de medianoche, el cumplimiento tardío, la gestión independiente de hábitos y la sincronización sin Realtime. D3-1, D3-3, D3-7, D3-10, D3-11, D3-19a y D3-19b quedaron aprobadas en v1.6. Las demás decisiones de comportamiento de la revisión quedaron cerradas hasta v1.5; la 3.0 aún debe definir las soluciones técnicas de historial, persistencia y compatibilidad.


## 6. Decisiones incorporadas en v1.6 y verificaciones pendientes

| ID | Regla aprobada | Verificación o definición técnica pendiente |
|---|---|---|
| D3-1 | Hitos sin fecha excluidos de Execution | Confirmar qué fuente/campo de fecha se utilizará en 3.0 |
| D3-3 | Ocurrencia del día actual incluida y marcada «día en curso» | Verificar límites de fecha local y cálculo parcial de tiempo en 3.0 |
| D3-7 | Productivity suma a Balance, no directamente a Execution | Verificar que ninguna consulta de Execution incorpore sesiones Focus |
| D3-10 | Prioridad del día: vencidos, vencen hoy y fijados manualmente | Definir campo/estado de fijación manual y orden de presentación en 3.0 |
| D3-11 | Preferencias mínimas de Focus incluidas en 3.2 | Precisar controles y persistencia de preferencias en el diseño de 3.0 |
| D3-19a | Balance de períodos abiertos usa objetivo prorrateado de días transcurridos y elegibles | Definir corte temporal inclusivo y calendario mensual; probar bordes de semana/mes |
| D3-19b | Semana sin objetivos muestra «Sin objetivo», sin herencia | Definir representación visual y comportamiento mensual cuando solo algunas semanas tienen objetivos |

## 7. Decisiones incorporadas en v1.5 y verificaciones pendientes

| ID | Regla aprobada | Verificación o definición técnica pendiente |
|---|---|---|
| D3-21b | Solo sesiones Focus completas incrementan el contador; se reinicia al completar u omitir descanso largo; el cambio de día no reinicia | Persistencia del contador y tratamiento de acciones concurrentes en 3.0 |
| D3-22 | Conservar historial de cambios de fecha límite; cambio previo al vencimiento actualiza la fecha; cambio posterior no elimina el incumplimiento ocurrido | Modelo de eventos/instantáneas y atribución de varios cambios en 3.0 |
| D3-23 | Dividir el tiempo por fecha local y acreditar solo días con ocurrencia programada; ignorar segmentos no programados | Clave de unicidad por ocurrencia y segmento; cálculo del tope por ocurrencia |
| D3-24 | Secuencias y dependencias por dispositivo; detectar concurrencia y resolverla con reglas explícitas | Definir políticas por tipo de transición y regla para registros manuales concurrentes de una misma ocurrencia; requiere revisión y aprobación antes de implementación |

### 7.1 Compatibilidad y salvaguardas
- Salud heredado no se modifica. El almacenamiento de minutos de los hábitos nuevos debe ser aditivo e independiente; no reutilizar `habito_registros.valor` con una semántica distinta.
- Los valores por defecto requeridos por módulos heredados (por ejemplo, prioridad «media») deben evaluarse a nivel de base de datos en la propuesta 3.0, sin ejecutar cambios todavía.
- La exclusividad entre Focus, hábitos y descansos requiere una garantía común en servidor/base de datos; una unicidad aislada por tabla no basta.
- La cola offline debe sobrevivir a la expiración de la sesión de autenticación y reanudarse después de volver a iniciar sesión; no debe depender de cambiar el middleware.
- La auditoría 3.0 debe volver a verificar el número de filas y el estado actual del esquema; el dato de cero filas es solo una observación de la revisión previa, no una garantía futura.
- Confirmar el identificador de frente de diseño (seis frentes) frente a slugs heredados (diez) antes de persistir sesiones y objetivos.

### 7.2 Estado de aprobación
Las decisiones funcionales D3-21b, D3-22, D3-23 y el principio D3-24 están aprobados. No se autoriza todavía la implementación de la Fase 3, las migraciones ni cambios de Supabase. La subfase 3.0 sigue requiriendo autorización expresa.


## 8. Cierre de revisión documental v1.7

- **R1 cerrado:** D3-19a y D3-19b se reconocen como aprobadas en fórmulas y casos límite.
- **R2 cerrado:** se eliminó la sección 1.8 duplicada y fuera de orden del registro.
- **R3 cerrado:** las preguntas de §13.2 figuran como historial aprobado, no pendientes.
- **R4 cerrado:** se consolidó la regla de vencimientos; el diseño de auditoría sigue pendiente en 3.0.
- **R5 cerrado a nivel funcional:** «Sin objetivo», puntos sin porcentaje, prorrateo de período abierto; la UI de meses mixtos requiere diseño en 3.0.
- **R6 pendiente técnico controlado:** D3-24 no aprueba políticas específicas de conflicto; Claude debe proponerlas y esperar aprobación antes de implementar.
- **R7 corregido:** el dato de filas vacías es histórico; 3.0 debe reauditar esquema, políticas y conteos.

**Puerta de control:** iniciar únicamente la auditoría y propuesta de 3.0 tras autorización del usuario; ninguna migración, cambio de RLS, código o configuración se presume autorizada.

## 9. Revisión de consistencia v1.8 (diseño de la auditoría 3.0)

### 9.1 Fórmulas frente al esquema propuesto
| Indicador | Datos | Dónde vivirán | Observación |
|---|---|---|---|
| Execution T | Evaluaciones de compromisos con prioridad | `pendientes` (`prioridad`, `fecha_limite`, `hecho_en`) más `cambios_registro` | Sin interfaz de fecha ni prioridad hasta 3.4, el resultado es «Sin datos» |
| Execution M | Evaluaciones de hitos con prioridad propia | `hitos` (`prioridad`, `hecho_en`, `fecha`) más `cambios_registro` | Igual que T |
| Balance | Puntos de sesiones completadas y objetivos | `focus_sesiones.puntos`, `objetivos_atencion` | «Sin objetivo» si la semana no tiene filas |
| Wellbeing | Ocurrencias, objetivo y tiempo vigente | `habitos_config_versiones`, `habito_tiempo` | Ocurrencias derivadas por calendario, nunca guardadas |

### 9.2 Hallazgos nuevos y su estado
| # | Hallazgo | Estado |
|---|---|---|
| F17 | Los módulos heredados borran `hecho_en` al desmarcar y no lo informan en hitos | Resuelto por diseño: disparadores (P4) |
| F18 | Ninguna interfaz asigna `fecha_limite` ni `fecha` | Pendiente de la 3.4; Execution será «Sin datos» hasta entonces |
| F19 | Una inserción heredada no informa columnas nuevas | Resuelto: `prioridad` con `DEFAULT 'media' NOT NULL` y columnas nuevas nulables |
| F20 | Salud lee `habitos` y `habito_registros` con otra semántica | Resuelto: tablas nuevas e independientes |
| F21 | Un compromiso aplazado cuenta en dos evaluaciones | Resuelto por P6: una identidad, dos evaluaciones |
| F22 | Eliminar un compromiso podría borrar el incumplimiento | **Resuelto (T-4, opción B):** instantánea en el historial y las obligaciones cuya fecha ya llegó permanecen en Execution; las futuras se descartan |
| F23 | Desmarcar un cumplimiento ya atribuido | **Resuelto (T-5, opción C):** se reevalúa la obligación vigente; las sustituidas por un aplazamiento conservan su historial |
| F24 | Las funciones `SECURITY DEFINER` exigen comprobar la propiedad de cada identificador recibido | **Resuelto y aprobado (T-1)**, con ejecución condicionada a la etapa 0 (roles y permisos) |
| F25 | Orden de operaciones por llegada podía descartar eventos causalmente anteriores | Cerrado en principio por P7; algoritmo pendiente |
| F26 | Los valores de 5 minutos y 2 minutos de reloj no están justificados | **Pendiente (T-9):** no se implementan umbrales hasta la simulación (`docs/PRUEBAS-FASE-3-v1.11.md` §13) |
| F27 | El SQL propuesto no estaba validado contra ningún motor | **Parcial:** la v1.8 se validó en PostgreSQL local (122 comprobaciones, 9 escenarios de concurrencia). Los cambios T-7 y T-8b de la v1.9 no se han revalidado. Nada se ha probado en Supabase |
| F28 | Redundancias de la v1.7: filas F3 a F7 con una columna menos | Se mantienen como histórico; sin efecto en el contenido |

## 10. Revisión de consistencia v1.9 (documentos y scripts SQL)

### 10.1 Hallazgos nuevos
| # | Hallazgo | Estado |
|---|---|---|
| F29 | T-8b cambia la protección del historial: de «lectura e inserción» a «solo lectura» | **Incorporado** en etapa 1, diseño §5.1 y §6.1, decisiones C38 y matriz T |
| F30 | T-7 exige un disparador que no existía | **Incorporado** en etapa 3, diseño §6.4 y pruebas §12b; **sin validación local** |
| F31 | Con T-8b, `update` y `delete` sobre el historial dan `permission denied` y no «0 filas» (la prueba H-12 de la v1.8 asumía 0 filas) | Documentado en pruebas H-12 y H-19; **la prueba local deberá actualizarse al revalidar** |
| F32 | Una excepción de RPC hace rollback y no deja fila en `operaciones` | **Documentado** (migraciones etapas 2 y 4, diseño §7 y §10.7, especificación §4.9, pruebas RJ-01 a RJ-04); la etapa 4 deberá registrar los rechazos |
| F33 | Una nota de la etapa 2 aún decía que dos solicitudes simultáneas con el mismo `op_id` podían devolver `temporizador_ocupado` | **Corregida** (C39): el bloqueo consultivo hace que la segunda espere y reciba el resultado almacenado |
| F34 | T-6 dice «fecha de vencimiento», que no es un instante | **Cerrado en v1.11:** aprobada la prioridad vigente al cierre del día de vencimiento (`DISENO-TECNICO` §9.6) |
| F35 | T-10 activa sonido y avisos por defecto, pero el navegador puede bloquearlos | Especificación §4.5 y criterio 38: la interfaz debe informarlo |

### 10.2 Comprobaciones cruzadas realizadas (lectura y búsquedas de texto; no se ejecutó SQL)
| Comprobación | Resultado |
|---|---|
| Las decisiones aprobadas coinciden en `DECISIONES` §1.10, `ESPECIFICACION` §13.7, `DISENO` §12, `REVISION-DECISIONES-T` y la cabecera de `MIGRACIONES` | Coinciden: T-1 a T-13 aprobadas salvo T-9 |
| T-9 figura como pendiente y sin umbrales en todos los documentos | Sí (especificación, decisiones, diseño, migraciones etapa 4 y pruebas §13) |
| `etapa1_aplicar.sql`: `registrar_cambios` es `SECURITY DEFINER`; no existe la política `agregar propios`; se revoca `INSERT, UPDATE, DELETE` | Sí |
| `etapa3_aplicar.sql`: disparador `objetivos_semana_cerrada`, su `REVOKE EXECUTE` y su eliminación en la reversión dura | Sí |
| `habito_crear` con `p_op_id`, `p_dispositivo_id` y `p_seq` en aplicar, reversión suave y dura | Sí |
| T-2: constante de 2 s en `focus_completar` | Sí |
| T-10: `avisos` y `sonido` en `true` en la tabla y en `_prefs` | Sí |
| `_op_existente` volátil con bloqueo consultivo (nota de la etapa 2 corregida) | Sí |
| Resumen de objetos de las migraciones (etapa 3: 3 auxiliares y 2 disparadores) | Actualizado |
| La v1.8 de los documentos quedó intacta | Sí (no contiene referencias a la v1.9) |
| Evidencia de las 122 comprobaciones y los 9 escenarios | Conservada y rotulada como **local, sobre el SQL v1.8**, no de Supabase |

### 10.3 Diferencias conocidas entre documentos y validación local (no son contradicciones)
- Las pruebas locales de la v1.8 no cubren T-7 ni el historial de solo lectura con revocación de `UPDATE` y `DELETE`.
- Las comprobaciones se hicieron por lectura y búsqueda de texto: **el SQL de la v1.9 no se ejecutó**.

## 11. Revisión de consistencia v1.10 (revisión correctiva)

### 11.1 Hallazgos nuevos
| # | Hallazgo | Estado |
|---|---|---|
| F36 | H-12 esperaba «0 filas» al actualizar o borrar el historial; con `REVOKE` el resultado es `permission denied` | **Corregido en la documentación** (PRUEBAS H-12, matriz H-12a a H-12n, C43). La prueba local debe reescribirse |
| F37 | El criterio 8 de la etapa 0 no demostraba el comportamiento de `auth.uid()` | **Rediseñado** (consulta 0.9 con identidad JWT ficticia; análisis en `ANALISIS-ETAPA-0`; C44) |
| F38 | `information_schema.columns` (consulta 0.6) oculta lo que el rol no puede ver y daría falsos negativos | **Corregido:** 0.6 usa `pg_class` y `pg_attribute` |
| F39 | El conteo de filas 0.8 con un rol sujeto a RLS devuelve 0 por falta de identidad | **Documentado:** solo es fiable como rol que omite RLS (0.P) |
| F40 | `REVOKE INSERT, UPDATE, DELETE` deja `TRUNCATE`, `REFERENCES` y `TRIGGER` al cliente por privilegios por defecto | **Cerrado en v1.11 (T-8c)** (C45) |
| F41 | El disparador definer de T-8b depende del propietario de la función, de su `INSERT` y de que la tabla no tenga RLS forzado | **Documentado** y con comprobaciones: etapa 0 (criterios 3 y 11), verificación 1.V, controles TD-05 a TD-08 |
| F42 | Con `auth.uid()` NULL, T-7 no actúa; la cascada de borrado de usuario con identidad no nula fallaría | **Analizado** (`MATRIZ` §2.5 a §2.7). No es un hueco para el cliente. Riesgo de «borrar mi cuenta»: **cerrado en v1.11 con T-7b-1** |
| F43 | T-6 estaba pendiente de confirmación | **Cerrado en v1.11:** aprobada y validada (T6-01 a T6-18) |

### 11.2 Comprobaciones cruzadas (lectura y búsqueda de texto; no se ejecutó SQL)
| Comprobación | Resultado |
|---|---|
| Solo T-9 figura como pendiente en los documentos v1.11 (T-6, T-7b-1, T-7b-3 y T-8c aprobadas) | Sí |
| La lógica de T-7 y T-8b del SQL es idéntica a la de la v1.9 | Sí: solo cambian la etapa 0, la verificación 1.V y las notas |
| Los scripts de `docs/sql/v1.11/` salen de `MIGRACIONES-FASE-3-v1.11.md` | Sí (extraídos de ese documento) |
| La v1.8 y la v1.9 quedaron intactas | Sí |