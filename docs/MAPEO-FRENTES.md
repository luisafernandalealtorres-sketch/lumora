# Mapeo de frentes: nueve originales más `salud`, en seis frentes de diseño

**Estado: APROBADO E IMPLEMENTADO (8 nov 2026).**
Única fuente de verdad en código: `web/lib/domain/frentesMap.js`.
Los identificadores originales (`slug`) no se modificaron.

## 1. Mapeo vigente

| `slug` (identificador original) | Frente de diseño |
|---|---|
| `tanku` | TANKU |
| `ticketcode-eventos` | TICKETCODE |
| `ticketcode-eve` | TICKETCODE |
| `personal` | Personal |
| `hogar` | Personal |
| `salud` (fila nueva) | Salud |
| `jardin` | Familia |
| `salud-abuela` | Familia |
| `hama` | Otros proyectos |
| `crochet` | Otros proyectos |

Orden de los frentes de diseño: TANKU, TICKETCODE, Personal, Salud, Familia, Otros proyectos.
Cualquier slug que no esté en la tabla aparece como **"Sin asignar"**: no se oculta ni se reasigna.

## 2. Reglas de clasificación
- **Familia:** `jardin` y `salud-abuela`. La salud de la abuela **no** va en Salud.
- **Salud:** solo tu salud personal: hábitos, medidas y objetivos de salud, y los registros con el slug `salud`.
- **Personal:** `personal` y `hogar`. **Otros proyectos:** `hama` y `crochet`.

## 3. Operación realizada en Supabase
Una sola inserción en la tabla `frentes` (`on conflict (slug) do nothing`, sin riesgo de duplicado):

| slug | nombre | grupo | orden |
|---|---|---|---|
| `salud` | Salud | personal | 10 |

- `grupo = personal`, porque el `CHECK` solo admite `ticketcode`, `tanku` y `personal`. **El `CHECK` no se modificó.**
- `orden = 10` se eligió para que quede después de los nueve existentes. Con el valor por defecto (0) habría quedado primero y habría pasado a ser el frente por defecto de varios formularios.
- `frentes` es un catálogo compartido (sin `user_id`). Solo tiene política de lectura para usuarios autenticados; sigue siendo de solo lectura para la app.
- No se modificó el esquema, las políticas RLS, ni ningún registro existente.

## 4. Integración en la interfaz
- **Selector agrupado** (`web/components/SelectorFrente.js`): los frentes aparecen agrupados bajo los seis de diseño. Los valores siguen siendo los slugs originales. Se usa en Mi día, Gastos, Metas, Finanzas (recurrentes e ingresos) y Cerebro.
- **Filtro de Cerebro:** acepta un slug individual o un grupo completo ("Todo Familia", "Todo TICKETCODE", "Todo Personal", "Todo Otros proyectos").
- No se cambió ninguna ruta, módulo ni lógica de negocio.

## 5. Cómo deshacerlo
Editar `FRENTES_DISENO` en `frentesMap.js` (o volver al commit anterior). Nada en la base depende de la agrupación.

## 6. Verificaciones ejecutadas

| Verificación | Resultado |
|---|---|
| Los nueve slugs originales idénticos a antes (slug, nombre, grupo, orden) | 9 de 9 |
| Una sola fila con slug `salud` | 1 |
| Total de frentes | 10 |
| `CHECK` de `grupo` y política RLS de `frentes` sin cambios | Sin cambios |
| Claves foráneas hacia `frentes` | 6, sin cambios |
| Filas en las 18 tablas de datos / usuarios | 0 / 1 |
| La agrupación devuelve los seis frentes esperados | Sí |
| Cada uno de los 10 slugs queda asignado al frente aprobado | Sí |
| Filtros con varios slugs (Familia, TICKETCODE) | Sí |
| Salud no incluye `salud-abuela` | Sí |
| Registros con slug desconocido o nulo no desaparecen | Sí |
| El filtro "todos" no pierde registros; los registros no se mutan | Sí |
| Pruebas del módulo | 29 de 29 |
| Filtros en pantalla con sesión real (Familia 2, Salud 1, Personal 1, todos 4 de 4) | Sí |
| Compilación | Sin errores |
