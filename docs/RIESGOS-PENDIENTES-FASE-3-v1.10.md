# Fase 3: resumen de riesgos pendientes (v1.10)

Fecha: 9 nov 2026. Estado: nada se ha ejecutado en Supabase ni se ha ejecutado SQL en esta revisión (ni local ni remoto). La severidad es mi estimación, no un dato medido.

| # | Riesgo | Severidad | Qué lo cierra | Decisión o autorización necesaria |
|---|---|---|---|---|
| **R-A** | **T-6 sin confirmar:** el peso histórico de las obligaciones depende de la alternativa elegida (A a E). Implementar una antes de confirmarla fijaría resultados históricos | Media | Tu confirmación (`DISENO-TECNICO` §9.6) | **Confirmar T-6** |
| **R-B** | **T-9:** cota de desfase de reloj, tolerancia hacia el futuro y algoritmo de reconciliación sin definir | Media | Simulación (`PRUEBAS` §13) | Decidir tras la simulación |
| **R-C** | **T-7 sin validación local.** Disparador nuevo; su interacción con `INSERT … ON CONFLICT`, sentencias masivas y el borrado de usuario no se ha comprobado | Media | Matriz de pruebas T7-xx | Autorizar la ejecución local |
| **R-D** | **T-7 y borrado en cascada con identidad (T-7b):** borrar a un usuario conservando su propia identidad (por ejemplo una futura función «borrar mi cuenta») fallaría con `semana_cerrada` | Baja hoy, media si se crea esa función | Opciones T-7b-1 a T-7b-4 | **Decidir T-7b** |
| **R-E** | **`auth.uid()` NULL:** el disparador de T-7 y el de historial no actúan sin identidad. Solo los roles que omiten RLS lo alcanzan; no es un hueco para el cliente, pero los cambios administrativos no dejan historial | Baja | Documentado; comprobaciones T7-50 a T7-59 | Ninguna |
| **R-F** | **T-8b sin validación de la versión incorporada.** La variante se validó antes de incorporarse al SQL; el SQL v1.9/v1.10 no se ejecutó | Media | Matriz H-12a a H-12n y TD-01 a TD-13 | Autorizar la ejecución local |
| **R-G** | **Privilegios residuales (T-8c):** `TRUNCATE`, `REFERENCES` y `TRIGGER` para `anon` y `authenticated` en las tablas de solo lectura. No alcanzables por la API REST; sí por una conexión SQL directa con esos roles | Baja | `REVOKE ALL` + `GRANT SELECT` | **Decidir T-8c** |
| **R-H** | **El disparador definer depende del propietario:** si el propietario de la función no es el de la tabla, pierde `INSERT` o la tabla tiene RLS forzado, **las escrituras de pendientes e hitos fallarían** | Alta si ocurre; improbable | Etapa 0 (criterios 3 y 11), 1.V, controles TD-05 a TD-08 | Ejecutar la etapa 0 (con autorización) |
| **R-I** | **Etapa 0 no ejecutada.** Hasta entonces no se sabe si el rol propietario omite RLS, ni cómo se comporta `auth.uid()` en Supabase | Alta para la ejecución | Consultas 0.0 a 0.11 | Autorización expresa |
| **R-J** | **La comprobación 0.9 simula los claims:** no prueba que PostgREST los inyecte ni que verifique el JWT | Media | E2E-1 (pruebas con `ROLLBACK`) y, con autorización, E2E-2 o E2E-3 | Autorización |
| **R-K** | **Diferencias entre PostgreSQL local y Supabase** (roles, PostgREST, versión, asesor de seguridad por funciones definer expuestas) | Media | Etapa 0 y pruebas con `ROLLBACK` | Autorización |
| **R-L** | **Una excepción de RPC hace rollback y no deja fila en `operaciones`.** Para el modo sin conexión equivale a descartar en silencio | Media | La etapa 4 debe capturar la excepción por operación y registrar la rechazada | Depende de T-9 |
| **R-M** | **Etapa 4 sin redactar** (`operaciones_aplicar`) | Media | Resolver T-9 y aprobar el algoritmo | — |
| **R-N** | **Las funciones de dominio** (obligaciones, indicadores) y la cola de IndexedDB **no existen** | Media | Subfases 3.2 y 3.3 | — |
| **R-O** | **Sentencias masivas del cliente sobre objetivos** (borrar o actualizar todo) fallan por completo si hay semanas pasadas | Baja (usabilidad) | La interfaz debe filtrar `semana_inicio >= lunes actual` | Ninguna |
| **R-P** | **Frontera semanal de T-7** no comprobable sin adelantar el reloj | Baja | Propuesta T-7b-3 (función auxiliar con instante) o prueba de la fórmula sobre instantes fijos | Decidir T-7b |
| **R-Q** | **Los cambios hechos con la clave de servicio o desde el panel no quedan en el historial** | Baja | Documentado; la aplicación no usa esa clave | Ninguna |
| **R-R** | **Crecimiento sin purga** de `operaciones` y `cambios_registro` | Baja | Medir con datos reales | — |
| **R-S** | **Un hito ya hecho al aplicar la etapa 1 queda con `hecho_en` nulo** | Baja (hoy 0 filas) | Verificar 0.8 antes | Decidir si hay filas |
| **R-T** | **La prueba H-12 local de la v1.8 está obsoleta** (esperaba 0 filas) | Baja | Reescribir al revalidar | — |

## Qué se necesita de ti, en orden sugerido
1. Revisar el **diseño** de las comprobaciones (`MATRIZ-PRUEBAS-T7-T8B` y `ANALISIS-ETAPA-0`).
2. **Confirmar T-6** (alternativa A a E).
3. Decidir **T-7b** y **T-8c**.
4. Autorizar, si lo apruebas, la **ejecución local** de la matriz (PostgreSQL local y desechable, sin Supabase).
5. Solo después, considerar la etapa 0 en Supabase, con tu autorización expresa.
