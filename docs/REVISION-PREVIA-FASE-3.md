# Fase 3: revisión previa a la subfase 3.0

Fecha: 9 nov 2026. Estado: **solo lectura. No se modificó código, base de datos, RLS, autenticación ni configuración.**
Base: especificación funcional de la Fase 3 (Home, Focus Mode y Life Pulse). Esta revisión no reemplaza la auditoría formal de la 3.0.

## 1. Qué se revisó
- Tablas y columnas de Supabase (lectura del esquema `public`).
- `docs/AUDITORIA-Y-PLAN-HOME.md`, `web/app/(app)/page.js`.
- `web/lib/domain/indicadores.js`, `frentesMap.js`, `asistente.js`.
- Componentes del shell de la Fase 2.

## 2. Lo que ya existe y se reutiliza
- **Shell de la Fase 2:** el temporizador montado en `AppShell` persiste entre rutas. Sirven también el selector de frente (`?frente=` con los mismos seis ids), el panel del asistente y los tokens `--ds-*`.
- **Dominio:** `frentesMap.js` agrupa los 10 slugs de la base en los seis frentes. `fechas.js` centraliza America/Bogota. `indicadores.js` impone «nunca un número inventado».
- **Datos:** `pendientes`, `metas`, `hitos`, `habitos`, `habito_registros`, `notas`, `jornadas`. Todas con RLS por `user_id`.

## 3. Esquema actual relevante

| Tabla | Columnas |
|---|---|
| `frentes` | slug, nombre, grupo, orden (10 filas) |
| `pendientes` | id, user_id, frente, texto, hecho, fecha_limite (opcional), creado_en, hecho_en, meta_id |
| `metas` | id, user_id, frente, titulo, descripcion, estado, fecha_meta, creado_en |
| `hitos` | id, user_id, meta_id, titulo, hecho, fecha, creado_en |
| `habitos` | id, user_id, nombre, tipo, unidad, objetivo_dia, veces_semana, activo, creado_en |
| `habito_registros` | id, user_id, habito_id, fecha, valor |
| `agenda_hoy` | id, user_id, fecha, inicio, fin, titulo, detalle |
| `jornadas`, `notas` | ver esquema en Supabase |

Las 18 tablas de datos tienen **0 filas**.

## 4. Brechas

| # | Lo que pide la spec | Lo que hay hoy | Qué implica |
|---|---|---|---|
| 1 | Sesiones de Focus (frente, modalidad, inicio/fin, estado, puntos) | No existe tabla | Esquema nuevo: propuesta y aprobación aparte |
| 2 | Objetivos semanales de atención por frente | No existe tabla | Esquema nuevo. Decidir si guarda el id de diseño (tanku, familia…) o el slug |
| 3 | Prioridad alta/media/baja (pesos 3/2/1 de Execution) y orden manual | `pendientes` no tiene prioridad ni orden. `hitos` y `metas` tampoco | Columnas nuevas. Hoy solo se podría aproximar con `fecha_limite` |
| 4 | Ocurrencias programadas de hábitos (Wellbeing) | `habitos` solo tiene `veces_semana` y `objetivo_dia`: sin días fijos ni historial de cambios | «Ocurrencia vencida» no está definida. Falta una regla |
| 5 | Compromisos con fecha de cumplimiento | `fecha_limite` es opcional | Regla para pendientes sin fecha: ¿entran en T? |
| 6 | Hitos en Execution | Tienen `fecha`, `hecho`, `meta_id`; el frente sale de la meta | Sirven para M, pero sin prioridad propia |
| 7 | Preferencias de Focus (duraciones, sonido) | No hay tabla de preferencias | Arrancar con localStorage; no sincroniza entre dispositivos |
| 8 | Actividad reciente | Fuentes posibles: `hecho_en`, `creado_en` de notas y metas, `habito_registros`, `jornadas`, sesiones futuras | Hoy todas vacías. Se define en la 3.0 |
| 9 | Asistente con recomendaciones | En el código está «no conectado»; no hay ruta de servidor para la IA | Verificar en la 3.5 qué se puede conectar de verdad |

## 5. Puntos de atención
1. **Todo empezará en «Sin datos».** Es lo correcto según la spec, pero la pantalla se verá vacía hasta que haya uso real.
2. **Escrituras nunca probadas.** La auditoría anterior señaló que ningún `INSERT` había llegado a la base. Las sesiones y los objetivos serían las primeras escrituras nuevas: planificar una prueba con autorización.
3. **Contrato de Life Pulse.** `indicadores.js` está hecho para seis áreas (trabajo, finanzas, salud…), no para Execution, Balance y Wellbeing. Hay que adaptarlo sin romper sus pruebas.
4. **Home vs. Mi día.** `/` hoy es el módulo heredado «Mi día» (agenda, correos, pendientes editables). Decidir si el nuevo Home lo reemplaza, convive con él o va en otra ruta. La spec prohíbe eliminar módulos.
5. **Documentación desactualizada.** `AUDITORIA-Y-PLAN-HOME.md` dice 9 filas en `frentes`; hoy son 10 (se agregó el slug `salud`). `frentesMap.js` ya lo contempla.
6. **Temporizador compacto.** El espacio de la barra superior en móvil es justo (se ajustó a 320 px en la Fase 2). Probable ubicación: sobre la barra inferior, cuidando el solapamiento con el botón del asistente.

## 6. Cambios de esquema probables (ninguno se ejecuta sin aprobación)
1. Tabla de sesiones de Focus.
2. Tabla de objetivos semanales de atención.
3. Prioridad y orden en `pendientes` (y decisión sobre hitos).
4. Definición de hábitos programados.

## 6b. Actualización del 9 nov 2026
Las decisiones posteriores cambian varias brechas. Lo vigente está en `docs/ESPECIFICACION-FASE-3.md` (v1.1):
- Brecha 4 (hábitos): ya no se cuentan ocurrencias, se mide tiempo. Sigue requiriendo cambio de esquema.
- Brecha 5 (pendientes sin fecha): resuelta, quedan excluidos de Execution.
- Brecha 7 (preferencias): Supabase es la fuente, no localStorage. Requiere tabla.
- Brecha 1 (sesiones): además deben sincronizarse entre dispositivos y evitar sesiones simultáneas.
- Punto 4 (Home vs. Mi día): Home reemplaza a Mi día en `/`.

## 7. Siguiente paso
Esperar autorización para iniciar la 3.0: mapa de fuentes, brechas y propuesta técnica.
