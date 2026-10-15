# Data Model: Planificación de vuelos para ortomosaico (cuadrícula de mapeo)

**Feature**: `002-mapping-grid` | **Date**: 2026-10-15

Objetos JavaScript planos y serializables a JSON, igual que en la feature 001.

## AreaMission (se guarda en `flyplan.mission`)

| Campo | Tipo | Regla |
|-------|------|-------|
| `type` | `"area"` | Distingue la misión de una ruta (`"route"`, feature 001). |
| `name` | string | 1–60 caracteres. Por defecto `"Mapeo"`. |
| `vertices` | `{lat, lon}[]` | Vértices del área en orden. No se vuelan (FR-003). |
| `closed` | boolean | `true` tras hacer clic en el primer vértice con 3 o más vértices. Pasa a `false` si quedan menos de 3. |
| `params` | MappingParams | Ver abajo. |
| `finishAction` | igual que la feature 001 | Lo usa la última parte. |
| `onSignalLost` | igual que la feature 001 | Lo usan todas las partes. |

Una misión de ruta (feature 001) guardada sin `type` se trata como `type: "route"`.

## MappingParams

| Campo | Tipo | Por defecto | Regla |
|-------|------|-------------|-------|
| `height` | number (m) | 60 | `LIMITS.height` de la feature 001; aviso por encima de 120 m. |
| `resolution` | `12` \| `50` | 12 | MP; determina GSD y tiempo (research R1, R5). |
| `frontOverlap` | number (%) | 80 | 50–90. |
| `sideOverlap` | number (%) | 70 | 50–90. |
| `direction` | number \| null | null | 0–179° (0 = pasadas norte-sur). `null` = automática, alineada con el lado más largo. |
| `speed` | number (m/s) | 5 | `LIMITS.speed` de la feature 001. |
| `captureMode` | `"stop"` \| `"interval"` | `"stop"` | `"interval"` no se puede elegir hasta verificarlo (research R6). |

El GSD objetivo no se guarda: al escribirlo, flyplan calcula y guarda `height`.

## Grid (derivado, no se guarda)

`computeGrid(area)` devuelve `null` si el área no está cerrada o no es válida, y
`{ error }` si necesitaría más de `MAPPING_LIMITS.maxPhotos` fotos (FR-019). En otro caso
devuelve:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `photos` | `{lat, lon}[]` | Puntos de foto en orden de vuelo. En modo parada, son también los waypoints. |
| `lines` | number | Número de pasadas. |
| `parts` | `{start: number, end: number}[]` | Índices en `photos` (con `end` exclusivo) de cada parte (R5). |
| `stats` | objeto | `areaHa`, `gsd` (cm/px), `lines`, `photos`, `distance` (m), `duration` (s), `batteries` (= número de partes). |

## Missions de exportación (derivadas)

`toMissions(area, grid)` devuelve una `Mission` de la feature 001 por parte:

- `name`: `<nombre> parte k de N` (o solo `<nombre>` si hay una sola parte).
- `defaults`: `{ height: params.height, speed: params.speed, gimbalPitch: -90 }`.
- `waypoints`: puntos de foto de la parte, con todos los campos `null`, `heading: null` y
  `actions: [{ type: 'photo' }]`.
- `finishAction`: `goHome` en las partes intermedias; `area.finishAction` en la última.
- `onSignalLost`: `area.onSignalLost`.

## Límites nuevos

Se añaden a una constante `MAPPING_LIMITS` en `grid.js`:

```text
overlap: { min: 50, max: 90 }       // %
partSeconds: 1500                   // 25 min por parte (FR-015)
partWaypoints: 200                  // = LIMITS.waypoints.max
maxPhotos: 20000                    // por encima no se calcula la ruta (FR-019)
```

## Estados del área en la interfaz

```text
vacía ──clic──▶ abierta (1–2 vértices) ──clic──▶ abierta (≥3) ──clic en vértice 1──▶ cerrada
cerrada ──lados cruzados──▶ inválida (sin ruta, mensaje)  ──corregir──▶ cerrada
cerrada ──borrar hasta <3──▶ abierta
```
