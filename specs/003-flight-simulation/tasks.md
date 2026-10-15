---

description: "Lista de tareas: simulación 2D del vuelo"
---

# Tasks: Simulación 2D del vuelo

**Input**: Design documents from `specs/003-flight-simulation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/sim-module.md, quickstart.md

**Tests**: incluidas (constitución IV; SC-001 y SC-002 se verifican con pruebas automáticas).

**Organization**: tareas agrupadas por historia de usuario. No hay tareas bloqueadas por datos
externos.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes).
- **[Story]**: historia de usuario de spec.md (US1…US3).

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 [P] Crear `tests/sim.test.js` con misiones de prueba reutilizables, todas con `takeoff`:
  - Una ruta de 4 waypoints con una espera de 3 s en el WP2.
  - Un área de unas 2 ha (una parte).
  - Un área de 600 × 600 m (varias partes).

  El área importa `emptyArea` de `public/js/grid.js`. Definir las posiciones en metros respecto a un origen, igual que en `tests/grid.test.js`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase.

- [X] T002 En `public/js/mission.js`:
  - `timing(mission)` → `{ distances, legs, stops }`. `distances` y `legs` son los n−1 tramos, en metros y en segundos (tramo 3D / velocidad efectiva del punto de origen). `stops` son las n paradas, en segundos: `STOP_SECONDS` + esperas.
  - `duration(mission)` pasa a ser `Σ legs + Σ stops`.
  - `emptyMission()` añade `takeoff: null`.
- [X] T003 [P] Ampliar `tests/mission.test.js`:
  - `duration()` es igual a la suma de `timing()` para la misión de la prueba de `duration`.
  - `stops` incluye las esperas.
  - `distances.length === n − 1`.
  - `emptyMission().takeoff === null`.
- [X] T004 En `public/js/grid.js`:
  - `emptyArea()` añade `takeoff: null`.
  - `computeGrid` elige el inicio de la ruta como el extremo más cercano a `area.takeoff ?? area.vertices[0]` (FR-014).
  - `computeGrid` guarda en cada parte su tiempo (`part.seconds`). `stats.duration` pasa a ser `Σ part.seconds`: el tramo entre partes no cuenta, porque entre partes el dron vuelve a casa (análisis I1).
- [X] T005 [P] Ampliar `tests/grid.test.js`: con `takeoff` en la esquina opuesta al vértice 1 del cuadrado, la primera foto es la más cercana al despegue de los 4 extremos posibles. Las pruebas que ya existen, con `takeoff` nulo, siguen pasando. Prueba nueva: `stats.duration` es igual a la suma de `parts[].seconds`. Con varias partes, es menor que `distancia/velocidad + fotos · photoSeconds`, porque no incluye los tramos entre partes.
- [X] T006 [P] En `public/index.html`:
  - Botón "Mover despegue" (`#btn-takeoff`) junto a los botones de misión.
  - Texto `#takeoff-hint` con "Primero marca el punto de despegue: haz clic en el mapa donde vas a despegar".

  En `public/styles.css`, el estilo del marcador "H" (`.home-icon`).
- [X] T007 En `public/js/main.js`, punto de despegue (FR-010):
  - La validación de lo guardado acepta `takeoff` `null` o con `lat`/`lon` finitas. Al cargar, `mission.takeoff ??= null`.
  - El marcador "H" es arrastrable y se ve en los dos modos.
  - Si `takeoff` es `null`, el clic en el mapa coloca el despegue en lugar de añadir un punto.
  - `#btn-takeoff` hace que el siguiente clic recoloque el despegue.
  - `#takeoff-hint` solo se ve sin despegue.
  - Todo cambio llama a `commit()`.
  - `openMission` (abrir un KMZ) deja `takeoff: null`.
- [X] T008 En `public/js/main.js`, en la exportación de los dos modos, después del bloqueo `WPML_VERIFIED`: si `takeoff` es `null`, mostrar "Marca el punto de despegue antes de exportar" y no exportar (FR-013).

**Checkpoint**: `npm test` pasa. La "H" se coloca, se mueve y se guarda. La cuadrícula empieza junto a la "H".

---

## Phase 3: User Story 1 - Ver cómo vuela el dron un área de mapeo (Priority: P1) 🎯 MVP

**Goal**: el dron animado recorre el área con despegue, ida, fotos, huella, cambio de parte y vuelta.

**Independent Test**: quickstart §3, escenarios 4 a 6.

### Tests for User Story 1

