# Fase 3: resumen de cambios y pendientes (v1.9)

Fecha: 9 nov 2026. Cambios respecto de la v1.8, que se conserva intacta.

## 1. Confirmación explícita

| Operación | Estado |
|---|---|
| SQL ejecutado en **Supabase** | **Ninguno** |
| Consultas o cambios sobre datos de **producción** | **Ninguno** |
| Migraciones, reversiones o scripts de reversión ejecutados | **Ninguno** (ni en Supabase ni en local) |
| **Cualquier SQL ejecutado en esta tanda**, incluso local | **Ninguno**: solo se editaron documentos y se extrajeron scripts a archivos |
| Código de la aplicación, autenticación, middleware o esquema existente | **Sin cambios** |
| Archivos eliminados o commits | **Ninguno** |
| Versiones anteriores | **Conservadas** (la v1.8 y los archivos sin sufijo no se tocaron) |
| Subfase 3.1 u otra fase | **No iniciadas** |

## 2. Decisiones incorporadas

| ID | Decisión | Dónde quedó |
|---|---|---|
| T-1 | `SECURITY DEFINER` con salvaguardas; ejecución en Supabase **condicionada a verificar roles y permisos** | Nueva **etapa 0** (consultas de solo lectura y 9 criterios); diseño §5.2 |
| T-2 | Tolerancia de 2 s | `focus_completar` (ya estaba) |
| T-3 | Cancelar un temporizador de hábito conserva los segmentos cerrados | `habito_timer_cancelar` (ya estaba); especificación §5.4.2 |
| T-4 | Obligaciones llegadas permanecen en Execution; las futuras se descartan | Especificación §5.2; diseño §9.3 |
| T-5 | Desmarcar reevalúa la vigente; las sustituidas conservan historial | Especificación §5.2; diseño §9.3 |
| T-6 | Prioridad en la fecha de vencimiento (interpretada como la vigente al terminar el día de la fecha límite) | Diseño §9.3; decisiones C42 |
| T-7 | Objetivos de semanas anteriores inmutables | **Disparador nuevo `objetivos_semana_cerrada` en la etapa 3** |
| T-8 y T-8b | Historial de solo lectura para el cliente | **Etapa 1:** `registrar_cambios` `SECURITY DEFINER`, sin política de `INSERT`, `INSERT`, `UPDATE` y `DELETE` revocados |
| T-10 | Sonido y avisos activados por defecto, informando al usuario | Etapa 2 (ya estaba); especificación §4.5 |
| T-12 | Descanso largo tiene prioridad sobre el corto tras 4 ciclos | Especificación §4.4 |
| T-13 | Modo de registro principal; manual siempre disponible y rechazado sin ocurrencia | Etapa 3 (ya estaba); especificación §5.4.1 |
| Req. | `habito_crear` idempotente (`p_op_id`, `p_dispositivo_id`, `p_seq`) | Etapa 3 (ya estaba) |

## 3. Cambios en el SQL (v1.8 → v1.9)

| Etapa | Cambio |
|---|---|
| **0** (nueva) | Verificaciones previas de solo lectura: atributos de roles, propietarios, pertenencias, privilegios por defecto, colisión de nombres, versión, zona horaria, `auth.uid()` y estado de las tablas |
| **1** | T-8b: función de historial `SECURITY DEFINER`; se elimina la política `agregar propios`; se revoca `INSERT, UPDATE, DELETE` al cliente |
| **2** | Nota corregida sobre `op_id` simultáneo; nota sobre rollback de excepciones; notas de T-2 y T-10. Sin cambios de código SQL |
| **3** | T-7: función y disparador `objetivos_semana_cerrada`; su eliminación en la reversión dura; resumen de objetos actualizado |
| **4** | Sigue **sin redactarse**. T-9 pendiente. Debe registrar las operaciones rechazadas |

Los scripts extraídos están en `docs/sql/v1.9/` (13 scripts SQL y un README, todos con el aviso «NO EJECUTADO»). La fuente es `docs/MIGRACIONES-FASE-3-v1.9.md`.

## 4. Correcciones documentales obligatorias

| Pedido | Hecho |
|---|---|
| Actualizar la nota obsoleta de la etapa 2 sobre `op_id` simultáneo | Corregida en migraciones (nota de la etapa 2), decisiones (C39) y consistencia (F33) |
| Incorporar T-7 y T-8b en los scripts y la documentación | En el SQL, migraciones, diseño, especificación, decisiones, consistencia y pruebas |
| Documentar que las excepciones de RPC hacen rollback y que la etapa 4 debe registrar las rechazadas | Migraciones (etapas 2 y 4), diseño §7 y §10.7, especificación §4.9, pruebas RJ-01 a RJ-04, consistencia F32, decisiones C41 |
| Conservar las 122 comprobaciones y los 9 escenarios como validación local, sin presentarlos como de Supabase | `VALIDACION-LOCAL-FASE-3-v1.9.md` §0 lo rotula como **evidencia local sobre el SQL v1.8**; las migraciones y las pruebas lo repiten |

## 5. Documentos de la v1.9

| Entregable pedido | Archivo |
|---|---|
| Scripts SQL por etapas | `docs/sql/v1.9/` |
| Decisiones | `docs/DECISIONES-FASE-3-v1.9.md` (§1.10, §1.11, §2, C38 a C42) |
| Migraciones | `docs/MIGRACIONES-FASE-3-v1.9.md` |
| Informe de validación | `docs/VALIDACION-LOCAL-FASE-3-v1.9.md` (§0 nueva) |
| Este resumen | `docs/RESUMEN-CAMBIOS-FASE-3-v1.9.md` |
| Además actualizados | `ESPECIFICACION`, `DISENO-TECNICO`, `PRUEBAS`, `REVISION-CONSISTENCIA` (§10) y `REVISION-DECISIONES-T`, todos en v1.9 |

## 6. Pendientes

| # | Pendiente | Qué se necesita |
|---|---|---|
| 1 | **T-9:** cota de desfase de reloj, tolerancia hacia el futuro y algoritmo de reconciliación. **No se implementó ningún umbral** | Simulación (`PRUEBAS` §13) y tu decisión |
| 2 | **Revalidar localmente** los dos cambios de la v1.9 (T-7 y T-8b incorporados) y actualizar la prueba H-12 | Tu autorización para ejecutar en un PostgreSQL local desechable |
| 3 | **Etapa 0** en Supabase (solo lectura) | Tu autorización expresa |
| 4 | Pruebas con `ROLLBACK` en Supabase (P13) | Tu autorización expresa |
| 5 | Ejecución de cada etapa | Tu autorización expresa **por etapa**, tras superar la etapa 0 |
| 6 | Etapa 4 (`operaciones_aplicar`), con registro de operaciones rechazadas | Depende de T-9 |
| 7 | Organización documental (`PROPUESTA-ORGANIZACION-DOCUMENTAL.md`) | Tu aprobación; ya contempla un respaldo previo. Sus nombres apuntan a la v1.8; con la v1.9 habría que actualizarlos al ejecutarla |

## 7. Qué no está validado

- **Nada en Supabase.**
- El disparador de T-7 (nuevo) no se ha ejecutado nunca.
- La versión de T-8b incorporada al SQL no se ejecutó; solo se validó la variante equivalente en local en la tanda anterior.
- El comportamiento de `permission denied` en `UPDATE` y `DELETE` del historial no se ha verificado (la prueba local de la v1.8 asumía «0 filas»).
- Las comprobaciones de consistencia entre documentos y scripts fueron de lectura y búsqueda de texto.
