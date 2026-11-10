# Fase 3: resumen de cambios y pendientes (v1.11, cierre documental y validación local)

Fecha: 9 nov 2026. Cambios respecto de la v1.10. **La v1.8, la v1.9 y la v1.10 se conservan intactas.**

## 1. Confirmación explícita

| Operación | Estado |
|---|---|
| SQL ejecutado en **Supabase** | **Ninguno** |
| SQL ejecutado en un PostgreSQL 16 local y desechable (puerto 54331, sin credenciales) | Sí: 404 PASS, 0 FAIL, 2 NOT RUN justificadas |
| Etapa 0 en Supabase | **No ejecutada** |
| Datos reales, autenticación, middleware, RLS heredado | **Sin cambios** |
| Módulos de la aplicación (`web/`) | **Sin cambios** (solo se leyó `fechas.js` para comparar el lunes) |
| Etapa 4 (`operaciones_aplicar`) y T-9 | **No implementadas** |
| Commits o archivos eliminados | **Ninguno** (solo se destruyó el clúster desechable propio) |

## 2. Decisiones incorporadas

| Decisión | Qué cambió | Validación |
|---|---|---|
| **T-6** | `prioridad_en_cierre`: prioridad vigente al cierre del día de vencimiento (00:00 Bogotá del día siguiente), desde `cambios_registro`; los cambios posteriores no alteran el peso histórico; respaldo documentado; Execution sin cambios | T6-01 a T6-18 (21 filas) PASS |
| **T-7b-1** | `objetivos_semana_cerrada` no actúa con `pg_trigger_depth() > 1`; vale para cualquier disparador anidado (límite documentado) | T7-60 a T7-67, CT-10 PASS |
| **T-7b-3** | `lunes_semana_bogota(instante)`; el disparador la usa con `now()` | T7-40 a T7-44 PASS (0 diferencias con JavaScript en 79 234 instantes) |
| **T-8c** | `REVOKE ALL` y concesión explícita en las tablas de solo lectura; sin `TRUNCATE`, `REFERENCES` ni `TRIGGER` para el cliente | ACL-01 a ACL-05, H-12, TD PASS |
| **T-9** | **Sigue pendiente** | — |

## 3. Documentos y scripts

Nuevos (v1.11): especificación, decisiones, diseño técnico, revisión de consistencia, revisión de decisiones T, riesgos, migraciones, matriz T-7/T-8b, pruebas, análisis de la etapa 0, validación local y este resumen. SQL extraído en `docs/sql/v1.11/`; pruebas reproducibles en `docs/validacion-local-v1.11/` (con `resultados.csv`).

## 4. Pendientes

| # | Pendiente | Quién |
|---|---|---|
| 1 | Revisar el informe `VALIDACION-LOCAL-FASE-3-v1.11.md` | Tu revisión |
| 2 | **T-9:** simulación del reloj y decisión | Tu decisión |
| 3 | Autorizar la etapa 0 de solo lectura en Supabase | Tu autorización |
| 4 | Autorizar, por etapa, la ejecución de las etapas 1 a 3 en Supabase | Tu autorización |
| 5 | Etapa 4 | Depende de T-9 |
