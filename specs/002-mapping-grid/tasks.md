---

description: "Lista de tareas: planificación de vuelos para ortomosaico (cuadrícula de mapeo)"
---

# Tasks: Planificación de vuelos para ortomosaico (cuadrícula de mapeo)

**Input**: Design documents from `specs/002-mapping-grid/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/grid-module.md, quickstart.md

**Tests**: incluidas. La constitución (principio IV) exige pruebas, y SC-003 y SC-004 se
verifican con pruebas automáticas.

**Organization**: tareas agrupadas por historia de usuario.

**Bloqueos**: la Phase 7 reúne las tareas que esperan algo externo: la exportación
verificada (feature 001, T035), una foto real, un vuelo de prueba o un KMZ real con disparo
por intervalo. Todo lo anterior se puede hacer ya.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes).
- **[Story]**: historia de usuario de spec.md (US1…US3).

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 [P] Crear `public/js/grid.js` (research R1, data-model.md) con:
  - `CAMERA` congelado: `dfov: 84` (grados, diagonal), formato 4:3, `width: { 12: 4096, 50: 8192 }` (px; el 4096 lleva el comentario "provisional: confirmar con EXIF, T027") y `minInterval: { 12: 2, 50: 5 }` (s).
  - `MAPPING_LIMITS` congelado: `overlap: { min: 50, max: 90 }`, `partSeconds: 1500`, `partWaypoints: LIMITS.waypoints.max` (importado de `mission.js`) y `maxPhotos: 20000` (FR-019).
  - `emptyArea()` que devuelve `{ type: 'area', name: 'Mapeo', vertices: [], closed: false, params: { height: 60, resolution: 12, frontOverlap: 80, sideOverlap: 70, direction: null, speed: 5, captureMode: 'stop' }, finishAction: 'goHome', onSignalLost: 'lostAction' }`.
- [X] T002 [P] Crear `tests/grid.test.js` con polígonos de prueba reutilizables (cerca de 40,4168 / -3,7038): un cuadrado de unos 100 m de lado, un rectángulo de 200 × 80 m girado 30° y una forma en L. Primera prueba: valores por defecto de `emptyArea()`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase.

- [X] T003 En `public/js/grid.js`, `footprint(height)` → `{ across: 2·h·tan(42°)·4/5, along: 2·h·tan(42°)·3/5 }`, `gsd(height, resolution)` = `100 · across / CAMERA.width[resolution]` (cm/px) y `heightForGsd(gsd, resolution)`, su inversa (research R1).
- [X] T004 En `public/js/grid.js`:
  - Proyección local equirectangular centrada en el polígono (`toLocal` y `toLatLon`, sin exportar) y rotación.
  - `areaHectares(vertices)` con la fórmula del área de Gauss (shoelace) en metros.
  - `isSimple(vertices)`: false si dos lados no contiguos se cruzan.
  - `autoDirection(vertices)`: rumbo 0–179° del lado más largo.
- [X] T005 [P] Ampliar `tests/grid.test.js`:
  - `gsd(60, 12)` ≈ 2,11 y `gsd(60, 50)` ≈ 1,05 (±0,01).
  - `gsd(heightForGsd(1.5, 12), 12)` = 1,5.
  - Área del cuadrado ≈ 1 ha (±1 %).
  - `isSimple` es false para un polígono en forma de lazo (bow-tie).
  - `autoDirection` del rectángulo girado ≈ 30° (±1°).
- [X] T006 [P] En `public/index.html`, añadir arriba del panel un selector de tipo de misión con las opciones "Ruta de waypoints" y "Área de mapeo" (FR-001). Envolver en contenedores separados los bloques exclusivos de cada modo:
  - Solo ruta: lista y editor de waypoints, y altura, velocidad y gimbal por defecto.
  - Solo área: los que se añaden en T011 y T016.
- [X] T007 En `public/js/main.js`:
  - `isMission` acepta `type: 'area'`, con `vertices` como array de `{lat, lon}` finitos y `closed` booleano. `params` es válido si `height`, `speed`, `frontOverlap` y `sideOverlap` son números finitos, `direction` es `null` o un número de 0 a 179, `resolution` es `12` o `50` y `captureMode` es `'stop'` o `'interval'`. Si no, la misión se descarta con el aviso de siempre. Una misión sin `type` se trata como `'route'` (research R8).
  - El selector de tipo, si la misión en curso tiene contenido, pide confirmación antes de sustituirla (spec, Edge Cases). Después crea `emptyMission()` o `emptyArea()`.
  - `commit()` y `render()` dibujan según `mission.type` y ocultan los bloques del otro modo.

**Checkpoint**: `npm test` pasa y se puede cambiar de tipo de misión sin errores.

---

## Phase 3: User Story 1 - Dibujar el área y ver la ruta y los puntos de foto (Priority: P1) 🎯 MVP

**Goal**: polígono editable con la ruta, los puntos de foto, el inicio y el fin, y el resumen.

**Independent Test**: dibujar el cuadrado de 100 m con los valores por defecto y ver la
cuadrícula completa y el resumen (quickstart §3, escenarios 1 a 4).

### Tests for User Story 1

- [X] T008 [P] [US1] Ampliar `tests/grid.test.js` (research R10):
  - `computeGrid` devuelve `null` si el área no está cerrada o si `isSimple` es false.
  - **Cobertura del 100 %** en el cuadrado, el rectángulo girado y la L: una rejilla de puntos cada 2 m dentro del polígono, y cada punto cae en la huella (`across` × `along`, girada según la dirección) de al menos una foto.
  - La distancia entre pasadas vecinas es `across·(1 − sideOverlap/100)` y entre fotos consecutivas de una pasada es `along·(1 − frontOverlap/100)` (tolerancia relativa de 1e-6).
  - Las pasadas alternan de sentido (ida y vuelta).
  - La primera foto está en el extremo más cercano a `vertices[0]`.
  - `stats` tiene `areaHa`, `gsd`, `lines`, `photos` (= `photos.length`), `distance`, `duration` y `batteries` (= `parts.length`).
  - Cada parte tiene como máximo 200 puntos y 1500 s estimados, y las partes concatenadas cubren `photos` sin huecos ni repeticiones (FR-015). Probar con un área grande que necesite varias partes.
  - Un área que necesitaría más de `MAPPING_LIMITS.maxPhotos` fotos (por ejemplo 50 ha a 5 m) devuelve `{ error }` rápido, sin generar los puntos (FR-019).

### Implementation for User Story 1

- [X] T009 [US1] Implementar `computeGrid(area)` en `public/js/grid.js` según research R3 y R4:
  - Dirección `area.params.direction ?? autoDirection(area.vertices)`.
  - Pasadas centradas: `n = max(1, ceil(alto / sep))`.
  - Recorte del polígono por franja `[y − sep/2, y + sep/2]`.
  - Fotos a separación exacta centradas en el tramo: `m = ceil(largo / sep) + 1`.
  - Ida y vuelta, y el inicio más cercano a `vertices[0]`.
  - Antes de generar los puntos, estimar `pasadas · fotos por pasada`. Si supera `MAPPING_LIMITS.maxPhotos`, devolver `{ error: 'Demasiadas fotos (N): sube la altura o reduce el área.' }` (research R3, paso 8).
  - Comentario `// ponytail: en formas cóncavas se fotografía también el hueco; quitar fotos cuya huella no toque el polígono si sobran`.
