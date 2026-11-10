# Fase 3: análisis corregido de la etapa 0 (v1.10)

Fecha: 9 nov 2026. Corrige la etapa 0 de `docs/MIGRACIONES-FASE-3-v1.9.md`. El SQL vigente está en `docs/MIGRACIONES-FASE-3-v1.10.md` (etapa 0) y en `docs/sql/v1.10/etapa0_verificacion_solo_lectura.sql`.

> **Nada de esto se ha ejecutado**: ni en Supabase ni en local. Es el diseño de las comprobaciones para tu revisión.
> Las consultas son de solo lectura; la comprobación de `auth.uid()` usa una transacción de solo lectura que termina en `ROLLBACK` y una identidad **ficticia**, sin datos de producción.

---

## 1. Por qué el criterio 8 no estaba demostrado

El criterio 8 decía: «`auth.uid()` devuelve el `sub` del JWT». Se pretendía comprobar con `pg_get_functiondef('auth.uid()')`. Eso **no demuestra el comportamiento**:

| Limitación de leer la definición | Qué podría ocurrir sin que se note |
|---|---|
| Muestra el código, no el resultado | La función podría leer un claim distinto del que inyecta PostgREST, o fallar con ciertos formatos |
| No prueba el rol con el que se ejecuta | Un cambio de rol (`set role`) o los permisos del esquema `auth` podrían impedir llamarla desde `authenticated` |
| No distingue el contexto administrativo del autenticado | En el editor SQL (`postgres`) `auth.uid()` es NULL; eso **no** significa que funcione con una identidad |
| No prueba los casos límite | Claims vacíos, sin `sub` o con formato antiguo |
| Todo el diseño depende de ella | RLS, las funciones `SECURITY DEFINER`, el historial y T-7 usan `auth.uid()` |

## 2. Diseño de la comprobación de comportamiento (consulta 0.9)

### 2.1 Principios
1. **Identidad ficticia:** un UUID de prueba que no corresponde a ningún usuario (`00000000-0000-4000-8000-0000000000f1`). No se lee ninguna tabla de la aplicación.
2. **Solo lectura y reversible:** `BEGIN READ ONLY … ROLLBACK`. Los ajustes se hacen con `set_config(…, true)` (locales a la transacción) para que **ninguna identidad sobreviva** a la prueba.
3. **No confundir contextos:** cada caso imprime `current_user` (rol efectivo), `session_user` (quien abrió la sesión, administrativo) y `auth.uid()`. Así se ve que el rol cambió pero la sesión sigue siendo administrativa.
4. **Se prueban los dos caminos de entrada** de `auth.uid()`: el JSON `request.jwt.claims` (el que usa PostgREST) y el claim suelto `request.jwt.claim.sub` (formato antiguo).

### 2.2 Casos y resultados esperados

| Caso | Preparación | Rol | Esperado en `auth.uid()` | Qué demuestra |
|---|---|---|---|---|
| **a** | `claims = {"sub":"…f1","role":"authenticated"}` | `authenticated` | **`…f1`** | La identidad JWT llega a `auth.uid()` |
| **b** | `claims = ''` | `authenticated` | **NULL** | Sin identidad no inventa un usuario |
| **c** | `claims = {"role":"anon"}` | `anon` | **NULL** | `anon` no tiene identidad |
| **d** | `claims = ''` y `claim.sub = '…f2'` | `authenticated` | `…f2` (informativo) | Formato antiguo; si da NULL en esa versión, no es un fallo |
| **e** | sin claims, sin cambio de rol | el administrativo | **NULL** | El contexto administrativo **no** tiene identidad (no confundir con un fallo) |
| **f** | tras el `ROLLBACK` | el administrativo | **NULL** y claims vacíos | Nada queda en la sesión |

**Criterio 8 aprobado** si a = el UUID de prueba y b, c, e y f = NULL. El caso d es informativo.
**Criterio 8 fallido** si cualquiera de b, c, e o f devuelve un valor no nulo (la función inventa identidad) o si a devuelve NULL (no recibe la identidad). En ese caso **no se ejecuta ninguna etapa**.

