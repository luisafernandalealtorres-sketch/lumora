# Fase 3: revisión de consistencia (fórmulas, comportamiento y esquema)

Fecha: 9 nov 2026. Corresponde a la especificación v1.2.
Método: lectura de la especificación y del esquema `public` de Supabase. **Sin cambios de código, base de datos, RLS, autenticación ni configuración.** Todas las tablas de datos tienen 0 filas.

## 1. Fórmulas frente al esquema actual

| Indicador | Datos que necesita | Existe hoy | Brecha |
|---|---|---|---|
| **Execution, T** | Pendiente con fecha límite, completado, prioridad | `pendientes.fecha_limite` (opcional), `hecho`, `hecho_en`, `frente`, `meta_id` | **Sin prioridad.** Se necesita una columna (aprobación de esquema). Sin fecha, queda excluido (decisión A2) |
| **Execution, M** | Hito con fecha, completado, prioridad propia | `hitos.fecha` (opcional), `hecho`, `meta_id` | **Sin prioridad** (decisión B4). **Sin `hecho_en`**: no se sabe cuándo se completó, lo que afecta a D3-2 y a actividad reciente. El frente sale de `metas.frente` |
| **Balance** | Puntos por sesión completada y frente; objetivos semanales por frente | Nada | Tablas de sesiones y de objetivos. Frente por id de diseño (los seis) |
| **Wellbeing** | Frecuencia por días, duración objetivo, vigencia, tiempo vigente por ocurrencia | `habitos` (`tipo`, `unidad`, `objetivo_dia`, `veces_semana`, `activo`), `habito_registros` (`fecha`, `valor`) | Falta frecuencia por días, duración con unidad, modo de registro, vigencia, fuente e historial de cambios |

### 1.1 Comprobaciones aritméticas de las fórmulas
- **W:** `100 × Σ min(real, objetivo) / Σ objetivo`. Equivale a la fórmula del usuario con el tope aplicado a cada ocurrencia. Si `Σ objetivo = 0` no hay ocurrencias elegibles y se muestra «Sin datos». No hay división por cero.
- **W, unidades:** minutos y horas deben convertirse a una misma unidad antes de sumar.
- **W, ocurrencia sin registro:** cuenta 0 realizado. Es cero real, no «Sin datos».
- **B:** frentes con objetivo 0 se excluyen. Si `Σ g = 0`, «Sin datos».
- **E:** si solo existe T o solo M, es parcial. Los pendientes e hitos sin fecha quedan fuera (hitos sin fecha: D3-1).
- **Períodos:** T, M y W se recalculan desde los registros, no promediando días. Semana de lunes a domingo en America/Bogota.

## 2. Comportamiento funcional: puntos que se contradicen o quedan sin definir

| # | Hallazgo | Consecuencia | Estado |
|---|---|---|---|
| F1 | `hitos` no tiene `hecho_en` | No se puede saber si un hito se completó antes o después de su fecha | Condiciona D3-2. Requiere columna con aprobación |
| F2 | Los módulos heredados crean pendientes e hitos sin pedir prioridad | Habría registros sin prioridad y sin peso | **Nuevo: D3-14** |
| F3 | Un temporizador en pausa, ¿ocupa el lugar del temporizador único? Si no, se podrían tener uno en pausa y otro corriendo, y reanudar el primero rompería la regla | La regla de «un solo activo» queda ambigua | **Nuevo: D3-15(a)** |
| F4 | Los descansos son un temporizador | Un descanso no debe permitir iniciar un hábito en paralelo | Se propone que el descanso pertenezca al temporizador de Focus. Se confirma con D3-15(a) |
| F5 | La v1.0 habla de sesión «parcial» y de «cancelar», sin distinguirlas | No se sabe cuándo se guarda una sesión y cuándo se descarta | **Nuevo: D3-16** |
| F6 | El modo sin conexión cubre cambios de sesiones activas, pero no iniciar temporizadores ni registros manuales de hábitos | Iniciar sin conexión no puede garantizar el temporizador único | **Nuevo: D3-13** |
| F7 | Un temporizador de hábito que cruza medianoche | Ocurrencia de dos fechas posibles | **Nuevo: D3-15(c)** |
| F8 | Si tras un registro manual se usa el temporizador | Reemplazar y acumular pueden chocar | **Nuevo: D3-15(b)** |
| F9 | Hora del dispositivo frente a hora del servidor | Reloj desajustado altera el tiempo restante | Resuelto en §4.9 de la v1.2: validación contra recepción y «hora ajustada». La tolerancia se define en 3.0 |
| F10 | Ocurrencias antes de la vigencia de un hábito | Penalizarían hábitos recién creados | Resuelto: no existen ocurrencias anteriores a la vigencia |
| F11 | Realtime pendiente (D3-8) y sincronización sin conexión | Podrían parecer dependientes | No lo son: la cola se envía al reconectar o recuperar el foco, sin Realtime |
| F12 | Frente de una sesión: id de diseño (seis) o slug (diez) | Los pendientes usan slug; Balance usa los seis | Se propone guardar el id de diseño en sesiones y objetivos; la 3.0 lo confirma. Un slug fuera del mapa queda «Sin asignar» y no entra al Balance |
| F13 | Cambiar «Mi día» por «Home» en el shell | Toca `navegacion.js` y sus pruebas (Fase 2), y el elemento de la barra inferior móvil | Derivado de B5; se ejecuta en 3.1, sin tocar código de Mi día |
| F14 | Hora de dispositivo de las operaciones pendientes frente a la regla «un solo punto por sesión» | Dos dispositivos podrían completar la misma sesión | Resuelto: la restricción de unicidad de punto y la regla de estado final definitivo |

## 3. Restricciones que deben vivir en la base de datos
La interfaz sola no basta. Para cumplir los criterios de aceptación, estas garantías se proponen como restricciones de esquema (con aprobación, en 3.0):
1. Un solo temporizador activo por usuario, entre Focus y hábitos.
2. Un punto de atención por sesión completada.
3. Un identificador único por operación (idempotencia).
4. Un tiempo vigente por ocurrencia (hábito + fecha).
5. Historial de modificaciones sin borrado.
6. Seguir el patrón RLS existente en cada tabla nueva.

## 4. Resumen
- Las fórmulas son coherentes entre sí y con las decisiones aprobadas.
- El esquema actual no puede sostener Balance, Wellbeing, Focus Mode ni la prioridad de hitos y pendientes: hacen falta cambios de esquema, todos sujetos a tu aprobación.
- Quedan cuatro puntos nuevos para decidir (D3-13 a D3-16), además de los ocho pendientes que ya tenías.