- [X] T010 [US1] En `computeGrid`, calcular `duration` y `parts` (research R5):
  - Tiempo = tramos / `speed` + `(2 + PHOTO_EXTRA_SECONDS[resolution])` s por foto, con `PHOTO_EXTRA_SECONDS = { 12: 1, 50: 3 }` y el comentario `// ponytail: heurístico; ajustar tras el vuelo de prueba (T028)`.
  - Nueva parte cuando el siguiente punto haría pasar de `MAPPING_LIMITS.partSeconds` o de `MAPPING_LIMITS.partWaypoints`.
  - `stats.batteries = parts.length`.
- [X] T011 [P] [US1] En `public/index.html`, bloque solo de área:
  - Resumen: Área (ha), GSD (cm/px), Pasadas, Fotos, Distancia, Tiempo y Baterías. Junto a Baterías, la nota "25 min de mapeo por batería, sin contar ida y vuelta".
  - Pista "Marca los vértices del área y haz clic en el primero para cerrarla. Los vértices no se vuelan."
  - Botón "Borrar vértice".
- [X] T012 [P] [US1] En `public/styles.css`: vértices cuadrados (`.vx-icon`), marcadores de punto medio (`.mid-icon`, pequeños y semitransparentes), etiquetas "Inicio", "Fin" y "P2…" (`.flag`) y un color distinto por parte en la ruta.
- [X] T013 [US1] En `public/js/main.js`, edición del área (FR-002, FR-003):
  - Clic en el mapa con el área abierta: añade un vértice.
  - Clic en el vértice 1 con 3 o más: cierra (`closed = true`).
  - Clic en otro vértice: lo selecciona.
  - Vértices arrastrables.
  - Marcador en el centro de cada lado del área cerrada: al hacer clic inserta un vértice ahí.
  - "Borrar vértice" borra el seleccionado; con menos de 3 vértices, `closed = false`.
  - Todo cambio llama a `commit()`, que guarda en `localStorage` (FR-016).
