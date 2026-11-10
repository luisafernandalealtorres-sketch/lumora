# Fase 3: propuesta para que los documentos v1.8 sean la única fuente vigente

Fecha: 9 nov 2026.
**Es una propuesta. No se movió, renombró, reemplazó ni borró ningún archivo.** Cada paso requiere tu aprobación expresa.

---

> **Nota (9 nov, v1.9):** la versión vigente es ahora la **v1.9** (`*-FASE-3-v1.9.md`, `docs/sql/v1.9/` y `RESUMEN-CAMBIOS-FASE-3-v1.9.md`); la v1.8 queda como versión anterior conservada. Si se aprueba esta propuesta, los nombres de destino se aplicarían a la v1.9 y la v1.8 iría a `archivo/`. Nada de esto se ha ejecutado.

## 1. Situación actual

| Archivo | Contenido | Estado real | ¿En git? |
|---|---|---|---|
| `ESPECIFICACION-FASE-3.md` | Especificación **v1.2** | **Obsoleta** | No |
| `DECISIONES-FASE-3.md` | Registro de decisiones **v1.2** | **Obsoleto** | No |
| `REVISION-CONSISTENCIA-FASE-3.md` | Revisión de consistencia **v1.2** | **Obsoleta** | No |
| `REVISION-PREVIA-FASE-3.md` | Revisión previa a la 3.0 (con notas hasta v1.1) | Histórica | No |
| `AUDITORIA-3.0.md` | Informe de la subfase 3.0 | Vigente como informe histórico | No |
| `ESPECIFICACION-FASE-3-v1.8.md` | Especificación v1.8 | **Vigente** | No |
| `DECISIONES-FASE-3-v1.8.md` | Registro v1.8 | **Vigente** | No |
| `REVISION-CONSISTENCIA-FASE-3-v1.8.md` | Consistencia v1.8 | **Vigente** | No |
| `DISENO-TECNICO-FASE-3-v1.8.md` | Diseño técnico | **Vigente** | No |
| `MIGRACIONES-FASE-3-v1.8.md` | SQL por etapas (validado en local, no en Supabase) | **Vigente** | No |
| `PRUEBAS-FASE-3-v1.8.md` | Escenarios de prueba | **Vigente** | No |
| `REVISION-DECISIONES-T-FASE-3-v1.8.md` | Matriz de T-1 a T-13 | **Vigente** | No |
| `VALIDACION-LOCAL-FASE-3-v1.8.md` y `validacion-local/` | Resultados y scripts de la validación | **Vigente** | No |
| Versiones v1.3 a v1.7 | Iteraciones intermedias | Superadas; **solo existen en tu carpeta Descargas** | Fuera del repo |

**Dato que condiciona la propuesta:** ningún documento de la Fase 3 está en git. Si se sobrescribe o borra algo, **no hay forma de recuperarlo**.

## 2. Problema

Los archivos sin sufijo siguen presentando la v1.2 como si fuera la especificación actual (decisiones pendientes que hoy están cerradas, fórmulas de Wellbeing superadas, etc.). Alguien que abra `ESPECIFICACION-FASE-3.md` creería estar leyendo la versión vigente.

## 3. Opciones

| Opción | Qué hace | Ventajas | Desventajas |
|---|---|---|---|
| **A (recomendada)** | Carpeta `docs/fase-3/` con los nombres sin versión para lo vigente y `docs/fase-3/archivo/` para lo obsoleto, con aviso en cada archivo archivado | Un solo lugar y un nombre canónico por documento. Nada se destruye. La versión queda dentro del encabezado | Hay que actualizar las referencias cruzadas entre documentos |
| B | Dejar todo en `docs/` con el sufijo `-v1.8` y agregar un aviso de obsolescencia a los archivos v1.2 | Menos cambios; sin renombrar | Los nombres sin sufijo seguirían apuntando a lo obsoleto. Quedan 20 archivos mezclados en `docs/` |
| C | Sobrescribir los v1.2 con el contenido v1.8 | Los nombres actuales quedarían vigentes | **Destructivo:** se pierde la v1.2 sin recuperación (no está en git). No se recomienda |

## 4. Estructura propuesta (opción A)

```
docs/
  fase-3/
    INDICE.md                       (nuevo: lista de documentos vigentes y su orden de lectura)
    ESPECIFICACION.md               (v1.8)
    DECISIONES.md                   (v1.8)
    REVISION-CONSISTENCIA.md        (v1.8)
    DISENO-TECNICO.md               (v1.8)
    MIGRACIONES.md                  (v1.8)
    PRUEBAS.md                      (v1.8)
    REVISION-DECISIONES-T.md        (v1.8)
    VALIDACION-LOCAL.md             (v1.8)
    AUDITORIA-3.0.md                (informe histórico de la subfase 3.0)
    validacion-local/               (scripts)
    archivo/
      ESPECIFICACION-v1.2-OBSOLETA.md
      DECISIONES-v1.2-OBSOLETO.md
      REVISION-CONSISTENCIA-v1.2-OBSOLETA.md
      REVISION-PREVIA-OBSOLETA.md
  (sin cambios: documentos de las fases 0 a 2 y docs/design/)
```

