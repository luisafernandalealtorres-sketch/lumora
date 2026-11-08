# SECOND BRAIN --- Product & Design Brief

**Versión:** 1.0\
**Estado:** Dirección conceptual aprobada\
**Propósito:** Documento rector para evolucionar SECOND BRAIN hacia un
Personal Operating System.

## 1. Visión del producto

SECOND BRAIN es un sistema operativo personal que centraliza
información, organiza distintas áreas de vida y utiliza inteligencia
artificial para ayudar a comprender el contexto, priorizar acciones y
ejecutar tareas autorizadas.

No debe sentirse como una colección de formularios o paneles
administrativos. Debe funcionar como un centro de control personal:
permite entender qué está pasando, qué requiere atención y qué acciones
conviene tomar.

## 2. Principios de experiencia

1.  **Claridad antes que cantidad:** mostrar primero la información que
    ayuda a decidir o actuar.
2.  **Una inteligencia transversal:** la IA puede relacionar información
    de todos los frentes, sin crear asistentes aislados.
3.  **Control del usuario:** la IA puede recomendar y ejecutar acciones
    dentro de permisos explícitos.
4.  **Información conectada:** tareas, metas, finanzas, salud, jornada y
    conocimiento deben relacionarse cuando exista una relación real.
5.  **Diseño progresivo:** revelar detalles cuando se necesitan, sin
    saturar la pantalla principal.
6.  **Datos honestos:** no inventar métricas, actividad, insights ni
    porcentajes cuando falten datos.

## 3. Dirección visual aprobada

Estética híbrida: minimalista, tecnológica y futurista.

Referencias de lenguaje visual: - Linear: jerarquía, limpieza y
productividad. - Raycast: accesos rápidos y eficiencia. - visionOS:
profundidad, capas y transparencias sutiles.

Características: - Modo oscuro y modo claro. - Gradientes ambientales
violeta y azul. - Superficies con profundidad moderada. - Bordes suaves
y radios consistentes. - Tipografía legible y jerarquía clara. -
Animaciones discretas y funcionales. - Iconografía consistente.

Evitar: - Exceso de tarjetas. - Gradientes en todos los componentes. -
Glassmorphism que reduzca legibilidad. - Métricas decorativas sin
significado. - Apariencia de plantilla administrativa genérica.

## 4. Frentes de vida

Los frentes son una dimensión transversal de clasificación y filtrado,
no módulos principales de navegación:

-   TANKU
-   TICKETCODE
-   Personal
-   Salud
-   Familia
-   Otros proyectos

Deben poder utilizarse en tareas, metas, gastos, ingresos, jornadas,
notas, biblioteca y otras entidades cuando tenga sentido.

## 5. Capacidades de IA

### Proactiva

Detecta patrones, cambios, vencimientos y situaciones que merecen
atención. Las observaciones deben tener respaldo en datos y explicar su
origen.

### Memoria

Construye contexto a partir de información útil: objetivos, decisiones,
preferencias, proyectos, aprendizajes y hechos relevantes. El usuario
debe poder revisar, corregir y controlar lo que se conserva.

### Autónoma con control

Tres niveles: - Consultar: leer y analizar información permitida. -
Proponer: preparar una acción y solicitar aprobación. - Ejecutar:
realizar acciones previamente autorizadas y dentro de permisos
definidos.

Registrar las acciones relevantes y permitir conocer qué hizo la IA y
por qué.

## 6. Plataformas

-   Escritorio: dashboard completo y gestión profunda.
-   Tablet: navegación adaptable y widgets reorganizados.
-   Móvil: experiencia propia, priorizando Mi día, pendientes, agenda,
    hábitos y asistente.

## 7. Stack existente

-   Next.js 14, App Router
-   React 18
-   JavaScript
-   Supabase / PostgreSQL
-   Supabase Auth
-   Vercel previsto para despliegue

La dirección de diseño no autoriza por sí misma una migración
tecnológica.

## 8. Restricciones de evolución

-   Preservar la lógica funcional existente.
-   No modificar tablas, columnas, relaciones o políticas RLS sin
    revisión y aprobación.
-   No eliminar funcionalidades.
-   No migrar a TypeScript ni cambiar de framework.
-   Mantener las claves de proveedores de IA exclusivamente en el
    servidor.
-   No mostrar información ficticia en producción.
-   Separar presentación, lógica de negocio y acceso a datos.

## 9. Criterio de éxito

El producto debe ser intuitivo, confiable, consistente, responsive y
visualmente distintivo. Cada módulo debe tener una responsabilidad clara
y la IA debe conectar la información sin quitarle al usuario el control.