- [X] T014 [US1] En `public/js/main.js`, dibujo de la cuadrícula (FR-005, FR-006, FR-008, FR-009):
  - `L.polygon` del área.
  - Ruta con una `L.polyline` por parte, con colores alternos.
  - Puntos de foto como `L.circleMarker` de radio 3 con un único `L.canvas()` compartido.
  - Etiquetas "Inicio", "Fin" y "P2…" en el inicio de cada parte.
  - Resumen y aviso cuando `batteries > 1` (FR-010).
  - Si `isSimple` es false: mensaje "El área no es válida: dos lados se cruzan" y sin ruta (FR-004).
  - Si `computeGrid` devuelve `{ error }`: mostrar el mensaje y no dibujar la ruta ni los puntos (FR-019).

**Checkpoint**: US1 funciona en local (quickstart §3, escenarios 1 a 4).

---

## Phase 4: User Story 2 - Ajustar los parámetros del mapeo (Priority: P2)

**Goal**: altura o GSD, resolución, solapes, dirección y velocidad con recálculo al instante.

**Independent Test**: quickstart §3, escenarios 5 a 9.

- [X] T015 [P] [US2] Ampliar `tests/grid.test.js`:
  - Subir el solape lateral de 70 a 80 aumenta `lines`; subir el frontal aumenta `photos`.
  - Pasar a `resolution: 50` divide el GSD a la mitad (±0,01) y aumenta `duration`.
  - `direction: 90` frente a `direction: 0` gira 90° el rumbo de la primera pasada (±0,5°).
- [X] T016 [P] [US2] En `public/index.html`, formulario de mapeo (FR-007, FR-014):
  - Altura (m).
  - GSD objetivo (cm/px, `step="0.01"`).
  - Resolución en un `<select>` con 12 MP y 50 MP, más el recordatorio "Pon la misma resolución en la cámara de DJI Fly".
  - Solape frontal y lateral (%, `min="50" max="90" step="1"`).
  - Dirección: casilla "Automática" y número de 0 a 179°.
  - Velocidad (m/s).
  - Modo de disparo con dos opciones: "Parada con foto" (marcada) y "Disparo por intervalo" (`disabled`), con el texto "Disponible cuando se verifique con un KMZ real que DJI Fly lo respeta."