### Correspondencia
| Hoy | Destino |
|---|---|
| `ESPECIFICACION-FASE-3-v1.8.md` | `fase-3/ESPECIFICACION.md` |
| `DECISIONES-FASE-3-v1.8.md` | `fase-3/DECISIONES.md` |
| `REVISION-CONSISTENCIA-FASE-3-v1.8.md` | `fase-3/REVISION-CONSISTENCIA.md` |
| `DISENO-TECNICO-FASE-3-v1.8.md` | `fase-3/DISENO-TECNICO.md` |
| `MIGRACIONES-FASE-3-v1.8.md` | `fase-3/MIGRACIONES.md` |
| `PRUEBAS-FASE-3-v1.8.md` | `fase-3/PRUEBAS.md` |
| `REVISION-DECISIONES-T-FASE-3-v1.8.md` | `fase-3/REVISION-DECISIONES-T.md` |
| `VALIDACION-LOCAL-FASE-3-v1.8.md` | `fase-3/VALIDACION-LOCAL.md` |
| `AUDITORIA-3.0.md` | `fase-3/AUDITORIA-3.0.md` |
| `validacion-local/` | `fase-3/validacion-local/` |
| `ESPECIFICACION-FASE-3.md` (v1.2) | `fase-3/archivo/ESPECIFICACION-v1.2-OBSOLETA.md` |
| `DECISIONES-FASE-3.md` (v1.2) | `fase-3/archivo/DECISIONES-v1.2-OBSOLETO.md` |
| `REVISION-CONSISTENCIA-FASE-3.md` (v1.2) | `fase-3/archivo/REVISION-CONSISTENCIA-v1.2-OBSOLETA.md` |
| `REVISION-PREVIA-FASE-3.md` | `fase-3/archivo/REVISION-PREVIA-OBSOLETA.md` |

## 5. Aviso de obsolescencia (se agregaría al principio de cada archivo archivado)

```
> **DOCUMENTO OBSOLETO. No usar como referencia.**
> Fue reemplazado por la versión 1.8 de la especificación de la Fase 3 (`docs/fase-3/`).
> Se conserva solo como historial. Las decisiones, fórmulas y pendientes que contiene pueden estar superadas.
```

## 6. Pasos propuestos (cada uno requiere tu aprobación)

| # | Paso | Reversible |
|---|---|---|
| 0 | **Respaldo previo:** un commit con todos los documentos tal como están hoy (v1.2 incluida), para tener historial | Sí |
| 1 | Crear `docs/fase-3/` y `docs/fase-3/archivo/` | Sí |
| 2 | **Mover** (no copiar ni borrar) los cuatro archivos obsoletos a `archivo/` con su nuevo nombre | Sí, con git |
| 3 | Agregar el aviso de obsolescencia a esos cuatro archivos | Sí |
| 4 | Mover y renombrar los documentos vigentes según la correspondencia | Sí |
| 5 | Actualizar las referencias cruzadas entre documentos (hoy citan nombres con `-v1.8`) y las rutas del README de `validacion-local/` | Sí |
| 6 | Crear `fase-3/INDICE.md` con el orden de lectura, el estado de cada documento y la regla de vigencia | Sí |
| 7 | Verificar con una búsqueda que no queden referencias rotas ni a archivos obsoletos | — |
| 8 | Commit del reordenamiento (solo si lo autorizas) | Sí |

## 7. Reglas de vigencia propuestas

1. La única fuente vigente de la Fase 3 es `docs/fase-3/` (salvo `archivo/`).
2. La versión de cada documento va en su encabezado, no en el nombre. Los cambios de versión se anotan en el propio documento.
3. Una nueva versión reemplaza el archivo vigente **después** de commitear la anterior, así el historial queda en git.
4. Lo archivado no se edita.
5. Las versiones v1.3 a v1.7 solo existen en tu carpeta Descargas y no son referencia. Si quieres conservarlas, se pueden copiar a `archivo/` con su aviso (no se hace por defecto).

## 8. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Perder la v1.2 | Mover en lugar de borrar y, antes, un commit de respaldo (paso 0) |
| Referencias cruzadas rotas tras renombrar | Paso 5 y verificación del paso 7 |
| Mezclar el reordenamiento con otros cambios | Commit propio, sin tocar `mi-dia/tablero.html` ni `jornada/plan-semana-2026-11-08.md`, que son de tus tareas programadas |
| Confusión con documentos de otras fases | No se tocan |

## 9. Recomendación

Opción A, ejecutada en el orden de §6, empezando por el commit de respaldo. Si prefieres lo mínimo, la opción B solo agrega el aviso a los cuatro archivos v1.2. No recomiendo la opción C.
