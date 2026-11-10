# Fase 3: registro de decisiones y contradicciones

Fecha: 9 nov 2026. Corresponde a la especificación v1.2 (`docs/ESPECIFICACION-FASE-3.md`).
Solo documentación. No se tocó código, Supabase, RLS, autenticación ni configuración.

## 1. Decisiones aprobadas

### 1.1 Base (especificación v1.0, aprobada)
Objetivo de la fase; tres indicadores independientes sin puntuación global; fórmulas de Execution (E = 0.6T + 0.4M, pesos 3/2/1) y Balance; períodos con semana de lunes a domingo en America/Bogota; indicadores semanales y mensuales recalculados desde registros originales; un punto por sesión completada, sin proporcionalidad; descansos sin puntos; descanso largo sugerido tras 4 ciclos y sin inicio automático; valores iniciales 30/5/20 minutos; IA que propone pero no ejecuta sin aprobación; «Sin datos» nunca cero; sin datos ficticios; restricciones de autenticación, middleware y RLS; seis frentes como dimensión transversal.

### 1.2 Primera tanda (9 nov 2026)
| # | Decisión | Estado |
|---|---|---|
| A1 | Home reemplaza a Mi día en `/`; auditar Mi día; no eliminar funcionalidades ni código sin autorización | Aprobada |
| A2 | Pendientes sin fecha límite quedan excluidos de Execution hasta tener fecha | Aprobada |
| A3 | Hábitos con frecuencia (todos los días o días específicos), duración objetivo (minutos u horas), registro manual o con temporizador; Wellbeing por tiempo con tope 100 % por ocurrencia | Aprobada |
| A4 | Supabase como fuente de verdad de Focus Mode; sincronización entre dispositivos; sesión activa recuperable; persistir inicio, pausas, reanudaciones y finalización; sin sesiones ni puntos duplicados | Aprobada |
| A5 | Focus Mode y temporizadores de hábitos con registros independientes | Aprobada |

### 1.3 Segunda tanda (esta versión)
| # | Decisión | Estado |
|---|---|---|
| B1 | Un solo temporizador activo globalmente (Focus u hábito). Equivale a cerrar D3-5 con la exclusividad global | Aprobada |
| B2 | El temporizador acumula; el registro manual reemplaza el acumulado; se conservan fuente e historial. Equivale a cerrar D3-4 | Aprobada |
| B3 | Modo sin conexión: operaciones pendientes locales, sincronización al reconectar, Supabase como fuente de verdad, resolución de conflictos y prevención de duplicados. Reemplaza a D3-9 | Aprobada |
| B4 | Cada hito con prioridad propia (alta, media, baja; pesos 3, 2, 1), sin heredar de la meta | Aprobada |
| B5 | El centro de control se llama Home y ocupa `/`. Cierra D3-12 | Aprobada |

## 2. Decisiones pendientes de aprobación

Las recomendaciones **no son aprobaciones**. La especificación v1.2 no las trata como decididas.

### 2.1 Conservadas del usuario
| ID | Tema | Recomendación (no aprobada) |
|---|---|---|
| D3-1 | Hitos sin fecha en Execution | Excluirlos, igual que los pendientes |
| D3-2 | Compromiso completado después de su fecha límite | Cuenta como cumplido, evaluado en el período de su fecha límite |
| D3-3 | Ocurrencia del día en curso en Wellbeing diario | Incluirla, marcada «día en curso» |
| D3-6 | Dónde se gestionan los hábitos nuevos (Salud heredado usa el modelo anterior) | Interfaz nueva; cambiar Salud solo con autorización aparte |
| D3-7 | Cómo contribuye Productivity a Execution | Indirecta, por compromisos asociados |
| D3-8 | Realtime de Supabase | No usarlo al inicio |
| D3-10 | Definición de «prioridad del día» | Prioridad asignada con fecha límite hoy, más lo que fije el usuario |
| D3-11 | Pantalla de preferencias de Focus en la Fase 3 | Sí, mínima, en 3.2 |