- [X] T017 [US2] En `public/js/main.js`, enlazar el formulario con `mission.params`:
  - Rangos `min` y `max` de altura y velocidad desde `LIMITS`, y de los solapes desde `MAPPING_LIMITS`.
  - Al escribir un GSD, guardar `height = heightForGsd(gsd, resolution)`.
  - La casilla "Automática" pone `direction = null`.
  - Cada cambio llama a `commit()` y no pisa el campo con foco (`setValue`).
  - Mostrar en el campo GSD el valor calculado cuando no tiene el foco.

**Checkpoint**: US1 y US2 funcionan juntas.

---

## Phase 5: User Story 3 - Exportar el área como misión de DJI Fly (Priority: P2)

**Goal**: una `Mission` de la feature 001 por parte, validada, con un enlace de descarga por parte.

**Independent Test**: escenario 11 de quickstart §3 (antes de T035: mensaje de bloqueo) y las pruebas de T018.

- [X] T018 [P] [US3] Ampliar `tests/grid.test.js` para `toMissions(area, grid)`. Usar `globalThis.DOMParser` de `@xmldom/xmldom` y el perfil sintético de `tests/wpml.test.js`. Casos:
  - Una `Mission` por parte, con `defaults = { height, speed, gimbalPitch: -90 }`.
  - Cada waypoint con `actions: [{ type: 'photo' }]` y el resto de campos a `null`.
  - `finishAction: 'goHome'` en las partes intermedias y `area.finishAction` en la última.
  - `onSignalLost` copiado del área.
  - Nombres `"<nombre> parte k de N"`, o `"<nombre>"` si hay una sola parte.
  - Cada parte pasa `validate()` sin errores y la ida y vuelta `buildFiles`→`zip`→`unzip`→`parseMission` conserva sus puntos.
- [X] T019 [US3] Implementar `toMissions(area, grid)` en `public/js/grid.js` (data-model.md, "Missions de exportación"). No usar ningún tipo de acción que no exista ya en la feature 001.
- [X] T020 [US3] En `public/js/main.js`, exportación en modo área:
  1. Bloqueo `WPML_VERIFIED`, con el mismo mensaje que la feature 001.
  2. `computeGrid` nulo: "Cierra un área válida antes de exportar".
  3. `validate()` de cada parte. Los errores se listan con el prefijo "Parte k:".
  4. Sin perfil: mismo mensaje y enlace que la feature 001.
  5. Avisos agrupados: uno por tipo, no uno por waypoint. Pedir `confirm()`.
  6. Mostrar un enlace de descarga por parte (`<nombre>-parte-k-de-N.kmz`, o `<nombre>.kmz` si hay una sola) y el enlace a `ayuda.html#ortomosaico`.
- [X] T021 [US3] En `public/index.html` y `public/js/main.js`, el formulario de misión muestra en los dos modos el nombre, "Al terminar" y "Si se pierde la señal". En el modo área, "Al terminar" lleva la nota "Solo en la última parte; las demás vuelven a casa para cambiar la batería".

**Checkpoint**: todas las historias funcionan en local; la exportación real espera a la Phase 7.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T022 [P] En `public/ayuda.html`, nueva sección `#ortomosaico` (FR-017):
  - Ajustes de cámara: la misma resolución elegida en flyplan, formato 4:3, JPEG (o JPEG + DNG), enfoque manual a infinito, velocidad de obturación de 1/1000 s o más rápida si hay luz, ISO bajo y balance de blancos fijo.
  - Por qué se recomienda "Parada con foto": el Air 3S no tiene obturador mecánico.
  - Cómo volar varias partes: una misión ficticia en DJI Fly por parte, cambio de batería al volver a casa y empezar la parte siguiente.
