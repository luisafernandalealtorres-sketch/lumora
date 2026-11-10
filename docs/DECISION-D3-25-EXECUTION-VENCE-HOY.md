# Decisión D3-25: obligaciones que vencen hoy en períodos abiertos (Execution) — APROBADA

**Estado: APROBADA expresamente por el usuario (9 nov 2026), junto con la consistencia entre períodos, el filtro de frente solo en Balance, la exclusión de Execution y Wellbeing del filtro y los ajustes visuales de Life Pulse. Consolidada en la versión documental v1.11.1** (`ESPECIFICACION`, `DECISIONES` §1.12 y `DISENO-TECNICO` v1.11.1); la v1.11 se conserva sin cambios.

Fecha: 9 nov 2026. Origen: revisión de la tercera entrega de implementación. Alcance: solo el cálculo de Execution (`lib/domain/obligaciones.js`). No cambia SQL, esquema, autenticación ni RLS. No se ejecutó nada en Supabase.

## 1. Regla propuesta por el usuario

1. Las obligaciones cuyo vencimiento es hoy entran al cálculo **desde el inicio del día**.
2. Las ya cumplidas cuentan como completadas.
3. Las que siguen pendientes cuentan como **incumplidas provisionalmente**.
4. Al cierre del día se consolida el resultado, con la prioridad vigente al cierre del vencimiento (T-6).
5. Se mantienen la atribución histórica y los registros de cumplimiento tardío.

## 2. Revisión contra la especificación y las decisiones

| Fuente | Qué dice | Consistencia con la regla |
|---|---|---|
| Especificación §5.1 | Los períodos abiertos contabilizan lo «cuya fecha de cumplimiento ya haya llegado» | **Consistente.** Una obligación con fecha = hoy es una fecha que ya llegó (d ≤ hoy). La implementación anterior la dejaba fuera mientras sí contaba la ya cumplida: era la incoherencia que se corrige |
| **D3-3** (aprobada, v1.6) | «La ocurrencia de hoy se incluye en Wellbeing diario y se identifica como día en curso; no se trata como día cerrado» | **Consistente y coherente.** Nota: D3-3 está **aprobada, no pendiente**, y su texto es de **Wellbeing**. Esta regla extiende el mismo criterio a Execution; por eso se registró como decisión nueva (D3-25), ya aprobada |
| D3-19a (Balance, aprobada) | El denominador de la semana en curso incluye el día actual | **Consistente.** Los tres indicadores quedan con el mismo criterio de «hoy» |
| Diseño §9.2 | «Vence hoy» sigue **abierto**; «vencido» empieza al día siguiente | **Compatible, con una precisión.** El **estado** de la obligación sigue siendo `abierta` hasta A(d) (00:00 de Bogotá del día siguiente). Lo que cambia es el **tratamiento en el indicador**: una obligación abierta de hoy suma su peso al denominador y no al numerador, marcada «provisional» |
| T-6 (aprobada) | Peso por la prioridad vigente al cierre del día de vencimiento | **Consistente.** El peso provisional de una obligación abierta puede cambiar al consolidar (si la prioridad cambia entre ahora y el cierre); no se «congela» antes del corte |
| T-4 / T-5 / D3-22 | Eliminación, desmarcado y aplazamiento | **Sin cambios.** Aplazar o eliminar antes del cierre sigue descartando la obligación; desmarcar reevalúa la vigente |
| §5.2 (tardío) | El cumplimiento tardío se atribuye al período de la fecha d | **Sin cambios.** Si lo de hoy queda incumplido al cierre y se cumple después, pasa a «cumplida tardía» en el período de su fecha |

**Conclusión: la regla es consistente con la especificación y con D3-3/D3-19a.** Lo único que no estaba escrito era su aplicación a Execution.

## 3. Efecto previo que se corrige

Con la regla anterior, un día con un compromiso de hoy cumplido y otro de hoy abierto mostraba 100 % (el abierto no entraba al denominador), y bajaba a 50 % al cerrar el día sin que nada hubiera cambiado: **inflaba temporalmente Execution**.

## 4. Regla implementada

- Elegible: `fecha ≤ hoy` (America/Bogota). Las fechas futuras no cuentan, aunque ya estén cumplidas.
- `cumplida_a_tiempo` y `cumplida_tardia`: peso completado. `incumplida`: solo denominador. `abierta` (solo puede ser hoy): solo denominador, **provisional**.
- La interfaz indica «Incluye N obligación(es) que vencen hoy: cuentan como no cumplidas de forma provisional y se consolidan al cierre del día».
- Si solo existen obligaciones abiertas de hoy, Execution es **0 % provisional** (no «sin datos»): hay compromisos vencidos al cierre y ninguno cumplido.
- El resultado se consolida solo, porque al día siguiente la obligación pasa a `incumplida` (o `cumplida_tardia` si se cumple) con la prioridad al cierre.

## 5. Consecuencia que debes conocer

Un día abre con Execution bajo si hay compromisos de hoy sin cumplir, y sube a medida que los cumples. Es lo esperado de contarlos desde el inicio; la etiqueta «provisional» lo explica. No hay forma de «ganar» más del 100 %.

## 6. Pruebas

- `tests/obligaciones-lifepulse.test.mjs`: regla D3-25 (hoy abierto = provisional; hoy cumplido = no provisional; solo abiertas = 0 % provisional; consolidación con T-6 y tardío conserva la atribución).
- `tests/lifepulse-consistencia.test.mjs`: sumas de semana y mes = suma de sus días (pesos, provisionales, objetivos prorrateados, puntos, tiempos), valor = fórmula sobre las sumas (no promedio de días), 5 fechas de «hoy» y 3 períodos cada una.
- `tests/integracion-local/temporizador.integ.mjs`: caso real en PostgreSQL local (hoy abierto → 25 % provisional; al cumplirlo → 100 %; día = semana = mes).

## 7. Filtro de frente de la URL (`?frente=`)

- Se conecta **solo a Balance** (en Life Pulse y en Atención). Execution y Wellbeing **no** se filtran: los compromisos y los hábitos no tienen un frente de diseño definido en la especificación, y filtrarlos sería inventar una asignación. La interfaz lo dice cuando hay un filtro activo.
- Con filtro: solo ese frente entra al denominador y a los puntos; sin objetivo para ese frente → «Sin objetivo» con sus puntos aparte (no 0 %).
- `MODULOS_CON_FILTRO` pasa de `[]` a `['atencion', 'life-pulse']`; los módulos heredados siguen sin aplicarlo.