### 2.2 Nuevas, surgidas de la revisión de consistencia (ver `docs/REVISION-CONSISTENCIA-FASE-3.md`)
| ID | Tema | Recomendación (no aprobada) |
|---|---|---|
| D3-13 | Sin conexión: ¿iniciar temporizadores y registrar entradas manuales de hábitos? | Iniciar no; entradas manuales sí, en la cola |
| D3-14 | Prioridad por defecto de pendientes e hitos creados sin ella | «Media» |
| D3-15 | (a) Temporizador en pausa y lugar del temporizador único; (b) temporizador tras registro manual; (c) cruce de medianoche | (a) Sigue ocupando el lugar; (b) acumula sobre el valor vigente; (c) fecha de inicio en America/Bogota |
| D3-16 | Diferencia entre sesión «parcial» y «cancelada» | Completar antes de tiempo guarda parcial; cancelar descarta |

## 3. Contradicciones detectadas y su resolución

### 3.1 De la primera tanda (v1.1)
| # | Contradicción | Resolución |
|---|---|---|
| C1 | «No eliminar rutas o módulos» y «no modificar módulos heredados sin autorización» frente a Home reemplazando Mi día | La decisión autoriza la ruta `/`. No se borra código ni funcionalidad; la pantalla actual no se retira hasta que sus funciones estén integradas o reubicadas |
| C2 | Wellbeing por conteo de ocurrencias frente a Wellbeing por tiempo | Se reemplaza la fórmula por tiempo con tope por ocurrencia |
| C3 | Hábitos «configurados por el usuario» y modelo actual por conteo (`veces_semana`, `objetivo_dia`) | El modelo no alcanza; se propondrá esquema nuevo con aprobación. Tablas vacías: no hay migración |
| C4 | Persistencia «recuperable» sin fuente definida y localStorage como arranque sugerido | Supabase es la fuente. localStorage nunca decide el estado |
| C5 | Notificaciones «según preferencias» frente a preferencias sincronizadas | Preferencias en Supabase; el permiso del navegador es por dispositivo |
| C6 | «Productivity puede contribuir a la ejecución» frente a una fórmula que solo usa compromisos e hitos (contradicción ya presente en v1.0) | **No resuelta**: pendiente D3-7. Mientras tanto la fórmula manda y las sesiones no entran por sí solas |
| C7 | «No todo necesita Pomodoro» frente a temporizador de hábitos | Coherente: tiempo de hábitos solo alimenta Wellbeing, nunca puntos de atención |
| C8 | Prioridad manual (§3.5) y pesos por prioridad (§5.2) frente a `pendientes` sin campo de prioridad | El mismo campo sirve a ambos fines. Falta la columna (propuesta de esquema) |
| C9 | Pendientes editables en Mi día frente a Home en `/` | Las funciones de pendientes deben existir en Home antes de retirar la pantalla actual |

### 3.2 De esta tanda (v1.2)
| # | Contradicción | Resolución |
|---|---|---|
| C10 | v1.1: «sin conexión no se inician sesiones y la activa solo cuenta» frente a B3 (operaciones pendientes) | Prevalece B3 para cambios de sesiones activas. Iniciar sin conexión y registros manuales quedan en D3-13 |
| C11 | v1.1: «no dos sesiones de Focus activas» frente a B1 (un temporizador global) | Se generaliza: un solo temporizador activo, de cualquier tipo, garantizado en el servidor |
| C12 | v1.1: «el registro manual corrige» y «no alterar datos históricos» frente a B2 («reemplaza») | El reemplazo no borra nada: cada cambio queda en un historial con valor anterior, nuevo, fuente, hora y dispositivo |
| C13 | v1.1: «las marcas de tiempo son las del servidor» frente a operaciones hechas sin conexión | Cada operación lleva hora del dispositivo; el servidor la valida contra su hora de recepción y, fuera de tolerancia, usa la suya y lo indica |
| C14 | v1.1: «localStorage no es fuente» frente a una cola local de operaciones | La cola local solo guarda operaciones pendientes. El estado oficial sigue siendo Supabase. Se declara que borrar datos del navegador pierde lo no sincronizado |
| C15 | Pesos por prioridad para hitos, que hoy no tienen prioridad y dependen de una meta | B4: prioridad propia por hito, sin herencia. Falta la columna (propuesta de esquema) |
| C16 | «Registros independientes» (A5) frente a «un solo temporizador global» (B1) | No chocan: los registros son separados y solo comparten la regla de exclusividad |
| C17 | D3-12 pendiente sobre el nombre de la navegación | Cerrada por B5: «Home» |
