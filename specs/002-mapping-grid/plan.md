# Implementation Plan: Planificación de vuelos para ortomosaico (cuadrícula de mapeo)

**Branch**: `002-mapping-grid` | **Date**: 2026-10-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-mapping-grid/spec.md`

## Summary

Nuevo tipo de misión "Área de mapeo". El piloto dibuja un polígono y flyplan calcula dentro
una cuadrícula de pasadas en ida y vuelta con los puntos de foto, y la dibuja sobre el mapa
con el resumen (ha, GSD, pasadas, fotos, distancia, tiempo, baterías).

Los cálculos salen de la ficha de la cámara principal del Air 3S (84° de campo de visión, 4:3,
12 o 50 MP). Toda la lógica nueva es un módulo puro, `grid.js`. La exportación convierte cada
parte (25 min y 200 waypoints como máximo) en una `Mission` de la feature 001 y reutiliza su
validación, su KMZ y su bloqueo. Solo se implementa el modo **parada con foto**; el disparo
por intervalo queda visible pero desactivado hasta verificarlo.

## Technical Context

**Language/Version**: JavaScript (ES2022, módulos ES nativos), igual que la feature 001.

**Primary Dependencies**: Leaflet 1.9.4 (ya incluido). Sin dependencias nuevas.

**Storage**: `localStorage` (`flyplan.mission`, con el campo nuevo `type`).

**Testing**: `node --test` (`tests/grid.test.js` nuevo).

**Target Platform**: navegadores de escritorio actuales; salida para DJI Fly con el Air 3S.

**Project Type**: web estática (single project).

**Performance Goals**: recálculo y dibujo en menos de 0,5 s para áreas de hasta 50 ha (unas
1500 fotos) (SC-002).

**Constraints**: sin backend; sin campos WPML nuevos (constitución I); interfaz en español.

**Scale/Scope**: un área en curso, hasta unas 1500 fotos, partes de 25 min y 200 waypoints.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple el plan | Estado |
|-----------|------------------------|--------|
| I. Compatibilidad DJI Fly primero | Las partes se exportan con los mismos elementos WPML que la feature 001 (waypoint + `gimbalRotate` + `takePhoto`). El disparo por intervalo (`multipleDistance`, sin verificar) queda desactivado. Se aplica el mismo bloqueo `WPML_VERIFIED`. | PASS |
| II. Seguridad de vuelo | Cada parte pasa `validate()` de la feature 001 (límites y aviso de 120 m). Partes de 25 min con vuelta a casa para cambiar la batería. Aviso de varias baterías. | PASS |
| III. Simplicidad | Un módulo nuevo (`grid.js`) con unas 200 líneas de geometría propia en lugar de Turf.js. Sin dependencias nuevas. El modo intervalo y su aviso de velocidad no se programan hasta que haga falta. | PASS |
| IV. Pruebas | Cobertura del 100 % con polígonos convexos y cóncavos, GSD, separaciones, límites de las partes e ida y vuelta de cada parte por `wpml.js` (research R10). | PASS |
| V. Español y documentación | Interfaz en español. `ayuda.html` añade la configuración de cámara para ortomosaico y cómo volar varias partes (FR-017). | PASS |

**Re-check post-diseño**: PASS. El diseño no añade dependencias, servicios ni campos WPML.
La única extensión del modelo guardado es el campo `type`, compatible con las misiones de
la feature 001.

## Project Structure

### Documentation (this feature)

```text
specs/002-mapping-grid/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── grid-module.md
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
public/
├── index.html           # + selector de tipo de misión, formulario de mapeo, resumen
├── ayuda.html           # + configuración de cámara para ortomosaico y vuelo en partes
├── styles.css           # + estilos de vértices, puntos de foto y partes
└── js/
    ├── grid.js          # NUEVO: cámara, GSD, área, validez, cuadrícula, partes, toMissions
    ├── main.js          # + modo área: dibujo del polígono, recálculo, resumen, exportación por partes
    ├── mission.js       # sin cambios
    ├── wpml.js          # sin cambios
    └── kmz.js           # sin cambios

tests/
└── grid.test.js         # NUEVO (research R10)
```

**Structure Decision**: misma web estática. La lógica nueva va en un módulo puro aparte
(`grid.js`) para probarla sin navegador, igual que `mission.js`. `main.js` sigue siendo el
único módulo con DOM y Leaflet y elige qué dibujar según `mission.type`. `wpml.js` no cambia:
recibe `Mission` de la feature 001 como siempre.

## Complexity Tracking

Sin violaciones de la constitución que justificar.