### 2.3 SQL (igual al de la etapa 0, consulta 0.9)
```sql
begin read only;

-- a) identidad JWT de prueba, rol authenticated
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}', true);
set local role authenticated;
select 'a_identidad_jwt' as caso, current_user as rol_efectivo, session_user as usuario_de_sesion, auth.uid() as uid;
reset role;

-- b) claims vacíos
select set_config('request.jwt.claims', '', true);
set local role authenticated;
select 'b_sin_claims' as caso, current_user, session_user, auth.uid();
reset role;

-- c) anon, claims sin sub
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select 'c_anon_sin_sub' as caso, current_user, session_user, auth.uid();
reset role;

-- d) formato antiguo (informativo)
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000f2', true);
set local role authenticated;
select 'd_claim_sub_suelto' as caso, current_user, session_user, auth.uid();
reset role;

-- e) contexto administrativo, sin identidad
select set_config('request.jwt.claim.sub', '', true);
select 'e_contexto_administrativo' as caso, current_user, session_user, auth.uid();

rollback;

-- f) después del rollback no debe quedar identidad en la sesión
select 'f_tras_rollback' as caso, nullif(current_setting('request.jwt.claims', true), '') as claims, auth.uid() as uid;
```

### 2.4 Qué NO demuestra (límites declarados)
| Límite | Cómo se cubriría |
|---|---|
| Simula los claims; **no prueba que PostgREST los inyecte** con ese formato ni que verifique el JWT | Prueba de extremo a extremo posterior (§4) |
| Usa el rol administrativo para cambiar de rol: eso exige pertenencia a `authenticated` y `anon` | Es parte del criterio 10 |
| No prueba funciones definer que alteren los claims | Revisión de código: ninguna función de la Fase 3 los modifica |
| Un `auth.uid()` distinto del estándar podría comportarse de otra forma en otras versiones | Repetir la etapa 0 tras cambios de versión de Supabase |

## 3. Quién puede ejecutar cada consulta

Se distinguen tres perfiles: **rol propietario/administrativo** (en Supabase, normalmente `postgres` en el editor SQL o la CLI), **rol de base de datos sin privilegios** (por ejemplo `authenticated` elegido en el selector de rol) y **usuario de la aplicación** (solo usa la API; no ejecuta SQL).

| Consulta | Lee | Rol sin privilegios | Requiere administrativo | Nota |
|---|---|---|---|---|
| 0.0 contexto | `pg_roles`, `current_user` | Sí | No | |
| 0.1 atributos de roles | `pg_roles` | Sí (catálogo legible) | No | `rolbypassrls` es visible para todos |
| 0.2 propietarios y RLS forzado | `pg_namespace`, `pg_class` | Sí | No | |
| 0.3 pertenencia de roles | `pg_auth_members` | Sí | No | Verificar en la versión real |
| 0.4 privilegios por defecto y ACL | `pg_default_acl`, `pg_class.relacl` | Sí | No | |
| 0.5 funciones y disparadores | `pg_proc`, `pg_trigger` | Sí | No | |
| 0.6 colisiones de nombres | `pg_class`, `pg_attribute` | Sí | No | **Se cambió** de `information_schema`, que oculta lo que el rol no puede ver y daría falsos negativos |
| 0.7 versión, zona horaria, extensiones | `version()`, `pg_timezone_names`, `pg_extension` | Sí | No | |
| 0.7b definición de `auth.uid()` | `pg_get_functiondef` | Puede fallar | **Sí, conviene** | Resolver `auth.uid()` exige `USAGE` sobre el esquema `auth`; solo informativa |
| 0.8 conteo de filas | `public.pendientes`, `public.hitos` | **No es fiable** | **Sí** (con `BYPASSRLS`) | Con RLS un rol sin identidad ve **0 filas** y daría un «0» engañoso |
| 0.9 comportamiento de `auth.uid()` | `set_config`, `set local role` | **No** | **Sí** | Cambiar a `authenticated` o `anon` exige pertenencia a esos roles |
| 0.10 puede cambiar de rol | `pg_has_role` | Sí | No | Resultado informativo del rol que consulta |
| 0.11 atributos de `auth.uid()` | `pg_proc` | Sí | No | |

