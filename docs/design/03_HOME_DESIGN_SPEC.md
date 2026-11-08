# SECOND BRAIN --- Home Dashboard Design Specification

**Versión:** 1.0\
**Estado:** Dirección visual aprobada conceptualmente\
**Pantalla:** Inicio \> Mi día\
**Referencia:** `reference-home-dashboard.png`

## 1. Objetivo

Rediseñar completamente la experiencia visual de Home como un dashboard
híbrido: centro de control ejecutivo y asistente personal inteligente.

La pantalla debe ayudar al usuario a entender su situación, decidir qué
requiere atención y ejecutar acciones frecuentes sin navegar por
múltiples módulos.

## 2. Dirección visual

Estética futurista y minimalista: - Gradiente abstracto azul-violeta en
el encabezado. - Iluminación ambiental violeta. - Sin fotografías ni
paisajes de fondo. - Superficies oscuras o claras con profundidad
moderada. - Transparencias discretas. - Bordes y radios consistentes. -
Tipografía legible. - Animaciones sutiles y útiles.

Inspiración: - Linear: jerarquía y limpieza. - Raycast: productividad y
accesos rápidos. - visionOS: profundidad y capas.

## 3. Tokens iniciales

### Modo oscuro

-   Background principal: `#0B0B16`
-   Background secundario: `#111020`
-   Superficie: `#19182B`
-   Superficie elevada: `#242239`
-   Primario: `#A78BFA`
-   Secundario: `#60A5FA`
-   Éxito: `#34D399`
-   Advertencia: `#FBBF24`
-   Error: `#F87171`
-   Texto principal: `#F8FAFC`
-   Texto secundario: `#A1A1B5`

### Modo claro

-   Background principal: `#F5F4FA`
-   Superficie: `#FFFFFF`
-   Primario: `#7654CB`
-   Texto principal: `#28223D`
-   Texto secundario: `#716B82`

Convertir los colores en variables CSS/tokens. Ajustar contraste y
accesibilidad durante implementación.

## 4. Estructura de Home

### A. Header

-   Saludo personalizado.
-   Fecha actual.
-   Resumen del día.
-   Búsqueda universal.
-   Notificaciones.
-   Perfil.

El resumen generado por IA solo aparece cuando exista información real y
un servicio operativo. En caso contrario, mostrar un mensaje neutral
basado en el contexto disponible.

### B. Life Pulse

Indicador global y estado por frente/área: - Trabajo - Finanzas -
Salud - Metas - Personal - Familia

Debe permitir consultar el detalle y explicar el cálculo de cada
indicador. No inventar porcentajes ni promedios. Si no hay información
suficiente, indicar claramente que faltan datos.

### C. Prioridades de hoy

-   Pendientes abiertos.
-   Casillas de cumplimiento.
-   Título.
-   Frente asociado.
-   Meta vinculada cuando exista.
-   Progreso de completadas.
-   Crear, editar y completar sin abandonar Home.

### D. Agenda

-   Eventos del día.
-   Horarios.
-   Duración si existe.
-   Acceso al detalle.
-   Estado vacío claro cuando no haya eventos.

### E. AI Insights

-   Observaciones.
-   Patrones.
-   Alertas.
-   Recomendaciones.

Cada insight debe mostrar qué detectó, qué datos lo respaldan, por qué
importa y qué acción recomienda. No simular IA ni presentar conclusiones
sin evidencia.

### F. Avance por frentes

-   TANKU
-   TICKETCODE
-   Personal
-   Salud
-   Familia
-   Otros proyectos

Mostrar progreso solo si existe una fórmula válida y datos suficientes.
Permitir acceder al detalle.

### G. Hábitos de hoy

-   Hábitos registrados.
-   Cumplimiento diario.
-   Racha.
-   Resumen semanal.
-   Registro directo desde Home.

### H. Finanzas del mes

-   Gastos del mes.
-   Presupuesto utilizado.
-   Disponible.
-   Evolución cuando existan datos suficientes.
-   Acceso a Finanzas y acción rápida para registrar gasto.

### I. Accesos rápidos

