# Research: Simulación 2D del vuelo

**Feature**: `003-flight-simulation` | **Date**: 2026-10-15

## R1. Una sola fuente para el tiempo (SC-001)

- **Decision**:
  - `mission.js` exporta `timing(mission)`, que devuelve por tramo la distancia y los
    segundos, y por punto los segundos de parada (2 s + esperas). `duration()` pasa a ser la
    suma de `timing()`, así que el resumen y la simulación usan exactamente los mismos números.
  - En las áreas, la simulación usa `photoSeconds(resolution)` de `grid.js` para cada parada,
    y la distancia entre fotos a `params.speed`, igual que `computeGrid`.
- **Rationale**: dos fórmulas de tiempo acabarían separándose. Con una sola, el tiempo de
  misión simulado coincide con el resumen por construcción.
- **Nota**: en las áreas, `missionSeconds` se compara con `Σ part.seconds` de `computeGrid`,
  que no incluye el tramo entre partes (entre partes el dron vuelve a casa). La única
  diferencia es que `computeGrid` mide las distancias en su plano local y la simulación con
  haversine: unos 1e-5 en relativo, menos de 0,1 s en una misión de una hora.

## R2. Línea de tiempo y estado en un instante

- **Decision**: `buildTimeline` genera una lista ordenada de segmentos `{ kind, t0, dt, from,
  to, part, point, phase }` con `kind` de tipo `climb`, `fly`, `stop` o `descend`.
  `stateAt(timeline, t)` busca el segmento con búsqueda binaria sobre `t0` e interpola la
  posición, la altura y la distancia acumulada.
- **Rationale**: saltar con la barra de progreso es O(log n), así que cumple SC-002 (menos de
  0,25 s) incluso con unos 1500 puntos. La animación solo llama a `stateAt` en cada fotograma.

## R3. Despegue, ida, vuelta y aterrizaje

- **Decision**: por cada parte:
  1. `climb`: subida vertical en el punto de despegue hasta la altura del primer punto, a
     5 m/s.
  2. `fly` (ida): línea recta hasta el primer punto, a la velocidad de la misión.
  3. Recorrido de la parte: `stop` en cada punto y `fly` entre puntos.
  4. Final, según la acción al terminar de esa parte:
     - `goHome`: `fly` (vuelta) a la altura actual hasta el despegue y `descend` a 5 m/s.
     - `autoLand`: `descend` en el último punto.
     - `noAction`: se queda en el sitio. El tiempo de esa batería no incluye la vuelta, y el
       panel lo indica.
  - En las áreas, las partes intermedias terminan siempre con `goHome` (feature 002).
- **Rationale**: es el patrón de DJI Fly con `flyToWaylineMode` = `safely`: primero sube,
  luego va al primer punto. Los 5 m/s de subida y bajada y la velocidad de misión en la vuelta
  son prudentes (la vuelta a casa real suele ser más rápida). Se marcan con un comentario
  `ponytail:`.
- **Tiempo por batería** = suma de los segmentos de la parte, incluidas la ida y la vuelta.
  Aviso si supera `LIMITS.warnDuration` (2100 s, 35 min) (FR-012).

## R4. Animación

- **Decision**: bucle con `requestAnimationFrame`. En cada fotograma,
  `t += dtReal · velocidad`, se limita a `[0, total]` y se pinta `stateAt(t)`. La simulación se
  pausa al ocultar la pestaña (`visibilitychange`), así no hay saltos al volver (spec, Edge
  Cases). Velocidades ×1, ×5, ×10, ×30 y ×60, con ×10 por defecto.
- **SC-004**: una misión de 8 partes dura unas 3,5 h con ida y vuelta. A ×60 son 3,5 min
  reales. Para cumplir menos de 2 min se añade la velocidad **×120** como máxima.
- **Alternatives considered**: `setInterval`. Se descarta porque da animación irregular y no
  se detiene con la pestaña oculta.

## R5. Dibujo

- **Dron**: `L.marker` con un `divIcon` en forma de flecha, girada con
  `transform: rotate(rumbo)`. Se mueve con `setLatLng`.
- **Tramo recorrido**: `L.polyline` verde y gruesa encima de la ruta, con los puntos ya
  recorridos más la posición actual.
- **Fotos tomadas**: capa de `L.circleMarker` verdes con el renderizador `L.canvas()`, que
  crece a medida que se pasan fotos. Si se salta hacia atrás, se reconstruye.
- **Huella de la foto actual** (solo áreas): `L.polygon` con las 4 esquinas de
  `footprintPolygon(centro, altura, dirección)`. Lado largo transversal a la pasada (research
  R2 de la feature 002).
- **Punto de despegue**: marcador "H" arrastrable, visible en los dos modos.

## R6. Punto de despegue: modelo y uso

- **Decision**: campo `takeoff: {lat, lon} | null` en las dos clases de misión. Las misiones
  antiguas o abiertas desde un KMZ lo tienen a `null` y el siguiente clic lo coloca (FR-010).
  No se exporta (FR-009). Exportar exige que no sea `null` (FR-013).
- **FR-014**: `computeGrid` usa `area.takeoff` como referencia para elegir el inicio de la
  ruta. Si es `null`, usa `vertices[0]`, como hasta ahora; así las pruebas y misiones
  existentes siguen funcionando.

## R7. Pruebas

- `timing()`: su suma es igual a `duration()`, con las mismas esperas y paradas.
- `buildTimeline`:
  - El tiempo de misión, sin ida ni vuelta, coincide con `duration()` (ruta) o con
    `stats.duration` (área), con menos de 1 s de diferencia (SC-001).
  - Los segmentos son contiguos (`t0` del siguiente = `t0 + dt` del anterior).
  - Hay una batería por parte.
  - El orden de fases es despegue, ida, misión, vuelta y aterrizaje.
- `stateAt`:
  - En `t = 0` está en el despegue a altura 0; en `t = total` está en tierra en el despegue
    (`goHome`).
  - A mitad de un tramo, la posición es el punto medio.
  - El índice de punto es correcto justo antes y justo después de una parada.
- `footprintPolygon`: los lados miden `across` × `along`, con el lado largo perpendicular a la
  dirección.
- `computeGrid` con `takeoff`: la ruta empieza en el extremo más cercano al despegue (FR-014).