**Recomendación:** ejecutarlo todo con el rol que ejecutará las migraciones. Si se desea, repetir 0.1 a 0.7 con un rol sin privilegios solo para ver qué observaría.

## 4. Comprobación de extremo a extremo (posterior, con tu autorización)

La consulta 0.9 prueba la función en la base de datos. Falta probar que el camino real (aplicación → PostgREST → JWT) llega a `auth.uid()`. Opciones, de menor a mayor impacto:

| Opción | Qué hace | Datos de producción |
|---|---|---|
| **E2E-1** | Las pruebas con transacciones `ROLLBACK` de P13 reproducen la misma simulación de claims con las tablas reales | Se escribe y se revierte; **no persiste nada** |
| **E2E-2** | Tras la etapa 1, con una sesión de la aplicación, comprobar que una lectura de una tabla con RLS devuelve solo las filas del usuario (hoy 0) y que una inserción heredada pasa la política `auth.uid() = user_id` | **Toca datos del usuario real** (una fila); requiere autorización aparte |
| **E2E-3** | Un usuario de prueba creado para ese fin | Crear una cuenta: requiere autorización explícita |

No se propone ninguna sin tu autorización.

## 5. Criterios corregidos de la etapa 0

| # | Criterio | Cómo se comprueba | Si falla |
|---|---|---|---|
| 1 | El rol que ejecutará las migraciones omite RLS: `rolbypassrls = true`, **o** es propietario de las tablas y estas **no** tienen RLS forzado | 0.0, 0.2 | No ejecutar |
| 2 | `authenticated` y `anon` no son superusuario ni omiten RLS | 0.1 | No ejecutar |
| 3 | El propietario de `public` y de las tablas heredadas es el rol que ejecutará las migraciones | 0.0, 0.2 | Revisar quién será propietario de las funciones |
| 4 | Los privilegios por defecto son los esperados (acceso para `anon` y `authenticated`, compensado por las `REVOKE`) | 0.4 | Ajustar las `REVOKE` |
| 5 | Ningún objeto con los nombres de la Fase 3; sin funciones ni disparadores en `public`; solo existe `pendientes.hecho_en` entre las columnas nuevas | 0.5, 0.6 | Investigar |
| 6 | `America/Bogota` existe | 0.7 | No ejecutar etapas 2 y 3 |
| 7 | Versión compatible (15 o superior; se validó en 16) | 0.7 | Repetir la validación local con esa versión |
| 8 | **`auth.uid()` se comporta como se espera:** a = UUID de prueba; b, c, e y f = NULL | **0.9** (y 0.11 informativa) | No ejecutar |
| 9 | Número de filas de `pendientes` e `hitos` conocido (consulta como propietario) | 0.8 | Decidir sobre el relleno inicial |
| 10 | El rol que ejecuta puede cambiar a `authenticated` y `anon` (necesario para 0.9 y para P13) | 0.10 | No se pueden hacer las pruebas con `ROLLBACK` |
| 11 | Las tablas heredadas **no** tienen RLS forzado | 0.2 | Revisar: el disparador definer de T-8b fallaría (ver `docs/MATRIZ-PRUEBAS-T7-T8B-FASE-3-v1.10.md` TD-07) |

## 6. Cambios respecto de la v1.9 en esta etapa
- El criterio 8 pasa de «leer la definición» a «comprobar el comportamiento» (0.9).
- Nuevo contexto de ejecución (0.0) y nueva comprobación de pertenencia a roles (0.10).
- 0.6 usa catálogos y no `information_schema`.
- 0.8 solo es fiable con el rol que omite RLS.
- Se añade la comprobación de RLS forzado (criterio 11), nacida del análisis del disparador definer.
- Se añade la tabla de «quién puede ejecutar cada consulta».
