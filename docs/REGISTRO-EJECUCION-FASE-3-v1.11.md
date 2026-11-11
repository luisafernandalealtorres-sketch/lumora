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