- [X] T009 [P] [US1] Ampliar `tests/sim.test.js` para `buildTimeline` en áreas (research R7):
  - Devuelve `null` sin `takeoff` o con el área sin cerrar.
  - `missionSeconds` difiere de `computeGrid(area).stats.duration` en menos de 1 s (SC-001).
  - Los segmentos son contiguos (`t0` siguiente = `t0 + dt`).
  - `batteries.length === parts.length`.
  - En el área de varias partes, las fases de cada parte van en el orden despegue, ida, misión, vuelta, aterrizaje.
  - El tiempo de cada batería es la suma de sus segmentos.
- [X] T010 [P] [US1] Ampliar `tests/sim.test.js` para `stateAt` y `footprintPolygon`:
  - En `t = 0`, está en el despegue a altura 0.
  - En `t = total`, está en el despegue a altura 0 (`goHome`).
  - A mitad de un tramo `fly`, está en el punto medio.
  - `reached` justo antes y justo después de una parada.
  - `t` fuera de rango se limita.
  - 10 000 llamadas a `stateAt` con `t` aleatorio sobre el área de varias partes tardan menos de 250 ms (SC-002).
  - Los lados de `footprintPolygon` miden `across` × `along` (±0,5 %), con el lado largo perpendicular a la dirección.

### Implementation for User Story 1

- [X] T011 [US1] Crear `public/js/sim.js` con `CLIMB_RATE = 5` (comentario `// ponytail: estimación prudente; la vuelta real de DJI Fly suele ser más rápida`) y `buildTimeline(mission)` para áreas (research R3):
  - Llama a `computeGrid`.
  - Por cada parte: `climb` a `params.height`, `fly` de ida a `params.speed`, `stop` de `photoSeconds(resolution)` en cada foto y `fly` entre fotos.
  - Final según la acción al terminar: las partes intermedias, `goHome`; la última, `area.finishAction`. Con `goHome`, `fly` de vuelta y `descend`; con `autoLand`, `descend` en el sitio; con `noAction`, nada.
  - Calcular `d0`, `missionSeconds`, `batteries` (`part`, `seconds`, `returnsHome`), `direction` y `photoHeight`.
- [X] T012 [US1] En `public/js/sim.js`, `stateAt(timeline, t)`:
  - Búsqueda binaria sobre `t0` e interpolación lineal de la posición y la altura.
  - `heading` del último `fly`. Antes del primer `fly` (durante la subida), el rumbo es el del tramo de ida.
  - `reached`, `distance` (`d0` + lo recorrido en el segmento), `elapsed` y `remaining`.
- [X] T013 [US1] En `public/js/sim.js`, `footprintPolygon(center, height, direction)`: 4 esquinas con `footprint(height)` de `grid.js`, con el lado largo perpendicular a `direction`. Usar la proyección local alrededor de `center`.
- [X] T014 [P] [US1] En `public/index.html`, sección "Simulación", visible en los dos modos:
  - `#sim-play` (Simular / Pausa) y `#sim-reset` (Reiniciar).
  - `#sim-speed`: ×1, ×5, ×10 (seleccionada), ×30, ×60 y ×120.
  - `#sim-progress`: un `input type="range"`.
  - Lecturas `#sim-phase`, `#sim-elapsed`, `#sim-remaining`, `#sim-distance`, `#sim-point`, `#sim-part`, `#sim-height` y `#sim-actions`.
  - Lista `#sim-batteries` y motivo `#sim-reason` cuando no se puede simular.
- [X] T015 [P] [US1] En `public/styles.css`: icono del dron como flecha (`.drone-icon`, girada con `transform: rotate()`), panel de simulación y lista de baterías con aviso.
- [X] T016 [US1] En `public/js/main.js`, dibujo de la simulación:
  - Capa propia con el marcador del dron (`setLatLng` y giro con el rumbo).
  - Tramo recorrido: `L.polyline` verde.
  - Fotos tomadas: `L.circleMarker` verdes con `L.canvas()`, que se añaden al avanzar y se reconstruyen al retroceder.
  - Huella actual (áreas): `L.polygon` de `footprintPolygon`.
  - Lecturas del panel y lista de baterías con aviso si `seconds > LIMITS.warnDuration` y la nota "sin vuelta a casa" si `returnsHome` es false (FR-012).
  - `commit()` reconstruye la línea de tiempo, detiene y reinicia la simulación (FR-008).
  - `#sim-play` desactivado con `#sim-reason` si `buildTimeline` es `null` (FR-001).
- [X] T017 [US1] En `public/js/main.js`, bucle de reproducción con `requestAnimationFrame` (`t += dtReal · velocidad`). `#sim-play` alterna entre reproducir y pausar. Al llegar a `total`, el estado pasa a "terminada".

