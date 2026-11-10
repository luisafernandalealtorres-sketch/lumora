# Fase 3, subfase 3.0: auditoría de datos y arquitectura de Home

Fecha: 9 nov 2026. Base: especificación v1.7 (aprobada por el usuario) y estado real del proyecto.
**Solo lectura.** No se ejecutó ninguna migración, escritura, cambio de RLS, autenticación, configuración ni tarea programada. No se modificó código. El único archivo nuevo es este informe.
Todo lo de las secciones 5 a 9 es **propuesta, no aprobada**: nada se ejecuta hasta que la apruebes (sección 11).

---

## 1. Resumen ejecutivo

1. **El esquema no alcanza para la Fase 3.** Hacen falta tablas nuevas (sesiones, descansos, operaciones, preferencias, objetivos, hábitos nuevos) y columnas nuevas aditivas en `pendientes` e `hitos`. Se pueden hacer sin tocar nada de lo que usan los módulos heredados.
2. **Hallazgo crítico: Execution no tiene fuente hoy.** Ninguna pantalla de la app permite poner `fecha_limite` a un pendiente ni `fecha` a un hito. Con la regla aprobada (sin fecha, excluido), Execution mostraría «Sin datos» hasta que la 3.4 entregue esa interfaz.
3. **Los módulos heredados editan sin dejar historial.** Al desmarcar un pendiente, `Pendientes.js` borra `hecho_en`. Para cumplir D3-2 y D3-22 el historial debe capturarse en la base de datos (disparadores), no en la interfaz.
4. **El temporizador único es viable en base de datos** con una tabla de bloqueo de una fila por usuario. No requiere extensiones.
5. **El asistente no tiene nada conectado:** no hay rutas de API, ni SDK, ni clave. La 3.5 depende de una decisión tuya sobre cómo conectarlo.
6. **Mi día:** ninguna de sus fuentes externas está conectada. Las tareas programadas escriben archivos locales y el artefacto, no la base de datos.
7. **Datos reales: cero.** Las 18 tablas de datos siguen con 0 filas, así que no hay nada que migrar y las pruebas de escritura reales no existen todavía.

---

## 2. Re-auditoría del esquema (9 nov 2026, solo lectura)

