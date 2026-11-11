# Registro de ejecución — Fase 3 v1.11 en Supabase

Proyecto `kztoazvjfwzndeubghey`. Cada etapa se aplicó con autorización expresa, en una sola llamada `execute_sql` con el archivo sin modificar.

| Etapa | Archivo | Estado |
|---|---|---|
| 0 | `etapa0_verificacion_solo_lectura.sql` | Ejecutada (solo lectura) |
| 1 | `etapa1_aplicar.sql` | Aplicada y verificada |
| 2 | `etapa2_aplicar.sql` | Aplicada y verificada |
| 3 | `etapa3_aplicar.sql` (SHA-256 `e57fa48238ac9c49f3bcfa4f243d1d521d79ea512875508a8281f975b72d5da3`, 31 806 bytes, 606 líneas) | Aplicada el 2026-11-11; respuesta `[]`, sin errores |
| 4 (T-9, cola sin conexión) | — | No implementada |

## Verificación de la etapa 3 (2026-11-11)

- Tablas: las 7 existen, con RLS activo (7/7). `habitos` y `habito_registros` heredadas intactas (0 filas).
- Funciones: 13; políticas: 8; disparadores: 2. Huella md5 de las funciones: `055f1cbdc6c427b9fb80ba4eef81ee9c`.
- Las 9 RPC de hábito: `authenticated` ejecuta, `anon` no. Funciones internas no expuestas.
- `authenticated`: solo SELECT en las 6 tablas de hábitos; UPDATE solo en `nombre` y `modo_registro` de `habitos_config`; CRUD en `objetivos_atencion`. `anon`: sin privilegios.
- Tablas nuevas vacías; `temporizador_activo` en 0.
- Advisors de seguridad: sin hallazgos nuevos; persisten los avisos intencionales de RPC ejecutables por `authenticated` y el de contraseñas filtradas.
- NOT TESTED: raíz OpenAPI de PostgREST (requiere credencial de servicio); pruebas de la app en el navegador tras la aplicación; comparación con la referencia local (solo se registró la huella).

## Reversiones

Disponibles y validadas en PostgreSQL 16.15 y 17.11 (`docs/validacion-local-v1.11-pg17`). No se ejecutó ninguna en producción. Revertir la etapa 3 antes que la 2.

## Pruebas de escritura en la app (2026-11-11, datos «PRUEBA»)

- Crear hábito (temporizador, diario, 60 s): fila en `habitos_config` y su versión; 1 operación registrada.
- Iniciar y finalizar temporizador: el bloqueo de `temporizador_activo` se creó y se liberó; 68 s acreditados en `habito_segmentos` y `habito_tiempo`; el temporizador siguió corriendo tras recargar la página.
- Guardar objetivo (TANKU, 3 puntos): persistió tras recargar; el balance se calcula contra el objetivo prorrateado (1,3 de 3 a mitad de semana).
- Life Pulse: Wellbeing 100 % (1 min de 1 min, con tope), Balance 0 % (sin sesiones de Focus completadas), Execution «Sin datos».
- Cola sin conexión (etapa 4, cliente): registro manual hecho sin conexión → guardado en IndexedDB (`cola-<usuario>`), el servidor sin cambios; tras recargar y volver la conexión se reenvió con la misma `op_id` (120 s manual, 1 operación, historial con 2 entradas).

## Etapa 4 — alcance implementado

Solo cliente (`web/lib/cola/cola.js`, `HabitosPanel`): cola IndexedDB aislada por usuario para los registros manuales de hábitos (D3-13); envío en orden de `seq` con la misma `op_id`; fallos de red o sesión conservan todo; los rechazos del servidor se conservan y se muestran hasta que el usuario los marca. **No** implementa T-9 (umbrales de reloj), la resolución de concurrencia entre dispositivos ni `operaciones_aplicar` (sin cambios en Supabase): T-9 sigue pendiente.