- [X] T023 [P] En `README.md`, describir el modo "Área de mapeo".
- [X] T024 En el navegador, medir el recálculo y el dibujo de un área de 50 ha: debe tardar menos de 0,5 s (SC-002). Si no, optimizar `computeGrid` o el dibujo en `public/js/main.js`.
- [X] T025 Ejecutar quickstart.md §1 a §3, corregir los fallos y revisar que no quede texto en inglés (FR-018). Cronometrar dibujar un área de 4 a 6 vértices hasta ver la ruta completa: menos de 1 minuto (SC-001). **Pendiente: cronometraje por el piloto; la QA automática comprobó el flujo.**

---

## Phase 7: Verificación con datos reales (BLOQUEADA)

- [ ] T026 [US3] **[BLOQUEADA: feature 001 T035]** Exportar un área pequeña y otra dividida en partes, instalarlas en DJI Fly y comprobar que la vista previa coincide (SC-005). Anotar el resultado en `specs/002-mapping-grid/checklists/vuelo-prueba.md`.
- [ ] T027 **[BLOQUEADA: foto real]** Leer el ancho en el EXIF de una foto de 12 MP del Air 3S y ajustar `CAMERA.width[12]` en `public/js/grid.js` y la tabla de research.md R1.
- [ ] T028 **[BLOQUEADA: vuelo de prueba]** Volar un área de 1 ha o menos. El número de fotos debe diferir menos de un 5 % del planificado y el ortomosaico no debe tener huecos (SC-006). Ajustar `PHOTO_EXTRA_SECONDS` con el tiempo real y anotarlo en `checklists/vuelo-prueba.md`.
- [ ] T029 [US2] **[BLOQUEADA: KMZ real con disparo por intervalo]** Activar el modo "Disparo por intervalo":
  - Waypoints solo en los extremos de las pasadas, más una acción `multipleDistance` con la forma XML copiada del KMZ real.
  - Aviso de FR-011: `v_max = separación entre fotos / CAMERA.minInterval[resolution]`.
  - Pruebas en `tests/grid.test.js`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de la Phase 1 y bloquea todas las historias.
- **US1 (Phase 3)**: depende de la Phase 2.
- **US2 (Phase 4)**: depende de `computeGrid` (T009 y T010).
- **US3 (Phase 5)**: depende de `computeGrid` y reutiliza la exportación de la feature 001.
- **Polish (Phase 6)**: depende de las historias que se entreguen.
- **Phase 7**: depende de datos externos; cada tarea puede hacerse en cuanto llegue lo suyo.

### Within Each User Story

- Las pruebas se escriben antes y deben fallar antes de implementar.
- `grid.js` antes de `main.js`.
- Las tareas sobre `public/js/main.js` son secuenciales, porque es el mismo archivo.

### Parallel Opportunities

- Phase 1: T001 y T002.
- Phase 2: T005 y T006 en paralelo con T003 y T004.
- US1: T008, T011 y T012 en paralelo con T009 y T010.
- US2: T015 y T016 en paralelo.
- US3: T018 en paralelo con T019.
- Phase 6: T022 y T023.

---

## Parallel Example: User Story 1

```text
Task: "T008 Pruebas de cobertura, separaciones y partes en tests/grid.test.js"
Task: "T011 Resumen y pista del área en public/index.html"
Task: "T012 Estilos de vértices, etiquetas y partes en public/styles.css"
Task: "T009 computeGrid en public/js/grid.js"
```

---

## Implementation Strategy

### MVP (US1)

1. Phases 1 y 2.
2. Phase 3: ya se ve la ruta, los puntos de foto y el resumen. Es útil para planificar
   aunque todavía no se pueda exportar.
3. **STOP and VALIDATE**: quickstart §3, escenarios 1 a 4.

### Incremental

1. US2: parámetros.
2. US3: exportación por partes (bloqueada como la feature 001 hasta T035).
3. Phase 6.
4. Phase 7 a medida que lleguen el KMZ real, la foto y el vuelo de prueba.

---

## Notes

- **[P]** = archivos distintos, sin dependencias pendientes.
- Sin campos WPML nuevos hasta T029 (constitución I).
- Commit tras cada tarea o grupo lógico, cuando el piloto lo pida.
