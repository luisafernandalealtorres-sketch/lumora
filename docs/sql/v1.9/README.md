# Scripts SQL de la Fase 3 (v1.9)

Extraídos de `docs/MIGRACIONES-FASE-3-v1.9.md`, que es la fuente. **Ninguno se ha ejecutado.**

| Archivo | Contenido |
|---|---|
| `etapa0_verificacion_solo_lectura.sql` | Consultas de solo lectura sobre roles y permisos (condición de T-1) |
| `etapa1_aplicar.sql`, `etapa1_reversion_suave.sql`, `etapa1_reversion_dura.sql`, `etapa1_verificacion_solo_lectura.sql` | Columnas aditivas, historial de solo lectura para el cliente (T-8b) y disparadores |
| `etapa2_*.sql` | Preferencias, bloqueo global, Focus, descansos, operaciones y RPC |
| `etapa3_*.sql` | Objetivos (con el disparador de T-7), hábitos nuevos y RPC |

- **Etapa 4** (`operaciones_aplicar`) **no existe**: depende de T-9 (pendiente).
- Estado de validación: la v1.8 del SQL se validó en PostgreSQL local; T-7 y T-8b de la v1.9 **no se han revalidado**. Nada se ha probado en Supabase.
- Las versiones anteriores del SQL siguen en `docs/MIGRACIONES-FASE-3-v1.8.md`.
- Si un script difiere del documento, manda el documento.
