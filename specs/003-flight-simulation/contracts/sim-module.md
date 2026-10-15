# Contrato: simulación

## Nuevo `public/js/sim.js`

Funciones puras, sin DOM ni Leaflet.

```text
CLIMB_RATE = 5                                  m/s de subida y bajada (research R3, provisional)
buildTimeline(mission) -> Timeline | null       ruta o área; null sin takeoff o sin ruta
stateAt(timeline, t) -> SimState                búsqueda binaria; t se limita a [0, total]
footprintPolygon(center, height, direction) -> [{lat, lon}] x4   huella de una foto
```

- En un área, `buildTimeline` llama a `computeGrid` y usa sus `photos` y `parts`. En una ruta,
  usa `timing()` de `mission.js`.
- `buildTimeline` no modifica la misión (FR-009).

## Cambios en `public/js/mission.js`

```text
timing(mission) -> { distances: number[], legs: number[], stops: number[] }
                     distances y legs: n−1 tramos (m y s); stops: n paradas (s)
duration(mission) = Σ legs + Σ stops            misma salida que antes
emptyMission() -> ... + takeoff: null
```

## Cambios en `public/js/grid.js`

```text
emptyArea() -> ... + takeoff: null
computeGrid(area): inicio = extremo más cercano a area.takeoff ?? vertices[0]   (FR-014)
```

## Cambios en `public/js/main.js`

- Marcador "H" del punto de despegue, en los dos modos.
  - Sin `takeoff`, el primer clic lo coloca.
  - "Mover despegue" lo recoloca con el siguiente clic.
  - Se puede arrastrar.
- La exportación de los dos modos exige `takeoff` (FR-013).
- Sección "Simulación" del panel:
  - "Simular / Pausa", "Reiniciar", velocidad y barra de progreso.
  - Lectura del tiempo, la distancia, el punto, la parte, la altura y las acciones.
  - Lista del tiempo de cada batería con su aviso.
- `commit()` detiene la simulación y reconstruye la línea de tiempo (FR-008).