| Comprobación | Resultado |
|---|---|
| Proyecto | `kztoazvjfwzndeubghey`, activo, Postgres 17 |
| Migraciones aplicadas | 4: `crear_tablas_cerebro`, `crear_tablas_salud`, `crear_metas_y_hitos`, `crear_finanzas_completas` |
| Tablas `public` | 19, todas con RLS activo |
| Políticas | 18 tablas con una política `propios` (ALL, `authenticated`, `auth.uid() = user_id`). `frentes`: solo lectura para autenticados |
| Filas | `frentes` 10; las otras 18 tablas de datos, 0; `auth.users` 1 |
| Funciones y disparadores en `public` | **Ninguno** |
| Extensiones instaladas | `plpgsql`, `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `supabase_vault`. No hace falta instalar nada |
| Asesor de seguridad | 1 aviso: protección de contraseñas filtradas desactivada (no aplica con inicio solo por Google) |
| Asesor de rendimiento | 7 claves foráneas sin índice (todas de `frente` y `user_id`) y 2 índices sin uso. Irrelevante con 0 filas |

Columnas relevantes hoy:
- `pendientes`: `frente` (FK a `frentes.slug`), `texto`, `hecho`, `fecha_limite`, `hecho_en`, `meta_id`. Sin prioridad, orden ni historial.
- `hitos`: `meta_id`, `titulo`, `hecho`, `fecha`. Sin prioridad ni `hecho_en`.
- `habitos`: `tipo` (`check` o `cantidad`), `unidad`, `objetivo_dia`, `veces_semana`, `activo`.
- `habito_registros`: `habito_id`, `fecha`, `valor`, con unicidad `(habito_id, fecha)`.
- `frentes.grupo` solo admite `ticketcode`, `tanku`, `personal`.

---

## 3. Mapa de fuentes

| Necesidad de la spec | Fuente real hoy | Estado | Brecha |
|---|---|---|---|
| Execution T (compromisos) | `pendientes` | Existe, pero **ninguna interfaz asigna `fecha_limite`** | Prioridad, interfaz de fecha, historial |
| Execution M (hitos) | `hitos` | Existe, **ninguna interfaz asigna `fecha`** | Prioridad, `hecho_en`, interfaz de fecha, historial |
| Balance, puntos | Nada | No existe | Sesiones Focus |
| Balance, objetivos | Nada | No existe | Objetivos semanales por frente |
| Wellbeing | `habitos` y `habito_registros` heredados | **Modelo incompatible** (conteo, no tiempo) | Tablas nuevas independientes |
| Prioridades del día | `pendientes` | Sin prioridad, sin orden, sin «fijado» | Columnas nuevas e interfaz |
| Sesiones, temporizador | Nada | No existe | Tablas, bloqueo único, operaciones |
| Preferencias de Focus | Nada | No existe | Tabla |
| Actividad reciente | Ver sección 8.3 | Parcial | Fuentes con marca de tiempo confiable |
| Agenda, correos, resumen del día | `agenda_hoy`, `correos_hoy`, `resumen_dia` | Existen, **sin escritor** | Decisión: quién las alimenta |
| Asistente | Interfaz «No conectado» | Sin ruta de servidor, SDK ni clave | Decisión en 3.5 |
| Frente de diseño (seis) | `frentesMap.js` agrupa los 10 slugs | Funciona solo en código | Sesiones y objetivos guardan el id de diseño |

---

## 4. Hallazgos

**H1. Execution sin fuente.** Ni `Pendientes.js` ni `Metas.js` ofrecen fecha. La 3.4 debe entregar fecha y prioridad editables antes de que Execution muestre algo. Hasta entonces el indicador dirá «Sin datos» y eso es correcto.

**H2. Historial perdido por la interfaz heredada.** `Pendientes.js` al desmarcar escribe `hecho_en: null`. `Metas.js` alterna `hecho` en hitos sin escribir fecha. Los módulos heredados no pueden tocarse. Solución propuesta: disparadores en la base que registren cada cambio de `hecho`, `hecho_en`, `fecha_limite` y `fecha` en una tabla de historial, e informen `hecho_en` en hitos.

**H3. Inserciones heredadas con columnas nuevas.** Los módulos insertan `{texto, frente, meta_id}` y `{meta_id, titulo}`. Una columna nueva solo es segura si es nullable o tiene **valor por defecto en la base**. Por eso `prioridad` debe llevar `DEFAULT 'media'`.

**H4. Salud heredado.** Salud lee `habitos` con `select *` y guarda `habito_registros.valor` como conteo o cantidad. Cualquier hábito nuevo escrito en esas tablas aparecería en Salud con semántica equivocada. Los hábitos nuevos van en **tablas separadas**.

**H5. Sin funciones ni disparadores.** La atomicidad (iniciar un temporizador, completar una sesión) necesita funciones RPC. Serían los primeros objetos de este tipo en la base, todos `SECURITY INVOKER` para respetar RLS.

**H6. La autenticación no se toca.** El middleware solo protege navegaciones. La sincronización irá directo del navegador a Supabase (como los módulos de hoy), así que no pasa por el middleware.

**H7. Tareas programadas.** `tablero-mi-dia` edita `mi-dia/tablero.html` y republica el artefacto; `recordatorio-jornada` guarda `jornada/*.md`. Ninguna escribe en Supabase. Las dos corrieron hoy. Por eso `agenda_hoy`, `correos_hoy` y `resumen_dia` seguirán vacías.

**H8. Asistente.** No hay rutas de API, ni SDK de Anthropic, ni clave en el código. El panel está en estado «No conectado» (Fase 2).

**H9. Frentes.** Los seis frentes de diseño no existen como datos. Se propone guardar su id en las tablas nuevas con una restricción `CHECK`. Los pendientes e hitos siguen usando slug y se traducen con `frentesMap.js`.

**H10. Pruebas.** Hay 330 pruebas `node:test` sobre módulos puros en `lib/domain`. La lógica nueva (máquina de estados del temporizador, reconciliación, indicadores) encaja en ese patrón. Cambiar «Mi día» por «Home» afecta a `navegacion.test.mjs` y `busqueda.test.mjs`.

---

## 5. Mi día: auditoría función por función

| Función hoy | Fuente | Estado | Destino propuesto |
|---|---|---|---|
| Fecha y título «Mi día» | Cálculo local | Funciona | Integrar: saludo contextual de Home (3.1) |
| «Hoy y mañana» | `resumen_dia` | 0 filas, sin escritor | Integrar con estado honesto; la spec prohíbe resúmenes sin datos |
| Agenda de hoy | `agenda_hoy` | 0 filas, sin escritor | Integrar como bloque compacto. Mostrar que la fuente no está conectada, no «sin eventos» |
| Correos para revisar | `correos_hoy` | 0 filas, sin escritor | **Decisión tuya.** La spec de Home no lo contempla |
| Avance por frente | `pendientes` por slug | Funciona | **Reubicar**: duplica al Panel, que ya lo muestra. Home mostrará atención por frente |
| Pendientes: crear, marcar, borrar, meta | `pendientes` | Funciona. No edita, sin fecha, prioridad ni orden | **Integrar** en Prioridades diarias (3.4) |

Para no perder nada en 3.1, propongo que Home **incorpore el componente `Pendientes` existente sin cambios** junto con los bloques de agenda, correos y resumen. En 3.4 lo reemplazará la interfaz nueva de prioridades, y solo cuando su equivalente esté verificado. El código de `Pendientes.js` no se borra.

---

## 6. Propuesta técnica de esquema (no ejecutada)

Todas las tablas nuevas: `user_id uuid default auth.uid()` con FK a `auth.users` en cascada, RLS activo y la misma política `propios` de las existentes.

### 6.1 Columnas aditivas en tablas existentes
| Tabla | Columna | Detalle |
|---|---|---|
| `pendientes` | `prioridad` | `text not null default 'media'`, check `alta/media/baja` |
| `pendientes` | `orden` | `integer null` |
| `pendientes` | `fijado_dia` | `date null`: «fijado manualmente» (D3-10); vence solo al pasar el día |
| `hitos` | `prioridad` | igual que en pendientes |
| `hitos` | `hecho_en` | `timestamptz null` |

### 6.2 Tablas nuevas
| Tabla | Propósito | Claves y restricciones |
|---|---|---|
| `temporizador_activo` | Bloqueo global: una fila por usuario | PK `user_id`; `tipo` (`focus`, `descanso`, `habito`), `ref_id`, `estado` (`corriendo`, `pausado`), `version` |
| `focus_sesiones` | Sesiones de Focus | `modalidad`, `frente_id` (check de los seis), `actividad`, `intencion`, `duracion_objetivo_s`, `estado` (`en_curso`, `pausada`, `completada`, `parcial`, `cancelada`), `iniciado_en`, `finalizado_en`, `tiempo_efectivo_s`, `puntos` (check: 1 solo si `completada`), `pendiente_id` opcional |
| `descansos` | Descansos y su decisión | `tipo` (`corto`, `largo`), `estado` (`en_curso`, `pausado`, `completado`, `omitido`), `sesion_origen_id` |
| `operaciones` | Diario de operaciones: idempotencia, secuencias, conflictos | PK `op_id` generado en el dispositivo; `dispositivo_id`, `seq`, `depende_de`, `tipo`, `objetivo_tipo`, `objetivo_id`, `payload`, `ocurrido_en_dispositivo`, `ocurrido_en_ajustado`, `recibido_en`, `resultado`, `motivo`; único `(user_id, dispositivo_id, seq)` |
| `preferencias_usuario` | Preferencias de Focus | PK `user_id`; minutos de enfoque, descanso corto y largo, ciclos, avisos, sonido. Sin fila = valores iniciales 30/5/20/4 |
| `objetivos_atencion` | Objetivos semanales | PK `(user_id, semana_inicio, frente_id)`; `puntos >= 0`; `semana_inicio` debe ser lunes |
| `habitos_config` | Identidad del hábito nuevo | `nombre`, `modo_registro` (`manual`, `temporizador`), `activo` |
| `habitos_config_versiones` | Programación con vigencia | `habito_id`, `vigente_desde`, `vigente_hasta`, `frecuencia` (`diaria`, `dias`), `dias_semana`, `objetivo_s` |
| `habito_tiempo` | Total vigente por ocurrencia | PK `(habito_id, fecha)`; `manual_s`, `temporizador_s`, `fuente` |
| `habito_segmentos` | Segmentos del temporizador por fecha local | único `(temporizador_id, fecha)`; `acreditado` (falso si la fecha no tenía ocurrencia) |
| `habito_tiempo_historial` | Historial sin borrado | valor anterior y nuevo, fuente, dispositivo, `op_id` |
| `cambios_registro` | Historial de `pendientes` e `hitos` | tabla, registro, campo, valor anterior y nuevo, instante |

Los tiempos se guardan en segundos. La interfaz muestra minutos u horas.

### 6.3 Exclusividad del temporizador
`temporizador_activo` tiene PK `user_id`: **la base impide una segunda fila**, sin depender de la interfaz.
- Iniciar = insertar la fila. Si ya existe, falla y se informa qué temporizador la ocupa.
- Pausado sigue ocupando la fila (D3-15a). Se libera al completar, cancelar u omitir.
- Los registros siguen **independientes** (Focus, hábito, descanso en tablas propias); solo comparten esta fila.
- Las transiciones atómicas van en funciones RPC `SECURITY INVOKER`: iniciar, pausar, reanudar, completar, cancelar, aplicar operaciones. Cada una se ejecuta en una transacción y es idempotente por `op_id`.

Alternativa descartada: una tabla única de temporizadores con detalle por tipo. Garantiza lo mismo pero mezcla registros que decidiste mantener independientes.

### 6.4 Puntos únicos
Un punto = una fila de `focus_sesiones` con `estado = 'completada'` y `puntos = 1`. Completar es una transición `UPDATE … WHERE estado IN ('en_curso','pausada')`: la repetición no modifica nada. Más la unicidad de `op_id`.

### 6.5 Contador de ciclos
No se guarda como contador: se **deriva**. Son las sesiones completadas posteriores al último descanso largo completado u omitido. Así el cambio de día no lo reinicia y no hay concurrencia sobre un valor.

---

## 7. Historial de fecha límite y obligaciones (D3-20, D3-22)

Los disparadores sobre `pendientes` e `hitos` registran en `cambios_registro` cada cambio de fecha y de `hecho`. Cubren también a los módulos heredados.

Modelo de cálculo propuesto: cada **fecha límite que llegó** genera una **obligación**.
- Una obligación se evalúa al terminar el día de su fecha en America/Bogota («vence hoy» sigue abierto; «vencido» desde las 00:00 del día siguiente).
- Si se cambia la fecha **antes** de que llegue, la fecha anterior no genera obligación.
- Si se cambia **después** de vencer, la obligación original permanece (D3-22).
- Un compromiso completado tarde cuenta como cumplido en el período de su obligación (D3-2), con su `hecho_en` real.

**Consecuencia que necesita tu confirmación:** un compromiso aplazado después de vencer produce dos obligaciones, una incumplida en el período original y otra en el período nuevo. Es lo que se deriva de las reglas aprobadas, pero cuenta dos veces el mismo compromiso en denominadores de períodos distintos.
Efecto que también aceptaste: Execution de un período cerrado puede cambiar si completas tarde un compromiso.

---

## 8. Cálculos, Home y actividad reciente

### 8.1 Dónde se calculan los indicadores
Propuesta: funciones **puras** en `lib/domain` (Execution, Balance, Wellbeing), alimentadas por consultas simples y cubiertas con `node:test`, igual que el resto. La base solo impone restricciones y transiciones atómicas. Con el volumen personal no se justifican vistas ni funciones de agregación. Hay que adaptar el contrato de `indicadores.js`, hoy hecho para seis áreas.

### 8.2 Estructura de Home
- `app/(app)/page.js` pasa a Home. Los bloques con datos van como componentes de servidor; el temporizador, como cliente.
- **Temporizador global:** componente nuevo montado en `AppShell`, que persiste entre rutas. Escritorio: en la barra superior. Móvil: franja compacta sobre la barra inferior, desplazando el botón flotante del asistente cuando esté visible. Accesibilidad: rol `timer`, sin anuncios por segundo.
- **Sincronización** sin Realtime (D3-8): refresco al recuperar el foco y periódico mientras haya temporizador. Propuesta de intervalo: 20 s.
- Cambio de nombre «Mi día» a «Home» en `navegacion.js` y sus pruebas, en 3.1.

### 8.3 Actividad reciente
Fuentes con marca de tiempo confiable: sesiones completadas (`finalizado_en`), pendientes completados (`hecho_en`), notas, biblioteca, jornadas, y hábitos (segmentos). Cada registro aparece una sola vez, bajo su propio tipo. Propongo **excluir finanzas** de Home. Si se agregan eventos de metas o hitos, hay que decidir su marca de tiempo (`metas` no registra el cambio de estado).

### 8.4 Asistente (3.5)
Opciones: (A) ruta de servidor con la API de Claude y clave en variable de entorno del servidor; (B) alertas por reglas, etiquetadas como tales; (C) nada hasta tener clave. A y B no excluyen entre sí. La clave es un secreto que me pasarías tú. No se decide ahora.

---

## 9. Modo sin conexión: políticas de reconciliación propuestas (D3-24)

### 9.1 Cola y orden
- La cola vive en **IndexedDB** (nativo, sin dependencia nueva), aislada por usuario. Es independiente de las cookies de sesión: sobrevive si la sesión caduca y se reanuda al volver a iniciar sesión.
- Cada operación lleva `op_id`, `dispositivo_id`, `seq` por dispositivo y `depende_de` (la última operación del mismo objetivo que ese dispositivo conocía).
- El servidor valida con la **hora ajustada**: al sincronizar, el dispositivo envía su hora actual y el servidor calcula el desfase. Si el desfase no supera una cota, ajusta las horas de las operaciones. Si la supera, usa el orden por `seq` y marca «hora ajustada». Valores propuestos: cota de 5 minutos y tolerancia de 2 minutos hacia el futuro.

### 9.2 Reglas por transición
Se ordena por hora ajustada de ocurrencia, no por llegada.

| Concurrencia | Resultado propuesto |
|---|---|
| Pausar ∥ pausar | Se fusionan; vale la pausa más temprana |
| Pausar ∥ reanudar | Orden por ocurrencia; en empate gana pausar |
| Pausar (A) ∥ completar (B) | El tiempo efectivo descuenta las pausas ocurridas antes de completar. Pausas posteriores se rechazan |
| Completar ∥ completar | Gana la más temprana. La otra queda como duplicada. Un solo punto |
| Completar ∥ cancelar | Gana la más temprana. La otra queda en historial como conflicto y se avisa |
| Estado final | Definitivo |
| Dos registros manuales de la misma ocurrencia | Vale el de ocurrencia más tardía; el otro queda en historial como sustituido. Nunca se suman |
| Registro manual ∥ segmentos de temporizador | Los segmentos anteriores al manual quedan reemplazados; los posteriores se suman encima (D3-15b) |

Toda operación rechazada o fusionada se conserva en `operaciones` con su motivo y se muestra al usuario.

### 9.3 Límites declarados
Si se borran los datos del navegador antes de sincronizar, lo pendiente se pierde (se advierte). No se inician temporizadores sin conexión (D3-13).

---

## 10. Plan, migración y pruebas

### 10.1 Ajustes al plan de subfases
| Subfase | Ajuste propuesto |
|---|---|
| 3.1 | Home visual con datos reales y estados «Sin datos». Incluye `Pendientes` heredado sin cambios. **No requiere migraciones** |
| 3.2 | Requiere esquema de sesiones, descansos, operaciones, preferencias y bloqueo. Incluye preferencias dentro de Focus (D3-11) |
| 3.3 | Hábitos nuevos con interfaz propia (entre 3.2 y 3.3) y Life Pulse. Requiere hábitos, objetivos y prioridad |
| 3.4 | Interfaz de prioridades, fechas, orden y fijado. **Es lo que alimenta Execution** |
| Objetivos semanales | Sin subfase asignada en la v1.7. Propongo la interfaz de configuración dentro de 3.3 |

### 10.2 Migraciones
Cuatro migraciones pequeñas, cada una reversible (borrar lo nuevo): (1) columnas y disparadores, (2) Focus y exclusividad, (3) operaciones y preferencias, (4) hábitos y objetivos. Se presentará el SQL completo para tu aprobación **antes** de ejecutar cada una.

### 10.3 Pruebas
- Lógica pura con `node:test`: máquina de estados, reconciliación, cálculos.
- Restricciones de la base (unicidad, exclusividad, punto único): probar dentro de una transacción que termina en `ROLLBACK`, o en una rama de Supabase (tiene costo y exige tu confirmación). **Decisión tuya.**
- Prueba de escritura real: ninguna escritura ha llegado jamás a la base. Hace falta una pasada tuya, con tu sesión y tu autorización.

---

## 11. Aprobaciones que se solicitan

Ninguna es una decisión tomada.

| ID | Qué se aprueba | Recomendación |
|---|---|---|
| P1 | Esquema aditivo de §6 (preparar el SQL; no ejecutarlo) | Aprobar |
| P2 | Exclusividad con tabla de bloqueo (§6.3) en lugar de una tabla única de temporizadores | Tabla de bloqueo |
| P3 | Una sesión cancelada se conserva con estado `cancelada`, sin puntos, en lugar de borrarse | Conservar |
| P4 | Disparadores de historial sobre `pendientes` e `hitos` (tocan tablas heredadas de forma aditiva) | Aprobar |
| P5 | `prioridad` con `DEFAULT 'media' NOT NULL` en la base | Aprobar |
| P6 | Modelo de obligaciones (§7), vencimiento al terminar el día en America/Bogota, y que el aplazamiento tras vencer cuente dos obligaciones | Confirmar el efecto de doble conteo |
| P7 | Políticas de conflicto de §9.2, cota de reloj de 5 min y tolerancia de 2 min, cola en IndexedDB | Aprobar o ajustar |
| P8 | Segmentos de días sin ocurrencia: conservarlos sin acreditar | Conservar |
| P9 | Contador de ciclos derivado (§6.5). Y si iniciar otro Focus sin responder a la sugerencia de descanso largo cuenta como «omitir» | Derivado; contar como omitir |
| P10 | Destinos de Mi día (§5), incluido dónde van los correos | Correos como bloque secundario en Home |
| P11 | Fuentes de actividad reciente (§8.3), sin finanzas | Aprobar |
| P12 | Cálculos en funciones puras de `lib/domain` (§8.1) | Aprobar |
| P13 | Estrategia de pruebas de la base (§10.3) | Transacción con `ROLLBACK` |
| P14 | Cómo se conecta el asistente en 3.5 | Decidir al llegar a 3.5 |
| P15 | Interfaz de objetivos semanales dentro de 3.3 | Aprobar |

---

## 12. Lo que esta auditoría no cubre
- No ejecuté prueba de escritura alguna: ninguna escritura a la base.
- No evalué costos de rama de Supabase ni de una clave de API de IA.
- Los valores numéricos de §9 (5 min, 2 min, 20 s) son propuestas, no mediciones.
- El tratamiento visual de meses con objetivos parciales queda para el diseño de 3.1 y 3.3.
