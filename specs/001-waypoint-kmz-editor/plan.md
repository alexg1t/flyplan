# Implementation Plan: Editor de misiones waypoint con exportación KMZ para DJI Fly

**Branch**: `001-waypoint-kmz-editor` | **Date**: 2026-10-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-waypoint-kmz-editor/spec.md`

## Summary

Web estática en español para diseñar misiones waypoint sobre un mapa satélite y exportarlas
como KMZ (DJI WPML) que DJI Fly abre en el Air 3S. El KMZ se instala sustituyendo una misión
ficticia en el móvil del RC-N3, porque el Air 3S no tiene SDK. Los valores del dron salen de
un KMZ de referencia real exportado por el piloto. La lógica (misión, validación, WPML, ZIP)
vive en módulos puros sin DOM, probados con `node --test`. La interfaz es un único módulo con
Leaflet. Sin build, sin backend.

## Technical Context

**Language/Version**: JavaScript (ES2022, módulos ES nativos), HTML5, CSS. Node 24 solo para
las pruebas.

**Primary Dependencies**: Leaflet 1.9.4 (cdnjs). Desarrollo: `@xmldom/xmldom` (DOMParser en
Node para las pruebas).

**Storage**: `localStorage` del navegador (`flyplan.mission`, `flyplan.droneProfile`).

**Testing**: `node --test` (runner nativo).

**Target Platform**: navegadores de escritorio actuales (Chrome, Edge, Firefox, Safari 16.4+;
necesitan `DecompressionStream('deflate-raw')`). Salida: DJI Fly en Android o iOS con Air 3S.

**Project Type**: web estática (single project).

**Performance Goals**: edición fluida (sin retardo apreciable al arrastrar) con 200 waypoints,
que es el máximo de DJI Fly.

**Constraints**: sin backend ni cuentas; los datos no salen del navegador; misma carpeta
servible en hosting estático y en local; texto de la interfaz en español.

**Scale/Scope**: un piloto, una misión en curso, hasta 200 waypoints, dos páginas (editor y
ayuda).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple el plan | Estado |
|-----------|------------------------|--------|
| I. Compatibilidad DJI Fly primero | Valores del dron solo desde el KMZ de referencia (R3). Los elementos dudosos (**[F]**) se copian del fixture real y una prueba de estructura compara la salida con él (R9, contrato KMZ). | PASS. `WPML_VERIFIED = false` bloquea la exportación en la interfaz hasta que T035 confirme los **[F]** con el fixture real. |
| II. Seguridad de vuelo | `validate()` bloquea fuera de límites y avisa por encima de 120 m y por autonomía (data-model, LIMITS). Aviso permanente en la interfaz (FR-017). | PASS. Límites provisionales; se confirman en DJI Fly (R4). |
| III. Simplicidad | Sin build, sin framework, sin backend. Una dependencia de ejecución (Leaflet, justificada en R6). ZIP y XML sobre APIs nativas (R7, R8). Cuatro módulos JS. | PASS |
| IV. Pruebas de ida y vuelta | Ida y vuelta, fixture real y casos límite en `node --test` (R9). | PASS |
| V. Español y transferencia documentada | Interfaz en español; `ayuda.html` con pasos para Android e iOS (FR-015). | PASS |

**Re-check post-diseño**: PASS. El diseño de la Phase 1 no añade dependencias, servicios ni
abstracciones. `@xmldom/xmldom` es solo de desarrollo y solo existe porque Node no trae
`DOMParser`.

## Project Structure

### Documentation (this feature)

```text
specs/001-waypoint-kmz-editor/
├── plan.md              # Este archivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── kmz-dji-fly.md   # Formato del KMZ (entrada y salida)
│   └── modules.md       # API de los módulos de lógica
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
public/                  # La web completa; se publica tal cual
├── index.html           # Editor: mapa + panel lateral
├── ayuda.html           # Guía de transferencia Android/iOS y KMZ de referencia
├── styles.css
└── js/
    ├── main.js          # Interfaz: Leaflet, panel, eventos, localStorage, descarga
    ├── mission.js       # Modelo, LIMITS, valores efectivos, distancia, tiempo, validate()
    ├── wpml.js          # buildFiles / parseMission / parseProfile
    └── kmz.js           # zip / unzip sobre APIs nativas

tests/
├── mission.test.js      # Distancia, tiempo, valores efectivos, límites (dentro y fuera)
├── wpml.test.js         # Ida y vuelta + estructura contra el fixture
└── kmz.test.js          # zip → unzip, y unzip del fixture real

fixtures/
└── referencia-air3s.kmz # KMZ real de DJI Fly del piloto (quickstart §1)

package.json             # "type": "module", script test, devDependency @xmldom/xmldom
```

**Structure Decision**: proyecto único de web estática. `public/` se sirve sin
transformación en local y en producción (FR-019). La lógica reutilizable está separada de
`main.js` para que la feature de cuadrícula y un posible servidor futuro la importen
directamente (contracts/modules.md).

## Complexity Tracking

Sin violaciones de la constitución que justificar.
