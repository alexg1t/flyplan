<!--
Sync Impact Report
- Version change: (plantilla sin rellenar) → 1.0.0
- Principios definidos:
  - I. Compatibilidad DJI Fly primero
  - II. Seguridad de vuelo
  - III. Simplicidad
  - IV. Pruebas de ida y vuelta (NO NEGOCIABLE)
  - V. Español y transferencia documentada
- Secciones añadidas: Restricciones técnicas, Flujo de desarrollo, Gobernanza
- Secciones eliminadas: ninguna
- Plantillas revisadas: plan-template.md, spec-template.md y tasks-template.md leen la
  constitución en tiempo de ejecución; no requieren cambios.
- TODO diferidos: ninguno
-->

# Constitución de flyplan

## Core Principles

### I. Compatibilidad DJI Fly primero

- El único entregable de flyplan es un archivo KMZ en formato DJI WPML
  (`wpmz/template.kml` + `wpmz/waylines.wpml`) que DJI Fly MUST abrir sin errores en un
  DJI Air 3S controlado con un DJI RC-N3.
- El Air 3S no tiene SDK. La misión se instala sustituyendo el KMZ de una misión ficticia
  creada en DJI Fly. flyplan MUST producir archivos válidos para ese procedimiento.
- Los valores específicos del dron (`droneEnumValue`, `droneSubEnumValue`, payload y
  similares) MUST salir de un KMZ de referencia exportado de DJI Fly real. Nunca se inventan.
- Un campo WPML que DJI Fly no usa o no está verificado MUST NOT emitirse.

Razón: si DJI Fly rechaza el archivo, la herramienta no sirve. La compatibilidad pesa más
que cualquier funcionalidad.

### II. Seguridad de vuelo

- Antes de exportar, flyplan MUST validar los límites del Air 3S y de DJI Fly: número
  máximo de waypoints, altura, velocidad y rango del gimbal. Una misión fuera de límites
  MUST NOT exportarse.
- flyplan MUST avisar de forma visible cuando cualquier waypoint supere 120 m AGL
  (normativa EASA / AESA en España).
- La interfaz y la documentación MUST indicar que flyplan no sustituye el criterio del
  piloto, la comprobación del espacio aéreo ni la revisión de la misión en DJI Fly antes
  de despegar.

Razón: un error en el plan termina en un dron perdido o en un incidente.

### III. Simplicidad

- flyplan es una web estática que corre solo en el navegador del PC. Sin backend, sin
  cuentas, sin base de datos de servidor.
- Cada dependencia nueva MUST justificarse en el plan de la feature frente a la
  alternativa nativa del navegador o de la librería estándar.
- No se permiten abstracciones especulativas: ninguna interfaz con una sola
  implementación ni configuración para valores que no cambian.

Razón: menos piezas significa menos fallos y mantenimiento fácil para un único usuario.

### IV. Pruebas de ida y vuelta (NO NEGOCIABLE)

- Cada generador o parser de KMZ MUST tener una prueba de ida y vuelta: generar, parsear
  y comparar con la misión original.
- Cada generador MUST tener además una prueba contra un KMZ real de DJI Fly guardado
  como fixture en el repositorio.
- La lógica de validación de límites (principio II) MUST tener pruebas de los casos
  límite: justo dentro y justo fuera de cada límite.

Razón: el formato WPML no tiene validador oficial para DJI Fly. Las pruebas son la única
red de seguridad antes de probar en el dron.

### V. Español y transferencia documentada

- Todo el texto de la interfaz MUST estar en español.
- La documentación MUST incluir instrucciones paso a paso para copiar el KMZ al móvil
  y sustituir la misión ficticia, tanto en Android como en iOS.

Razón: sin un procedimiento de transferencia claro, el KMZ nunca llega al dron.

## Restricciones técnicas

- Plataforma: HTML, CSS y JavaScript ejecutados en el navegador. Sin paso de servidor.
- Referencia de formato: especificación DJI WPML (Cloud API) contrastada siempre con
  KMZ reales de DJI Fly. Si ambas fuentes difieren, manda el KMZ real.
- Aeronave objetivo única: DJI Air 3S con DJI Fly. Otros modelos quedan fuera de alcance
  salvo enmienda de esta constitución.
- Tipos de misión dentro de alcance: waypoints manuales, cuadrícula de mapeo,
  órbita / POI e importación y edición de KMZ existentes.

## Flujo de desarrollo

- Cada feature sigue Spec Kit: specify, plan, tasks, implement y converge.
- Puertas de calidad antes de dar una feature por terminada:
  1. Todas las pruebas pasan.
  2. El KMZ generado se abre en DJI Fly con el Air 3S y la vista previa coincide con el
     plan. Esta comprobación es manual y se hace en tierra, sin volar.
- Cualquier desviación de un principio MUST anotarse en la sección "Complexity Tracking"
  del plan con su justificación.

## Governance

- Esta constitución tiene prioridad sobre cualquier otra práctica del proyecto.
- Enmiendas: se proponen por escrito, se actualiza este archivo y se registra el cambio en
  el Sync Impact Report.
- Versionado semántico: MAJOR para eliminar o redefinir principios, MINOR para añadir
  principios o secciones, PATCH para aclaraciones de redacción.
- Cada plan (`/speckit-plan`) y cada análisis (`/speckit-analyze`) MUST verificar el
  cumplimiento de estos principios.

**Version**: 1.0.0 | **Ratified**: 2026-10-15 | **Last Amended**: 2026-10-15
