# Pruebas funcionales controladas (CRUD)

Fecha: 8 nov 2026. Registros de prueba marcados `[PRUEBA-CRUD]`. **Todos eliminados**; al final hay 0 filas en las 18 tablas de datos, 9 frentes y 1 usuario (sin cambios).
No se modificó esquema, RLS ni autenticación.

## A. Nivel base de datos (como tu usuario, con los datos que envía la app)

| Prueba | Resultado |
|---|---|
| Crear y modificar en las 18 tablas de datos | Pasó |
| `user_id` asignado a tu usuario en cada registro | Pasó |
| `upsert` de presupuesto, jornada y hábito no duplican | Pasó |
| Guardar el plan semanal conserva el relato del día | Pasó |
| Otro usuario no ve, modifica, borra ni inserta a tu nombre | Pasó |
| Usuario anónimo no ve nada | Pasó |
| Borrar meta: elimina hitos y deja el pendiente con `meta_id` nulo | Pasó |
| Borrar hábito: elimina sus registros | Pasó |

## B. Nivel interfaz (sesión real en el navegador integrado)

| Módulo | Acción probada | Verificación | Resultado |
|---|---|---|---|
| Mi día | Crear pendiente | Aparece y el avance por frente pasa a "0 de 1" | Pasó |
| Mi día | Marcar hecho | En la base: `hecho = true`, `hecho_en` con fecha, a tu nombre | Pasó |
| Mi día | Crear pendiente vinculado a una meta | En la base: `meta_id` apunta a la meta | Pasó |
| Gastos | Crear con valor "$ 12.345" | Se guardó 12345; totales y categoría correctos | Pasó |
| Gastos | Borrar | En la base: 0 gastos | Pasó |
| Metas | Crear meta, crear hito, marcar hito | Progreso 0 % → 100 % | Pasó |
| Jornada | Guardar relato | Aparece en "Últimos días"; racha = 1 | Pasó |
| Salud | Crear hábito y marcarlo | En la base: registro de hoy con valor 1; racha 1, semana 1/7 | Pasó |
| Biblioteca | Guardar con etiquetas "prueba, #Ventas" | Etiquetas normalizadas a `prueba` y `ventas` | Pasó |
| Cerebro | Crear nota | Aparece con su frente y contenido | Pasó |
| Finanzas | Crear recurrente y "Marcar pagado" | 1 gasto generado, `ultimo_pago` de hoy, próximo vencimiento 15 dic | Pasó |
| Panel | Consolidar lo creado | 2 pendientes, 50 %, $ 9.999, racha 1, 1 en biblioteca, 1 nota | Pasó |
| Pantalla | Estados vacíos tras sesión iniciada | Sin errores | Pasó |

## C. Lo que NO se probó

- **Edición desde la interfaz:** Cerebro (Editar) y Jornada (Editar).
- **Borrado desde la interfaz** en todos los módulos salvo Gastos (el resto se limpió por base de datos).
- **Finanzas:** ingresos, presupuestos, deudas y abonos.
- **Salud:** medidas, objetivos y hábito de tipo cantidad.
- **Pantalla de error** (`error.js`): la función se probó por separado, pero no se vio en pantalla.
- **Móvil real:** el panel del navegador es angosto (~736 px) y mostró una columna, pero no es un teléfono.
- **Doble clic en "Marcar pagado":** riesgo conocido de duplicar el gasto; no corregido.

## D. Observaciones para la fase de fundaciones
- Varios campos de formulario aparecen sin nombre accesible en el árbol de accesibilidad (por ejemplo, los hábitos tipo casilla). Hay que verificarlo con una revisión de accesibilidad real.
- Los formularios son largos en pantallas angostas; conviene revisarlos en el rediseño móvil.