-   Nuevo pendiente.
-   Registrar gasto.
-   Agregar nota.
-   Capturar idea.
-   Consultar IA.

Cada acceso debe invocar una acción real, no ser decorativo.

## 5. Distribución desktop

-   Header: ancho completo.
-   Life Pulse: ancho completo.
-   Primer grid de tres columnas: Prioridades, Agenda, AI Insights.
-   Segundo grid de tres columnas: Avance por frentes, Hábitos,
    Finanzas.
-   Barra de accesos rápidos al final.
-   Sidebar con navegación principal.
-   Asistente flotante persistente.

Permitir que el panel del asistente se abra sin ocultar acciones
importantes ni destruir el contexto de la pantalla.

## 6. Distribución móvil

Diseñar una experiencia móvil propia, no una versión reducida del
desktop.

Orden recomendado: 1. Header. 2. Life Pulse compacto. 3. Prioridades. 4.
Agenda. 5. Hábitos. 6. AI Insights. 7. Finanzas. 8. Avance por frentes.

Barra inferior propuesta: - Mi día. - Panel. - Metas. - Más.

Asistente flotante persistente, respetando áreas seguras y navegación
táctil.

## 7. Asistente flotante

Crear botón persistente y panel lateral/adaptable.

Estados: - Disponible. - Pensando. - Consultando información. -
Esperando aprobación. - Ejecutando acción. - Completado. - Error.

La interfaz puede implementarse antes que la integración de Claude API,
pero debe mostrar claramente cuando la capacidad todavía no está
conectada. No simular respuestas ni ejecuciones.

## 8. Componentes reutilizables sugeridos

-   `DashboardHeader`
-   `LifePulse`
-   `FrontIndicator`
-   `PriorityList`
-   `TaskItem`
-   `DailyAgenda`
-   `AIInsights`
-   `InsightCard`
-   `FrontProgress`
-   `HabitWidget`
-   `FinanceSummary`
-   `QuickActions`
-   `AssistantFloatingButton`
-   `AssistantDrawer`
-   `EmptyState`
-   `LoadingSkeleton`

Antes de crear duplicados, inspeccionar componentes existentes y decidir
cuáles adaptar.

## 9. Estados de datos

Cada widget debe contemplar: - Loading. - Empty. - Success. - Error. -
Partial data.

La base de datos actualmente tiene muy pocos registros reales. Diseñar
estados vacíos de alta calidad.

No utilizar datos ficticios en producción. Los datos de demostración, si
se necesitan para revisar el diseño, deben estar aislados y claramente
etiquetados.

## 10. Restricciones técnicas

-   Next.js 14 App Router.
-   React 18.
-   JavaScript.
-   Supabase / PostgreSQL.
-   Mantener autenticación.
-   No migrar a TypeScript.
-   No cambiar de framework.
-   No modificar esquema de base de datos ni RLS.
-   No eliminar consultas, servicios ni funcionalidades.
-   Mantener secretos de proveedores exclusivamente en servidor.
-   Separar presentación, lógica de negocio y acceso a datos.

## 11. Implementación por etapas

1.  Auditar Mi día, sus componentes, hooks, servicios y consultas.
2.  Presentar el plan de cambios y archivos afectados.
3.  Implementar tokens y componentes base.
4.  Implementar Header y Life Pulse.
5.  Implementar widgets centrales.
6.  Implementar accesos rápidos y asistente visual.
7.  Implementar temas claro/oscuro.
8.  Adaptar escritorio, tablet y móvil.
9.  Validar interacciones, consultas, estados y regresiones.

No modificar otros módulos durante la primera implementación de Home.

## 12. Criterios de aceptación

-   Fidelidad a la dirección visual aprobada.
-   Métricas conectadas a fuentes reales.
-   Ninguna funcionalidad anterior rota.
-   Escritorio, tablet y móvil utilizables.
-   Modo claro y oscuro funcionales.
-   Estados vacíos y errores bien diseñados.
-   Sin errores de consola.
-   Sin datos inventados.
-   Componentes mantenibles y reutilizables.

Antes de modificar código, presentar auditoría y plan de implementación.
No realizar cambios estructurales ni de base de datos sin aprobación.
