# Data Model: Simulación 2D del vuelo

**Feature**: `003-flight-simulation` | **Date**: 2026-10-15

## Cambio en las misiones guardadas

| Campo | Tipo | Regla |
|-------|------|-------|
| `takeoff` | `{lat, lon}` \| `null` | Nuevo en las misiones de ruta (`Mission`, feature 001) y de área (`AreaMission`, feature 002). `null` = todavía sin marcar. Al validar lo guardado: `null`, o latitud y longitud finitas. Una misión guardada sin este campo se carga con `null`. |

`emptyMission()` y `emptyArea()` devuelven `takeoff: null`. `parseMission()` (abrir un KMZ)
también, porque el KMZ no lo contiene.

## Timeline (derivado, no se guarda)

`buildTimeline(mission)` devuelve `null` si no hay `takeoff` o no hay ruta. En otro caso:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `segments` | Segment[] | Ordenados y contiguos en el tiempo. |
| `points` | `{lat, lon, height}[]` | Puntos de la misión (waypoints o fotos) en orden de vuelo. |
| `total` | number (s) | Duración total, con ida y vuelta. |
| `missionSeconds` | number (s) | Solo el recorrido de la misión; coincide con el resumen (SC-001). |
| `batteries` | `{part, seconds, returnsHome}[]` | Tiempo por batería (FR-012). `returnsHome` es false si la parte termina con `noAction`. |
| `direction` | number \| null | Dirección de las pasadas (áreas), para la huella. |
| `photoHeight` | number \| null | Altura de las fotos (áreas), para la huella. |

### Segment

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `kind` | `"climb"` \| `"fly"` \| `"stop"` \| `"descend"` | |
| `phase` | `"despegue"` \| `"ida"` \| `"mision"` \| `"vuelta"` \| `"aterrizaje"` | Texto del panel. |
| `t0`, `dt` | number (s) | Inicio y duración. |
| `from`, `to` | `{lat, lon, height}` | Iguales en `stop`; misma `lat`/`lon` en `climb` y `descend`. |
| `d0` | number (m) | Distancia horizontal recorrida antes de este segmento. |
| `part` | number | Parte (0…N−1). |
| `point` | number \| null | En `stop`, índice del punto; en un `fly` de misión, índice del punto de destino. |

## SimState (derivado)

`stateAt(timeline, t)` devuelve:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `lat`, `lon`, `height` | number | Posición interpolada. |
| `heading` | number (°) | Rumbo del último tramo `fly`. Antes del primero (durante la subida), el del tramo de ida. |
| `phase`, `part` | | Del segmento actual. |
| `reached` | number | Índice del último punto en el que ya se ha parado (−1 si ninguno). |
| `distance` | number (m) | Distancia horizontal recorrida. |
| `elapsed`, `remaining` | number (s) | |

## Estado de la reproducción (solo en `main.js`)

```text
detenida (t = 0) ──Simular──▶ reproduciendo ──Pausa──▶ en pausa ──Reproducir──▶ reproduciendo
reproduciendo ──t = total──▶ terminada ──Reiniciar──▶ detenida
cualquier estado ──cambio en la misión (commit)──▶ detenida, con la línea de tiempo nueva (FR-008)
cualquier estado ──barra de progreso──▶ mismo estado, con t nuevo
pestaña oculta ──▶ en pausa
```

Velocidades: ×1, ×5, ×10 (por defecto), ×30, ×60 y ×120 (research R4).
