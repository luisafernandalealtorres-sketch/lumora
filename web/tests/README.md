# Pruebas

Dos grupos. Ninguno añade dependencias: usan el ejecutor de pruebas que trae Node.

## 1. Pruebas de lógica (automáticas, no tocan la base)

```bash
cd web
npm test
```

| Archivo | Qué comprueba |
|---|---|
| `frentesMap.test.mjs` | El mapeo visual de frentes: seis frentes, asignación aprobada, filtros con varios slugs, "Sin asignar" sin pérdida de registros, sin mutar datos |
| `consulta.test.mjs` | Que un error real de consulta se distinga de un estado vacío |
| `contraste.test.mjs` | Valores de la especificación, estructura de temas y contraste WCAG de `styles/tokens.css` en claro y oscuro |
| `progreso.test.mjs` | Barras de progreso: un valor ausente o inválido es "Sin datos", nunca 0 % |
| `tonos.test.mjs` | Tonos de chips y barras; un slug se traduce a su frente de diseño; un frente desconocido queda neutro |
| `icons.test.mjs` | Estructura de los 34 iconos propios |
| `solo-tokens.test.mjs` | Los componentes nuevos usan solo tokens `--ds-*`: sin colores escritos a mano, sin variables inexistentes, sin `!important` |
| `aislamiento-laboratorio.test.mjs` | El laboratorio no usa Supabase, nadie fuera de él importa sus datos de demostración y responde 404 en producción |

Cada fase nueva con lógica pura debe agregar su archivo `*.test.mjs` aquí.
Requiere Node 20 o superior.

## 2. Pruebas de base de datos (manuales, modifican datos temporalmente)

Están en `tests/db/`. Insertan registros marcados `[PRUEBA-CRUD]` a nombre de tu usuario y los eliminan. **Ejecutar solo con la autorización del dueño** y con las 18 tablas de datos vacías.

| Orden | Archivo | Qué comprueba |
|---|---|---|
| 0 | `04_verificar_limpio.sql` | Línea base: 0 filas, 10 frentes, 1 usuario |
| 1 | `01_crear_y_modificar.sql` | Crear y modificar en las 18 tablas; `upsert` sin duplicados |
| 2 | `02_aislamiento_rls.sql` | Otro usuario y el anónimo no ven, modifican ni insertan; el catálogo de frentes es de solo lectura |
| 3 | `03_borrar.sql` | Borrado, cascadas y `SET NULL` |
| 4 | `04_verificar_limpio.sql` | Todo vuelve a 0 |

Cómo ejecutarlas: pegar cada archivo en el editor SQL de Supabase, o pedirle a Claude que las corra con el conector de Supabase. Cada una termina con una fila `OK n/4`; si algo falla, lanza un error y la base revierte ese paso.
Si una serie se interrumpe a la mitad, correr `03_borrar.sql` y luego `04_verificar_limpio.sql`.

Limitaciones: asumen un único usuario en `auth.users` y los 10 frentes actuales.

## 3. Lo que NO cubren

Estas pruebas no reemplazan la revisión de la interfaz con sesión real (crear, editar y borrar desde la pantalla). Esa verificación es manual; ver `docs/PRUEBAS-CRUD.md`.
