# SECOND BRAIN --- Information Architecture & UX Restructuring

**Versión:** 1.0\
**Estado:** Propuesta para auditoría y aprobación\
**Objetivo:** Mejorar navegación, jerarquía y relaciones entre módulos
sin comprometer la funcionalidad existente.

## 1. Arquitectura de navegación propuesta

### INICIO

-   Mi día: actuar, planificar y ejecutar.
-   Panel: observar el estado general y analizar tendencias.

### MI VIDA

-   Metas
-   Finanzas
    -   Resumen financiero
    -   Gastos
    -   Ingresos
    -   Presupuestos
    -   Pagos recurrentes
    -   Deudas
-   Salud
-   Jornada
-   Personas (capacidad nueva por evaluar)

### CONOCIMIENTO

-   Biblioteca
-   Cerebro

### ASISTENTE IA

-   Chat contextual
-   Memoria
-   Insights
-   Automatizaciones

El asistente también estará disponible desde cualquier módulo mediante
un control flotante. No es necesario que toda su funcionalidad viva
exclusivamente en una página independiente.

## 2. Reorganización de las nueve pestañas actuales

  -----------------------------------------------------------------------
  Pestaña actual          Destino propuesto       Decisión
  ----------------------- ----------------------- -----------------------
  Mi día                  Inicio \> Mi día        Mantener como
                                                  experiencia diaria
                                                  principal

  Panel                   Inicio \> Panel         Mantener como vista de
                                                  análisis

  Metas                   Mi Vida \> Metas        Mantener

  Finanzas                Mi Vida \> Finanzas     Mantener como
                                                  contenedor financiero

  Gastos                  Finanzas \> Gastos      Integrar como
                                                  subsección sin perder
                                                  capacidades

  Jornada                 Mi Vida \> Jornada      Mantener

  Salud                   Mi Vida \> Salud        Mantener

  Biblioteca              Conocimiento \>         Mantener
                          Biblioteca              

  Cerebro                 Conocimiento \> Cerebro Mantener
  -----------------------------------------------------------------------

## 3. Frentes transversales

Mantener los seis frentes: - TANKU - TICKETCODE - Personal - Salud -
Familia - Otros proyectos

Los frentes deben ser filtros y atributos transversales, no seis páginas
principales adicionales.

Auditar cómo se almacenan actualmente y verificar que las entidades
relacionadas utilicen referencias consistentes. No modificar el modelo
de datos sin aprobación.

## 4. Relaciones funcionales que deben validarse

-   Un pendiente de Mi día puede vincularse a una meta.
-   Las metas pertenecen a uno o más contextos/frentes según el modelo
    actual.
-   Los gastos se clasifican por categoría y frente.
-   Los pagos recurrentes pueden generar gastos, evitando duplicados.
-   Finanzas consolida ingresos, gastos, presupuestos, obligaciones y
    saldos.
-   Panel consume indicadores derivados de los módulos.
-   Jornada registra reflexiones y resultados diarios.
-   Salud registra hábitos, medidas y objetivos.
-   Biblioteca almacena recursos de aprendizaje.
-   Cerebro almacena notas e ideas por frente.
-   Agenda y correos alimentan Mi día cuando la integración esté
    operativa.

Documentar las relaciones reales encontradas en el código y en
PostgreSQL antes de proponer cambios.

## 5. Nuevas capacidades a evaluar --- no implementar todavía

### Personas

Posible gestión de: - Contactos importantes. - Fechas especiales. -
Relaciones y contexto. - Notas vinculadas a personas. - Compromisos y
recordatorios.

### Calendario y recordatorios

Evaluar una experiencia centralizada para: - Eventos. - Fechas
importantes. - Recordatorios. - Compromisos. - Sincronización con Google
Calendar.

Evitar crear un calendario duplicado si Google Calendar ya es la fuente
de verdad para determinados eventos.

### Conexiones

Evaluar una vista de relaciones entre: - Personas. - Ideas. -
Proyectos. - Metas. - Decisiones. - Notas.

Debe ser una capacidad de exploración, no una visualización obligatoria
en el uso diario.

## 6. Auditoría solicitada a Claude Code

Antes de implementar, inspeccionar y documentar:

1.  Rutas y páginas actuales.
2.  Componentes y layouts.
3.  Servicios, hooks y consultas.
4.  Tablas y relaciones utilizadas.
5.  Funcionalidad real de cada módulo.
6.  Flujos de creación, lectura, edición y eliminación.
7.  Integraciones y tareas programadas.
8.  Estados vacíos, errores y validaciones.
9.  Problemas de navegación y duplicación.

## 7. Entregables de la auditoría

-   Mapa de navegación actual.
-   Mapa de navegación propuesto.
-   Matriz de módulos y funcionalidades.
-   Mapa de relaciones entre entidades.
-   Componentes reutilizables existentes.
-   Riesgos técnicos.
-   Cambios recomendados.
-   Plan de implementación por fases.

## 8. Reglas de implementación

-   Mantener Next.js 14, React 18 y JavaScript.
-   Mantener Supabase y PostgreSQL.
-   No cambiar autenticación.
-   No modificar RLS.
-   No eliminar tablas, columnas o relaciones.
-   No introducir datos ficticios.
-   No duplicar funcionalidades.
-   Reutilizar servicios y componentes cuando sea razonable.
-   No implementar Personas, Calendario nuevo o Conexiones hasta aprobar
    su alcance.

## 9. Criterios de UX

-   Reducir opciones visibles simultáneamente.
-   Mantener acciones frecuentes accesibles.
-   Facilitar filtros por frente.
-   Permitir navegar a información relacionada.
-   Mantener consistencia entre formularios, filtros y patrones de
    interacción.
-   Priorizar una experiencia móvil sencilla.
-   Evitar que la reorganización rompa enlaces, rutas o flujos
    existentes.

## 10. Proceso de aprobación

### Etapa A --- Auditoría

Solo inspección y documentación. No modificar código ni base de datos.

### Etapa B --- Propuesta

Presentar mapa, impacto y plan. Esperar aprobación.

### Etapa C --- Implementación

Reorganizar navegación y módulos por etapas, con pruebas de regresión.

La prioridad es mejorar la experiencia sin comprometer estabilidad,
seguridad ni datos.
