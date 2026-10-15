# Implementation Plan: Simulación 2D del vuelo

**Branch**: `003-flight-simulation` | **Date**: 2026-10-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-flight-simulation/spec.md`

## Summary

Simulación 2D sobre el mapa de cómo volará el dron una ruta o un área. Partes:

- **Punto de despegue obligatorio**: un marcador "H" que se guarda con la misión. Es la
  referencia de las alturas y del inicio de la cuadrícula.
- **Línea de tiempo**: un módulo puro, `sim.js`, la construye a partir de la misión (despegue,
  ida, recorrido, vuelta y aterrizaje por parte) y da el estado del dron en cualquier
  instante con búsqueda binaria.
- **Mismo tiempo que el resumen**: el modelo de tiempo es el de las features 001 y 002, que
  se factoriza en `timing()`.
- **En `main.js`**: el dron animado, el tramo recorrido, las fotos tomadas, la huella de la
  foto actual, los controles de reproducción y el tiempo por batería.
- **Cambios en lo ya construido**: exportar exige el punto de despegue, y la cuadrícula
  empieza en el extremo más cercano a él.

## Technical Context

**Language/Version**: JavaScript (ES2022, módulos ES nativos), igual que las features
anteriores.

**Primary Dependencies**: Leaflet 1.9.4 (ya incluido). Sin dependencias nuevas.

**Storage**: `localStorage`; la misión guardada gana el campo `takeoff`.

**Testing**: `node --test` (`tests/sim.test.js` nuevo, más ampliaciones de `mission` y `grid`).

**Target Platform**: navegadores de escritorio actuales.

**Project Type**: web estática (single project).

**Performance Goals**: animación fluida con 1500 fotos (SC-003); salto con la barra en menos
de 0,25 s (SC-002).

**Constraints**: solo visual (FR-009); sin campos WPML nuevos; interfaz en español.

**Scale/Scope**: una simulación a la vez, hasta unos 1500 puntos y 8 partes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple el plan | Estado |
|-----------|------------------------|--------|
| I. Compatibilidad DJI Fly primero | El punto de despegue no se exporta. La simulación no toca el KMZ. Sin campos WPML nuevos. | PASS |
| II. Seguridad de vuelo | Tiempo real por batería con ida y vuelta, y aviso por encima de 35 min (FR-012). Exportar exige un despegue planificado (FR-013). | PASS |
| III. Simplicidad | Un módulo puro nuevo (`sim.js`). `timing()` factoriza el cálculo de tiempo existente en lugar de duplicarlo. Animación con `requestAnimationFrame`; sin librerías. | PASS |
| IV. Pruebas | Pruebas de `timing`, `buildTimeline` (SC-001), `stateAt`, `footprintPolygon` y del inicio de la cuadrícula junto al despegue (research R7). | PASS |
| V. Español y documentación | Interfaz en español; `ayuda.html` explica que hay que despegar desde el punto planificado. | PASS |

**Re-check post-diseño**: PASS. El único cambio en el modelo guardado es `takeoff`, compatible
con las misiones existentes (se carga como `null`).

## Project Structure

### Documentation (this feature)

```text
specs/003-flight-simulation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── sim-module.md
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
public/
├── index.html           # + botón "Mover despegue", sección "Simulación"
├── ayuda.html           # + despegar desde el punto planificado
├── styles.css           # + icono del dron, "H", panel de simulación
└── js/
    ├── sim.js           # NUEVO: buildTimeline, stateAt, footprintPolygon
    ├── main.js          # + despegue, exportación con despegue, reproductor
    ├── mission.js       # + timing(), takeoff en emptyMission()
    ├── grid.js          # + takeoff en emptyArea(), inicio junto al despegue (FR-014)
    ├── wpml.js          # sin cambios
    └── kmz.js           # sin cambios

tests/
├── sim.test.js          # NUEVO
├── mission.test.js      # + timing()
└── grid.test.js         # + inicio junto al despegue
```

**Structure Decision**: misma web estática. La lógica de la simulación es pura y se prueba en
Node; `main.js` solo pinta el estado que le devuelve `stateAt`.

## Complexity Tracking

Sin violaciones de la constitución que justificar.