**Checkpoint**: US1 funciona (quickstart §3, escenarios 4 a 6).

---

## Phase 4: User Story 2 - Controlar la reproducción (Priority: P1)

**Goal**: pausa, reinicio, velocidad y salto con la barra.

**Independent Test**: quickstart §3, escenarios 7 a 9 y 15.

- [X] T018 [US2] En `public/js/main.js`:
  - `#sim-reset` vuelve a `t = 0`, con todas las fotos pendientes.
  - `#sim-speed` cambia la velocidad sin detener la reproducción.
  - `#sim-progress` (evento `input`) salta a `t` y redibuja.
  - La barra sigue a `t` mientras se reproduce.
  - `visibilitychange` con la pestaña oculta pausa la reproducción.

**Checkpoint**: US1 y US2 funcionan.

---

## Phase 5: User Story 3 - Simular una ruta de waypoints (Priority: P2)

**Goal**: la misma simulación para rutas, con sus esperas, alturas y acciones.

**Independent Test**: quickstart §3, escenario 10.

- [X] T019 [P] [US3] Ampliar `tests/sim.test.js` para rutas:
  - `missionSeconds` es igual a `duration(mission)` (±1e-6).
  - La parada del WP2 dura 2 + 3 s.
  - Una ruta cerrada termina la parte de misión en el WP1.
  - Con `finishAction: 'autoLand'`, `descend` en el último waypoint y sin vuelta.
  - Con `'noAction'`, `returnsHome` es false.
  - Los `fly` de misión interpolan la altura efectiva de cada waypoint.
- [X] T020 [US3] En `public/js/sim.js`, `buildTimeline` para rutas:
  - Una sola parte.
  - `climb` a la altura efectiva del WP1 y `fly` de ida a `defaults.speed`.
  - En la misión, `fly` con `timing().legs` y `stop` con `timing().stops`.
  - Final según `finishAction`.
- [X] T021 [US3] En `public/js/main.js`, el panel muestra en `#sim-actions` las acciones del waypoint actual durante su parada (`ACTION_LABELS`, y "Esperar N s"). En las áreas muestra "Foto".

**Checkpoint**: todas las historias funcionan.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T022 [P] En `public/ayuda.html`, sección "Punto de despegue y simulación":
  - Despegar desde la "H" planificada o cerca, porque las alturas son relativas al despegue.
  - Cómo usar la simulación.
  - Qué incluye el tiempo por batería.
- [X] T023 [P] En `README.md`, describir el punto de despegue y la simulación.
- [X] T024 Ejecutar quickstart.md §1 a §3 en el navegador. Comprobar la fluidez con 1500 fotos (SC-003) y que un área de 50 ha se ve completa a ×120 en menos de 2 min (SC-004). Revisar que todo el texto nuevo esté en español (FR-011) y corregir los fallos. Pedir al piloto que vea la simulación una vez e identifique el orden de las pasadas y dónde empieza cada parte (SC-005). Anotar el resultado. **Pendiente: comprobación del piloto; la QA automática verificó el resto.**

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)**: bloquea todo.
- **US1 (Phase 3)**: depende de T002 (`timing`) y T004 (`takeoff` en `grid`).
- **US2 (Phase 4)**: depende del reproductor de US1 (T016 y T017).
- **US3 (Phase 5)**: depende de `buildTimeline` (T011) y de `timing()` (T002).
- **Polish (Phase 6)**: al final.
- Las tareas sobre `public/js/main.js` y sobre `public/js/sim.js` son secuenciales dentro de cada archivo.

### Parallel Opportunities

- Phase 2: T003, T005 y T006 en paralelo con T002 y T004.
- US1: T009, T010, T014 y T015 en paralelo con T011 a T013.
- US3: T019 en paralelo con T020.
- Phase 6: T022 y T023.

## Parallel Example: User Story 1

```text
Task: "T009 Pruebas de buildTimeline en áreas en tests/sim.test.js"
Task: "T014 Sección Simulación en public/index.html"
Task: "T015 Estilos del dron y del panel en public/styles.css"
Task: "T011 buildTimeline (áreas) en public/js/sim.js"
```

## Implementation Strategy

1. Phases 1 y 2: el punto de despegue ya aporta valor (inicio de la cuadrícula y exportación
   segura).
2. US1 + US2: simulación completa del área. **STOP and VALIDATE**: quickstart §3,
   escenarios 1 a 9.
3. US3: rutas.
4. Polish.

## Notes

- **[P]** = archivos distintos, sin dependencias pendientes.
- La simulación no escribe en la misión ni en el KMZ (FR-009).
- Commit cuando el piloto lo pida.
