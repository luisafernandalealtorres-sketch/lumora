# Fase 3: resumen de cambios y pendientes (v1.10, revisión correctiva)

Fecha: 9 nov 2026. Cambios respecto de la v1.9. **La v1.8 y la v1.9 se conservan intactas.**

## 1. Confirmación explícita

| Operación | Estado |
|---|---|
| SQL ejecutado en **Supabase** | **Ninguno** |
| **Cualquier SQL ejecutado en esta revisión**, local o remoto | **Ninguno**. No se ejecutaron pruebas |
| Consultas o cambios sobre datos de producción | **Ninguno** |
| Migraciones, reversiones o scripts de reversión ejecutados | **Ninguno** |
| Código de la aplicación, autenticación, middleware o esquema | **Sin cambios** |
| Lógica del SQL de aplicación y de reversión (etapas 1 a 3) | **Idéntica a la v1.9** (verificado comparando los scripts extraídos) |
| Archivos eliminados o commits | **Ninguno** |

## 2. Qué se pidió y qué se hizo

| # | Pedido | Resultado | Dónde |
|---|---|---|---|
| 1 | T-6 / C42: conservar la interpretación, dejarla **pendiente de tu confirmación** y documentar consecuencias históricas | Hecho. Alternativas A a E, 13 consecuencias y un ejemplo numérico | `DISENO-TECNICO` §9.6; `DECISIONES` §1.10, pendiente 7 y C42; `ESPECIFICACION` §5.2 |
| 2 | T-7: matriz de pruebas locales (INSERT, UPDATE, DELETE; semana cerrada, actual, futura; cascada de usuario) y análisis de `auth.uid()` NULL, **sin cambiar la lógica** | Hecho. 42 casos T7-xx (numerados de T7-01 a T7-65) y 4 opciones T-7b | `MATRIZ-PRUEBAS-T7-T8B` §2 |
| 3 | T-8b: revisar la matriz de permisos, actualizar H-12 a `permission denied`, comprobar que el disparador definer escribe con los permisos de su propietario y que el cliente no puede escribir | Hecho. H-12a a H-12n y TD-01 a TD-13; hallazgo de privilegios residuales (T-8c) | `MATRIZ-PRUEBAS-T7-T8B` §3; `PRUEBAS` H-12 |
| 4 | Etapa 0: comprobar `auth.uid()` por comportamiento con identidad JWT de prueba, sin datos de producción ni confundir contextos; aclarar quién ejecuta cada consulta | Hecho. Consulta 0.9, 11 criterios y tabla de permisos | `ANALISIS-ETAPA-0`; `MIGRACIONES` etapa 0 |
| 5 | Consistencia, registro de cambios, v1.8 y v1.9 intactas, sin commits | Hecho | `REVISION-CONSISTENCIA` §11 |

## 3. Hallazgos de esta revisión

| ID | Hallazgo | Estado |
|---|---|---|
| H-12 | La expectativa «0 filas» era incorrecta: con `REVOKE` PostgreSQL responde `permission denied` antes de aplicar RLS | Corregida en la documentación |
| T-8c | `REVOKE INSERT, UPDATE, DELETE` no retira `TRUNCATE`, `REFERENCES` ni `TRIGGER`, que los privilegios por defecto de Supabase otorgan a `anon` y `authenticated` | **Propuesta sin aplicar** |
| T-7b | Con `auth.uid()` NULL T-7 no actúa. Solo lo alcanzan roles que omiten RLS (**no es un hueco para el cliente**). Pero borrar al usuario con su propia identidad fallaría | **Propuesta sin aplicar** (4 opciones) |
| TD | El disparador definer depende del propietario, de su `INSERT` y de que no haya RLS forzado | Documentado, con controles negativos y comprobaciones en la etapa 0 y en 1.V |
| 0.6 | `information_schema` daría falsos negativos con un rol sin privilegios | Cambiado a catálogos |
| 0.8 | Con RLS el conteo da 0 por falta de identidad | Documentado: solo es fiable como rol que omite RLS |
| 0.9 | La definición de `auth.uid()` no demuestra el comportamiento | Rediseñado |

## 4. Entregables

| Entregable pedido | Archivo |
|---|---|
| Nueva versión de los documentos | `ESPECIFICACION`, `DECISIONES`, `REVISION-CONSISTENCIA`, `DISENO-TECNICO`, `MIGRACIONES`, `PRUEBAS`, `REVISION-DECISIONES-T`, `VALIDACION-LOCAL`, todos `-FASE-3-v1.10.md` |
| Matriz de pruebas T-7/T-8b | `MATRIZ-PRUEBAS-T7-T8B-FASE-3-v1.10.md` |
| Análisis corregido de la etapa 0 | `ANALISIS-ETAPA-0-FASE-3-v1.10.md` |
| Resumen de riesgos pendientes | `RIESGOS-PENDIENTES-FASE-3-v1.10.md` |
| Scripts | `docs/sql/v1.10/` (solo cambian `etapa0` y `etapa1_verificacion`) |
| Este resumen | `RESUMEN-CAMBIOS-FASE-3-v1.10.md` |

## 5. Pendientes y decisiones que necesito

| # | Pendiente | Tipo |
|---|---|---|
| 1 | **Revisar el diseño de las comprobaciones** (matriz y análisis de la etapa 0) | Tu revisión |
| 2 | **Confirmar T-6** (alternativa A propuesta; B a E en el diseño) | Tu decisión |
| 3 | **T-7b:** elegir T-7b-1 a T-7b-4 (mi recomendación, no aprobada: T-7b-3 y T-7b-1, o T-7b-4 si no habrá «borrar mi cuenta» pronto) | Tu decisión |
| 4 | **T-8c:** aprobar o no retirar los privilegios residuales | Tu decisión |
| 5 | **T-9:** sigue pendiente (simulación del reloj) | Tu decisión |
| 6 | Autorizar la ejecución **local** de la matriz (PostgreSQL desechable, sin Supabase) | Tu autorización |
| 7 | Etapa 0, pruebas con `ROLLBACK` y cada etapa en Supabase | Tu autorización expresa, por separado |

Los riesgos pendientes están resumidos en `RIESGOS-PENDIENTES-FASE-3-v1.10.md`.

## 6. Qué no está validado
- **Nada en Supabase.**
- **T-7, T-8b incorporado y la matriz** no se han ejecutado nunca (ni siquiera en local para la versión actual).
- La etapa 0 rediseñada no se ha ejecutado y su comprobación 0.9 **simula** los claims: no prueba la entrada real por PostgREST.
- Las comprobaciones de consistencia fueron lectura y búsquedas de texto.
