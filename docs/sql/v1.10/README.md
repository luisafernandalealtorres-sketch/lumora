# Scripts SQL de la Fase 3 (v1.10)

Extraídos de `docs/MIGRACIONES-FASE-3-v1.10.md`, que es la fuente. **Ninguno se ha ejecutado.**

- **Cambia respecto de `docs/sql/v1.9/`:** `etapa0_verificacion_solo_lectura.sql` (rediseñada: comprueba el comportamiento de `auth.uid()` con una identidad JWT ficticia y añade el contexto de ejecución, RLS forzado y pertenencia de roles) y `etapa1_verificacion_solo_lectura.sql` (inventario de privilegios y propietario del disparador definer).
- **No cambia:** el SQL de aplicación y de reversión de las etapas 1 a 3. La lógica de T-7 y de T-8b no se modificó; T-7b y T-8c son propuestas sin aplicar.
- `etapa0` incluye una transacción de solo lectura con `ROLLBACK` que cambia de rol: **solo la puede ejecutar un rol administrativo**.
- Etapa 4 (`operaciones_aplicar`): no existe; depende de T-9 (pendiente).
- Si un script difiere del documento, manda el documento.
