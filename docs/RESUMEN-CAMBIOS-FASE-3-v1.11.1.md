# Fase 3: resumen de cambios (v1.11.1, cierre de la tercera entrega)

Fecha: 9 nov 2026. Cambios respecto de la v1.11. **La v1.11 y las anteriores se conservan sin cambios** (la v1.11 fue restaurada a su contenido original tras anotar provisionalmente D3-25 en ella).

## 1. Confirmación explícita

| Operación | Estado |
|---|---|
| SQL ejecutado en **Supabase** | **Ninguno** |
| Credenciales o datos de producción | **No usados** |
| Migraciones o etapa 0 en Supabase | **No ejecutadas** |
| Autenticación, middleware, RLS heredado | **Sin cambios** |
| T-9 y etapa 4 (`operaciones_aplicar`) | **No implementados** |
| Commits | **Ninguno** |
| Pruebas | Solo en un PostgreSQL local y desechable |

## 2. Qué consolida la v1.11.1

| Aprobación (9 nov 2026) | Dónde queda registrada |
|---|---|
| **D3-25:** lo que vence hoy entra a Execution desde el inicio del día; abierto = incumplido provisional; se consolida al cierre con T-6; se conserva la atribución histórica y el cumplimiento tardío; las fechas futuras no cuentan | `ESPECIFICACION` §5.2; `DISENO-TECNICO` §9.3; `DECISIONES` §1.12; `DECISION-D3-25-EXECUTION-VENCE-HOY.md` |
| Consistencia entre períodos diario, semanal y mensual (referencia D3-26) | `DECISIONES` §1.12 |
| Filtro de frente (`?frente=`) solo en Balance, en Life Pulse y en Atención (D3-27) | `DECISIONES` §1.12; `DISENO-TECNICO` §9.3 |
| Execution y Wellbeing fuera del filtro hasta que exista una regla de asignación por frente (D3-28) | `DECISIONES` §1.12; `DISENO-TECNICO` §9.3 |
| Ajustes visuales de Life Pulse (D3-29) | `DECISIONES` §1.12 |

Los identificadores D3-26 a D3-29 son referencias de este registro para aprobaciones agrupadas; no cambian ninguna regla de cálculo.

## 3. Documentos de la v1.11.1

`ESPECIFICACION-FASE-3-v1.11.1.md`, `DECISIONES-FASE-3-v1.11.1.md`, `DISENO-TECNICO-FASE-3-v1.11.1.md`, este resumen e `INFORME-ENTREGA-3-v1.11.1.md`. El SQL (`docs/sql/v1.11`), las migraciones y la validación local siguen siendo los de la v1.11, porque **ningún SQL cambió**.

## 4. Pendientes

| # | Pendiente | Responsable |
|---|---|---|
| 1 | **T-9:** reloj y reconciliación sin conexión | Tu decisión (tras la simulación) |
| 2 | Autorizar la etapa 0 de solo lectura en Supabase | Tu autorización |
| 3 | Autorizar, por etapa, las migraciones v1.11 | Tu autorización |
| 4 | Revisión integral de Home y experiencia autenticada | Ver `REVISION-HOME-EXPERIENCIA-AUTENTICADA.md` |
