# Fase 3: resumen de riesgos pendientes (v1.11)

Fecha: 9 nov 2026. Estado: el SQL v1.11 se validó **solo en un PostgreSQL 16 local y desechable** (`docs/VALIDACION-LOCAL-FASE-3-v1.11.md`). **No se ejecutó nada en Supabase.** La severidad es mi estimación, no un dato medido.

## Riesgos cerrados en v1.11 (con su evidencia)

| # | Riesgo (v1.10) | Cierre |
|---|---|---|
| R-A | T-6 sin confirmar | Aprobada; `prioridad_en_cierre`; T6-01 a T6-18 PASS (incluye 75 % y 60 %) |
| R-C | T-7 sin validación local | Matriz T7-xx ejecutada: 50 PASS, 2 NOT RUN justificadas |
| R-D | Borrado en cascada con identidad (T-7b) | T-7b-1: no actúa con `pg_trigger_depth() > 1`; T7-61 y T7-62 PASS |
| R-F | T-8b sin validación de la versión incorporada | H-12, TD-01 a TD-10 y controles negativos TD-05 a TD-08 PASS |
| R-G | Privilegios residuales (T-8c) | `REVOKE ALL` + concesión explícita; ACL-01 a ACL-05 PASS |
| R-P | Frontera semanal de T-7 | T-7b-3: `lunes_semana_bogota`; T7-40 a T7-44 PASS (79 234 instantes comparados con JavaScript, 0 diferencias) |
| R-T | Prueba H-12 obsoleta | Reescrita |

## Riesgos que siguen abiertos

| # | Riesgo | Severidad | Qué lo cierra | Decisión o autorización necesaria |
|---|---|---|---|---|
| **R-B** | **T-9:** cota de desfase de reloj, tolerancia hacia el futuro y algoritmo de reconciliación sin definir. No se implementó nada por inferencia | Media | Simulación (`PRUEBAS` §13) | Decidir tras la simulación |
| **R-H** | **El disparador definer depende del propietario:** si el propietario de la función no es el de la tabla, pierde `INSERT` o la tabla tiene RLS forzado, las escrituras de pendientes e hitos fallarían. Los controles negativos lo demuestran localmente (TD-05 a TD-07). **Nota nueva v1.11:** si el propietario real hereda privilegios de otro rol (en el entorno local `sb_owner` hereda de `service_role`), un control que solo le revoque `INSERT` no basta; hay que revocar también a esos roles | Alta si ocurre; improbable | Etapa 0 (criterios 3 y 11), 1.V | Ejecutar la etapa 0 (con autorización) |
| **R-E** | **`auth.uid()` NULL:** el disparador de T-7 y el de historial no actúan sin identidad. Solo los roles que omiten RLS lo alcanzan; los cambios administrativos no dejan historial | Baja | Documentado; T7-50 a T7-59 | Ninguna |
| **R-I** | **Etapa 0 no ejecutada** en Supabase: no se sabe si el rol propietario omite RLS ni cómo se comporta `auth.uid()` allí | Alta para la ejecución | Consultas 0.0 a 0.11 | Autorización expresa |
| **R-J** | **La comprobación 0.9 simula los claims:** no prueba que PostgREST los inyecte ni que verifique el JWT | Media | E2E-1 (con `ROLLBACK`) y, con autorización, E2E-2 o E2E-3 | Autorización |
| **R-K** | **Diferencias entre PostgreSQL local y Supabase** (roles reales, PostgREST, versión, asesor de seguridad por funciones definer expuestas, privilegios por defecto) | Media | Etapa 0 y pruebas con `ROLLBACK` | Autorización |
| **R-L** | **Una excepción de RPC hace rollback y no deja fila en `operaciones`.** Para el modo sin conexión equivale a descartar en silencio | Media | La etapa 4 debe capturar la excepción por operación y registrar la rechazada | Depende de T-9 |
| **R-M** | **Etapa 4 sin redactar** (`operaciones_aplicar`) | Media | Resolver T-9 y aprobar el algoritmo | — |
| **R-N** | **Las funciones de dominio** (obligaciones, indicadores) y la cola de IndexedDB **no existen** | Media | Subfases 3.2 y 3.3 | — |
| **R-O** | **Sentencias masivas del cliente sobre objetivos** fallan por completo si hay semanas pasadas (atómico, T7 validado) | Baja (usabilidad) | La interfaz debe filtrar `semana_inicio >= lunes actual` | Ninguna |
| **R-Q** | **Los cambios hechos con la clave de servicio o desde el panel no quedan en el historial** (y por tanto T-6 usaría el último valor conocido) | Baja | Documentado; la aplicación no usa esa clave | Ninguna |
| **R-R** | **Crecimiento sin purga** de `operaciones` y `cambios_registro` | Baja | Medir con datos reales | — |
| **R-S** | **Un hito ya hecho al aplicar la etapa 1 queda con `hecho_en` nulo** | Baja (hoy 0 filas) | Verificar 0.8 antes | Decidir si hay filas |
| **R-U** | **T7-42 y T7-59 no ejecutadas (NOT RUN):** el cambio de semana en tiempo real no se probó manipulando el reloj; y la alteración de claims desde la API no es alcanzable por diseño (revisión de código) | Baja | Fronteras cubiertas por T7-40, T7-41, T7-44; E2E en Supabase con autorización | Ninguna |
| **R-V** | **El historial de prioridad solo existe desde la etapa 1:** los compromisos anteriores quedan con prioridad `media` en el relleno | Baja | Documentado (`DISENO-TECNICO` §9.6, consecuencia 10) | Ninguna |

## Qué se necesita de ti, en orden sugerido
1. Revisar el informe de validación local v1.11.
2. Decidir cuándo resolver **T-9** (simulación del reloj).
3. Si lo apruebas, autorizar la etapa 0 de solo lectura en Supabase (R-H, R-I, R-J, R-K) y, después y por etapa, la ejecución de las etapas 1 a 3.
