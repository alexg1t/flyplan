---

description: "Lista de tareas: editor de misiones waypoint con exportación KMZ para DJI Fly"
---

# Tasks: Editor de misiones waypoint con exportación KMZ para DJI Fly

**Input**: Design documents from `specs/001-waypoint-kmz-editor/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: incluidas. La constitución (principio IV) exige pruebas de ida y vuelta, contra el
fixture real y de casos límite.

**Organization**: tareas agrupadas por historia de usuario.

**Fixture pendiente**: `fixtures/referencia-air3s.kmz` llega en una próxima sesión. Todas las
tareas que dependen de él están marcadas **[BLOQUEADA: fixture]** (o **[BLOQUEADA: datos del
piloto]**) y agrupadas en la Phase 8, al final. Todo lo anterior se puede hacer sin el
fixture.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes).
- **[Story]**: historia de usuario de spec.md (US1…US4).
- Rutas relativas a la raíz del repositorio (estructura de plan.md).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: esqueleto del proyecto.

- [X] T001 Crear `package.json` en la raíz con `"name": "flyplan"`, `"private": true`, `"type": "module"` y el script `"test": "node --test tests/"`. Ejecutar `npm install -D @xmldom/xmldom` (única dependencia, solo de desarrollo; research R8).
- [X] T002 [P] Crear `.gitignore` en la raíz con `node_modules/`.
- [X] T003 [P] Crear `public/index.html` con `lang="es"`. Debe cargar Leaflet 1.9.4 (CSS y JS) desde cdnjs con versión exacta e `integrity` (SRI). Contenido: cabecera con el título "flyplan" y un enlace a `ayuda.html`, `<div id="map">`, `<aside id="panel">` y `<script type="module" src="js/main.js">`. Incluir un aviso permanente (FR-017): "flyplan no sustituye tu criterio como piloto, la comprobación del espacio aéreo ni la revisión de la misión en DJI Fly antes de despegar."
- [X] T004 [P] Crear `public/styles.css`. Mapa a la izquierda con toda la altura; panel a la derecha de unos 360 px; en pantallas estrechas, panel debajo del mapa. Sin framework CSS.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: lógica pura y base de la interfaz que usan todas las historias.

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase.

- [X] T005 [P] Implementar `zip(files)` y `unzip(bytes)` en `public/js/kmz.js` según `contracts/modules.md` y research R7:
  - `zip`: entradas sin compresión (método 0), CRC32, nombres y contenido en UTF-8, cabeceras locales, directorio central y EOCD. Devuelve `Uint8Array`.
  - `unzip`: lee el directorio central. Acepta el método 0 y el método 8 (`DecompressionStream('deflate-raw')`). Devuelve `{ [ruta]: string }`. Ante cualquier otro caso lanza `Error('El archivo no es un KMZ válido')`.
- [X] T006 [P] Crear `tests/kmz.test.js` y `tests/data/deflate.kmz`. El archivo de datos se genera una vez, comprimido con deflate, con `python -c "import zipfile; z=zipfile.ZipFile('tests/data/deflate.kmz','w',zipfile.ZIP_DEFLATED); z.writestr('wpmz/waylines.wpml','Misión ñ'); z.close()"`. No usar `Compress-Archive`: en Windows PowerShell 5.1 guarda las rutas con barra invertida. Casos de prueba:
  - `zip`→`unzip` con acentos devuelve lo mismo.
  - `unzip` de `tests/data/deflate.kmz` devuelve el texto exacto.
  - `unzip` de bytes aleatorios lanza el error en español.
- [X] T007 [P] En `public/js/mission.js`:
  - `LIMITS` como objeto congelado, con los valores literales de data-model.md: `waypoints: { min: 2, max: 200 }`, `height: { min: 2, max: 500, warnAbove: 120 }`, `speed: { min: 1, max: 15 }`, `gimbalPitch: { min: -90, max: 0 }`, `waitSeconds: { min: 1, max: 30 }`, `minSegment: 1`, `warnDuration: 2100`.
  - `emptyMission()` con `name: "Misión"`, `defaults: { height: 50, speed: 5, gimbalPitch: -30 }`, `finishAction: "goHome"`, `onSignalLost: "lostAction"` y `waypoints: []`.
  - `effective(mission, wp, field)` = `wp[field] ?? mission.defaults[field]`.
- [X] T008 Implementar `distance(mission)` y `duration(mission)` en `public/js/mission.js` (research R10):
  - Distancia horizontal con haversine (R = 6 371 008,8 m); tramo = √(horizontal² + Δaltura²).
  - Tiempo = Σ (tramo / velocidad efectiva del waypoint de origen) + 2 s por waypoint + Σ esperas.
  - Comentario `// ponytail: 2 s por parada es heurístico; ajustar comparando con DJI Fly`.
- [X] T009 Implementar `validate(mission)` en `public/js/mission.js`. Devuelve `{ errors, warnings }` con `Issue = { waypoint, field, value, limit, message }` (data-model.md).
  - **Errores:**
    - número de waypoints fuera de 2–200;
    - altura, velocidad o gimbal efectivos fuera de `LIMITS`;
    - espera fuera de 1–30 s;
    - dos waypoints consecutivos a menos de 1 m;
    - nombre con menos de 1 o más de 60 caracteres.
  - **Avisos:**
    - altura efectiva > 120 m. El mensaje dice que es respecto al punto de despegue y que no tiene en cuenta el relieve del terreno (FR-012).
    - `duration` > 2100 s.
  - Mensajes en español con el número visible del waypoint (1…n) y el valor.
- [X] T010 [P] Crear `tests/mission.test.js`:
  - `effective` hereda solo cuando el campo es `null` (US2, escenario 4).
  - `distance` entre dos puntos separados 0,001° de latitud ≈ 111,2 m (±0,5 m).
  - `duration` de una misión conocida.
  - Cada límite de `LIMITS`, justo dentro y justo fuera.
  - Aviso de 120 m y aviso de 35 min.
  - Tramo menor de 1 m.
  - Misión con menos de 2 waypoints.
- [X] T011 Crear la base de `public/js/main.js` (depende de T007 y T008):
  - Mapa Leaflet con teselas `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` y atribución "Tiles © Esri".
  - Estado `mission`.
  - `render()`: marcadores numerados con `L.divIcon`, polilínea en orden y distancia (km) y tiempo (mm:ss) en el panel.
  - `save()` y `load()` en `localStorage['flyplan.mission']` con `try/catch`. Un JSON corrupto se descarta con aviso y se empieza con `emptyMission()` (FR-014).
  - Si las teselas fallan, aviso "Sin conexión: el mapa no carga, tu misión no se pierde".

**Checkpoint**: `npm test` pasa con `kmz` y `mission`; el mapa carga y recupera la misión guardada.

---

## Phase 3: User Story 1 - Diseñar una misión y exportarla para DJI Fly (Priority: P1) 🎯 MVP

**Goal**: clic en el mapa, cargar el KMZ de referencia y exportar un KMZ validado.

**Independent Test**: crear 5 waypoints, exportar, instalar en DJI Fly y ver los 5 puntos en el mismo sitio y orden. La parte que necesita DJI Fly está en la Phase 8.

### Tests for User Story 1

- [X] T012 [P] [US1] Crear `tests/wpml.test.js`. Primera línea: `globalThis.DOMParser ??= (await import('@xmldom/xmldom')).DOMParser`. Usar un perfil sintético solo de prueba (`namespace: 'http://www.uav.com/wpmz/1.0.2'`, enums 0/0, con un comentario que diga que no es un valor real). Casos:
  - Ida y vuelta `buildFiles`→`zip`→`unzip`→`parseMission(files, name)`. Compara `name`, `defaults`, `finishAction`, `onSignalLost` y los **valores efectivos** de cada waypoint (posición, altura, velocidad, gimbal, rumbo y acciones), no qué campos eran `null`. La misión de prueba incluye campos heredados, las 4 acciones, rumbo `null` y numérico, y un cambio de gimbal entre waypoints.
  - `buildFiles` funciona en las pruebas aunque `WPML_VERIFIED` sea `false`.
  - Escape del nombre `A & <B> "c"`.
  - `wpml:index` contiguos desde 0.
  - `wpml:actionId` desde 1.
  - Namespace tomado del perfil.
  - `buildFiles` sin perfil lanza error.
  - `parseProfile` rechaza un KMZ sin `wpml:droneInfo` o con otro namespace, con mensaje en español (FR-009).

### Implementation for User Story 1

- [X] T013 [US1] Implementar `buildFiles(mission, profile, now = Date.now())` en `public/js/wpml.js` siguiendo `contracts/kmz-dji-fly.md`. Devuelve `{ 'wpmz/template.kml', 'wpmz/waylines.wpml' }`.
  - XML con plantillas de texto y escape de `& < > " '`.
  - Coordenadas `lon,lat` con 6 decimales; alturas y velocidades con 1 decimal.
  - Rumbo 0…359 convertido a −180…180.
  - `gimbalRotate` solo cuando cambia el pitch.
  - Los elementos marcados **[F]** usan provisionalmente la forma de la especificación DJI WPML (Cloud API). Cada uno lleva el comentario `// PROVISIONAL [F]: confirmar con fixtures/referencia-air3s.kmz`.
  - Sin valores de dron por defecto (constitución I).
  - `export const WPML_VERIFIED = false` con el comentario `// Solo T035 lo pasa a true, cuando todos los [F] coinciden con el fixture real`.
- [X] T014 [US1] Implementar `parseMission(files, name)` en `public/js/wpml.js` según la sección "Lectura" de `contracts/kmz-dji-fly.md`:
  - Waypoints desde `wpmz/waylines.wpml` con `getElementsByTagName('wpml:…')`, sin `querySelector`.
  - `name` = parámetro (nombre del archivo sin `.kmz`).
  - `defaults.height` = `wpml:globalHeight` de `template.kml`; `defaults.speed` = `wpml:autoFlightSpeed` de `template.kml` (o de `waylines.wpml`); `defaults.gimbalPitch` = pitch del primer `gimbalRotate`. Si falta alguno, el de `emptyMission()`.
  - `gimbalRotate` → `gimbalPitch`, arrastrado a los waypoints siguientes hasta el próximo `gimbalRotate`.
  - `takePhoto` → `photo`, `startRecord` → `startVideo`, `stopRecord` → `stopVideo`, `hover` → `wait` (`seconds` = `wpml:hoverTime`).
  - Un valor igual al valor por defecto de la misión se carga como `null`.
  - Acciones desconocidas van a `warnings`.
  - Si falta `wpmz/waylines.wpml`, lanza `Error('El archivo no contiene una misión de DJI Fly')`.
- [X] T015 [US1] Implementar `parseProfile(files)` en `public/js/wpml.js`. Devuelve `DroneProfile` (`namespace`, `author`, `droneEnumValue`, `droneSubEnumValue`, `payloadInfo` o `null`, `loadedAt`). Lanza un error en español si falta `wpml:droneInfo` o si el namespace no es el de DJI Fly; el mensaje muestra el namespace y el par enum/subenum detectados (FR-009).
- [X] T016 [P] [US1] Añadir a `public/index.html`:
  - campo de búsqueda;
  - botones "Cargar KMZ de referencia" y "Exportar KMZ";
  - `<input type="file" accept=".kmz" hidden>`;
  - zona de estadísticas;
  - zona de mensajes con `aria-live="polite"`.
- [X] T017 [US1] En `public/js/main.js`:
  - Un clic en el mapa añade un waypoint con `height`, `speed`, `gimbalPitch` y `heading` a `null` y `actions: []`. Después llama a `render()` y `save()`.
  - Si ya hay `LIMITS.waypoints.max` waypoints, no añade ninguno y muestra "Máximo 200 waypoints por misión (límite de DJI Fly)" (spec, Edge Cases).
  - Búsqueda (FR-001), solo al pulsar Enter. Placeholder del campo: "Lugar o coordenadas: 40.4168, -3.7038".
    - Si el texto cumple `^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$` (punto decimal) y la latitud está entre −90 y 90 y la longitud entre −180 y 180, centra el mapa en esas coordenadas sin usar la red. Si está fuera de rango, muestra "Coordenadas fuera de rango".
    - Si no, hace una sola petición a `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=…`. Sin resultado, muestra "Lugar no encontrado".
- [X] T018 [US1] En `public/js/main.js`, flujo "Cargar KMZ de referencia": `unzip` → `parseProfile` → muestra el namespace y el par enum/subenum → pide confirmar "¿Este KMZ lo exportaste de tu Air 3S?" → guarda en `localStorage['flyplan.droneProfile']`. Los errores se muestran en la zona de mensajes (FR-008, research R3).
- [X] T019 [US1] En `public/js/main.js`, flujo "Exportar KMZ" (estados de data-model.md):
  0. Si `WPML_VERIFIED` es `false`, bloquear con "Exportación desactivada hasta verificar el formato con tu KMZ real de DJI Fly" y enlace a `ayuda.html#referencia` (constitución I).
  1. `validate()`. Si hay errores, bloquear y listarlos; un clic en un error selecciona su waypoint (FR-011).
  2. Sin perfil, mostrar mensaje y enlace a `ayuda.html#referencia`.
  3. Si hay avisos, pedir `confirm()` con todos los avisos (FR-012).
  4. `zip(buildFiles(...))` → `Blob` de tipo `application/vnd.google-earth.kmz` → descarga `<nombre>.kmz`.
  5. Mostrar el enlace a `ayuda.html#transferir`.

**Checkpoint**: US1 funciona en local y `npm test` pasa. La exportación sigue siendo provisional hasta la Phase 8.

---

## Phase 4: User Story 2 - Ajustar waypoints y parámetros de misión (Priority: P2)

**Goal**: editar puntos, acciones y valores globales, con distancia y tiempo en vivo.

**Independent Test**: cambiar los parámetros de un waypoint y los globales, exportar y comprobar los valores en DJI Fly (Phase 8). Sin DJI Fly: escenarios 6 y 7 de quickstart §4.

- [X] T020 [P] [US2] Añadir a `public/index.html`:
  - Lista de waypoints `<ol>`.
  - Formulario de waypoint:
    - altura, velocidad y gimbal, cada uno con la casilla "Usar valor de la misión";
    - rumbo con las opciones "Seguir la ruta" o "Ángulo fijo" (número 0–359);
    - lista de acciones con los botones "Foto", "Empezar vídeo", "Parar vídeo" y "Esperar N s".
  - Formulario de misión:
    - nombre (`maxlength="60"`);
    - altura, velocidad y gimbal por defecto;
    - "Al terminar": Volver a casa, Aterrizar o Quedarse en el sitio;
    - "Si se pierde la señal": Continuar la misión o Volver a casa (RTH).
- [X] T021 [US2] En `public/js/main.js`, marcadores arrastrables: `dragend` actualiza `lat`/`lon`, `render()` y `save()`. La línea, la distancia y el tiempo se actualizan al instante.
- [X] T022 [US2] En `public/js/main.js`, lista de waypoints: seleccionar, borrar, subir y bajar. Al cambiar el orden se renumeran.
- [X] T023 [US2] En `public/js/main.js`, enlazar el formulario de waypoint. Marcar la casilla "Usar valor de la misión" guarda `null`. Rumbo: "Seguir la ruta" guarda `null`; "Ángulo fijo" guarda un número de 0 a 359.
- [X] T024 [US2] En `public/js/main.js`, editor de acciones (FR-004a):
  - Añadir una acción con un clic. "Esperar" pide los segundos, de 1 a 30.
  - Quitar una acción y subirla o bajarla en la lista.
- [X] T025 [US2] En `public/js/main.js`, enlazar el formulario de misión:
  - `finishAction`: `goHome`, `autoLand` o `noAction`.
  - `onSignalLost`: `continue` ("Continuar la misión") o `lostAction` ("Volver a casa (RTH)").
  - Valores por defecto.
  - Cada cambio llama a `render()` y `save()`.

- [X] T039 [US2] Cerrar la ruta (FR-002a), pedido por el piloto tras probar un cuadrado: `isClosed()` y `closeRoute()` en `public/js/mission.js` con pruebas en `tests/mission.test.js`. En `public/js/main.js`, un clic en el waypoint 1 con 3 o más waypoints cierra la ruta; en una ruta cerrada se muestra un solo marcador "1/n" que mueve los dos waypoints. Pista en `public/index.html` (`#route-hint`).

**Checkpoint**: US1 y US2 funcionan juntas en local.

---

## Phase 5: User Story 3 - Abrir y editar un KMZ existente de DJI Fly (Priority: P2)

**Goal**: cargar un KMZ de DJI Fly como misión editable.

**Independent Test**: abrir un KMZ, exportarlo sin cambios y obtener la misma misión. La prueba con un KMZ real está en T036.

- [X] T026 [P] [US3] Ampliar `tests/wpml.test.js` con estos casos de `parseMission`:
  - un KMZ sin `wpmz/waylines.wpml` lanza el error en español;
  - una acción desconocida (por ejemplo `zoom`) genera un aviso y no rompe la carga;
  - un valor igual al valor por defecto se carga como `null`;
  - el gimbal de un `gimbalRotate` se arrastra a los waypoints siguientes hasta el próximo `gimbalRotate`;
  - `hover` se carga como `wait` con sus segundos.
- [X] T027 [US3] Añadir los botones "Abrir KMZ" y "Nueva misión" en `public/index.html`, con su lógica en `public/js/main.js`:
  - Si la misión en curso tiene waypoints, pedir confirmación antes de sustituirla (FR-018).
  - Ante un error, mostrar el mensaje y no tocar la misión actual (US3, escenario 3).
  - Mostrar los avisos de `parseMission`.

**Checkpoint**: US1, US2 y US3 funcionan en local.

---

## Phase 6: User Story 4 - Guía de transferencia al móvil (Priority: P3)

**Goal**: página de ayuda en español para Android e iOS.

**Independent Test**: escenario 10 de quickstart §4.

- [X] T028 [P] [US4] Crear `public/ayuda.html` (`lang="es"`, usa `styles.css`, enlace de vuelta al editor). Secciones:
  - `#referencia`: cómo crear la misión de referencia y exportar su KMZ (quickstart §1).
  - `#transferir`: dentro de un `<details>` para Android y otro para iOS:
    - crear la misión ficticia;
    - ruta de la carpeta: Android `Android/data/dji.go.v5/files/waypoint/<GUID>/` por USB desde el PC; iOS Archivos > DJI Fly > `wayline_mission/<GUID>/`;
    - renombrar el KMZ como el original y sustituirlo;
    - reiniciar DJI Fly;
    - no volver a guardar la misión en DJI Fly antes de volar (research, riesgos abiertos).
  - Recordatorio de comprobar el espacio aéreo (por ejemplo con ENAIRE Drones).
  - Aviso FR-017.

**Checkpoint**: todas las historias funcionan en local. Falta la verificación con el KMZ real.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T029 [P] Crear `README.md` en español: qué es flyplan, cómo arrancarlo en local (`python -m http.server 8000 -d public`), cómo pasar las pruebas (`npm test`), cómo publicarlo y enlace a `public/ayuda.html`.
- [X] T030 [P] Crear `.github/workflows/pages.yml` para publicar `public/` en GitHub Pages en cada push a `main` (`actions/upload-pages-artifact` con `path: public` y `actions/deploy-pages`). Cumple FR-019.
- [X] T031 Probar el rendimiento con 200 waypoints en `public/js/main.js`: arrastrar sin retardo apreciable. Si va lento, que `render()` actualice solo el marcador cambiado y la polilínea.
- [X] T032 Ejecutar quickstart.md §2–§4 (escenarios sin fixture) y corregir los fallos. Además:
  - Cronometrar crear 10 waypoints y llegar al botón de exportar: menos de 5 minutos (SC-001; la descarga real se comprueba en T038). **Pendiente: cronometraje por el piloto; la QA automática solo comprobó el flujo.**
  - Revisar que no queda texto en inglés en `index.html`, `ayuda.html` ni en los mensajes de `main.js`, `mission.js`, `wpml.js` y `kmz.js` (FR-016).

---

## Phase 8: Verificación con el KMZ real (BLOQUEADA hasta recibir el fixture)

**Purpose**: confirmar los elementos provisionales **[F]**, los valores del dron y los límites. Sin esta fase, US1 no puede darse por terminada (constitución I y flujo de desarrollo).

- [ ] T033 [US1] **[BLOQUEADA: fixture]** Guardar el KMZ del piloto como `fixtures/referencia-air3s.kmz` (misión de 4 o 5 waypoints de quickstart §1, instructivo v2). Descomprimirlo y anotar en research.md R2 y R3 el namespace, `wpml:author`, `droneEnumValue`, `droneSubEnumValue`, `payloadInfo` y los campos de `missionConfig`. Cambiar su estado a "Verificado".
- [ ] T034 [P] [US1] **[BLOQUEADA: fixture]** Añadir a `tests/kmz.test.js` una prueba: `unzip` del fixture devuelve `wpmz/template.kml` y `wpmz/waylines.wpml`. Si falta el archivo, la prueba se marca como `skip` con el mensaje "falta fixtures/referencia-air3s.kmz".
- [ ] T035 [US1] **[BLOQUEADA: fixture]** Ajustar los elementos **[F]** de `public/js/wpml.js` para que coincidan exactamente con el fixture:
  - campos de `missionConfig`;
  - parámetros de `takePhoto`, `startRecord`, `stopRecord`, `hover` y `gimbalRotate`;
  - modo de rumbo fijo;
  - `Placemark` de `template.kml`.

  Después:
  - Poner `WPML_VERIFIED = true` en `public/js/wpml.js`.
  - Quitar los comentarios `PROVISIONAL`.
  - Quitar las marcas **[F]** de `contracts/kmz-dji-fly.md`.
  - Si el fixture tiene más valores propios del dron, añadirlos a `parseProfile` y a data-model.md.
- [ ] T036 [US1] **[BLOQUEADA: fixture]** Añadir a `tests/wpml.test.js` pruebas con el fixture. Si falta el archivo, `skip` con el mismo mensaje. Casos:
  - Valores de `parseProfile`.
  - `parseMission` devuelve 4 o 5 waypoints con sus acciones, la altura de 70 m del WP2 y, si DJI Fly la permite, la velocidad de 3 m/s del WP3.
  - El conjunto de rutas de elementos de `buildFiles(parseMission(fixture), perfil)` es igual al del fixture en `missionConfig`, `Folder` y `Placemark`.
  - Cada acción tiene la misma forma XML que en el fixture.
  - Abrir el fixture y exportarlo sin cambios conserva el 100 % de los waypoints y parámetros (SC-004).
- [ ] T037 [US1] **[BLOQUEADA: datos del piloto]** Actualizar `LIMITS` en `public/js/mission.js` con los mínimos y máximos que el piloto anotó en DJI Fly. Actualizar la tabla de research.md R4 y los valores límite de `tests/mission.test.js`.
- [ ] T038 **[BLOQUEADA: fixture]** Gate de la constitución (quickstart §5): instalar en DJI Fly 3 misiones exportadas (simple, con todas las acciones, con rumbos y gimbal por punto). Anotar en `specs/001-waypoint-kmz-editor/checklists/dji-fly-gate.md`, para cada misión: si se abre, si la vista previa coincide y la diferencia de distancia frente a DJI Fly (debe ser menor del 5 %, SC-006). Además, seguir `ayuda.html` desde cero en el móvil disponible y cronometrar la transferencia: menos de 10 minutos (SC-005). Anotar la otra plataforma (Android o iOS) como pendiente en el mismo archivo.

**Checkpoint**: feature terminada. Siguiente: `/speckit-converge`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de la Phase 1 y bloquea todas las historias.
- **US1 (Phase 3)**: depende de la Phase 2.
- **US2 (Phase 4)**: depende de la Phase 2. Para el render usa la base de `main.js` de T011 y T017, pero se prueba por separado.
- **US3 (Phase 5)**: depende de `parseMission` (T014).
- **US4 (Phase 6)**: no depende de nada; puede hacerse en cualquier momento.
- **Polish (Phase 7)**: depende de las historias que se quieran entregar.
- **Verificación (Phase 8)**: depende de recibir el fixture y de T013–T015. T037 depende de los datos del piloto. T038 va al final.

### Within Each User Story

- Las pruebas se escriben antes y deben fallar antes de implementar.
- `wpml.js` (T013 → T014 → T015) antes de los flujos de `main.js` (T018, T019).
- Las tareas sobre `public/js/main.js` son secuenciales: todas tocan el mismo archivo.

### Parallel Opportunities

- Phase 1: T002, T003 y T004.
- Phase 2: T005, T006, T007 y T010 (archivos distintos).
- US1: T012 y T016 en paralelo con T013–T015.
- US2: T020 en paralelo con las tareas de `main.js` de US1.
- US4: T028 en cualquier momento.
- Phase 7: T029 y T030.
- Phase 8: T034 en paralelo con T035.

---

## Parallel Example: User Story 1

```text
Task: "T012 Pruebas de ida y vuelta y de parseProfile en tests/wpml.test.js"
Task: "T016 Markup de búsqueda, botones y mensajes en public/index.html"
Task: "T013 buildFiles en public/js/wpml.js"
```

---

## Implementation Strategy

### Sesión actual (sin fixture)

1. Phase 1 y Phase 2.
2. Phase 3 (US1) con la exportación provisional.
3. Phases 4, 5 y 6 (US2, US3, US4).
4. Phase 7 (T029–T032).

Resultado: la app completa funciona en local y `npm test` pasa. Las pruebas del fixture
quedan en `skip`.

### Próxima sesión (con fixture)

1. Phase 8: T033 → T034/T035 → T036 → T037 → T038.
2. **STOP and VALIDATE**: el gate de DJI Fly (T038) cierra US1 y la feature.
3. Publicar (T030) y `/speckit-converge`.

---

## Notes

- **[P]** = archivos distintos y sin dependencias pendientes.
- **[BLOQUEADA: …]** = no se empieza hasta tener el fixture o los datos del piloto.
- Commit tras cada tarea o grupo lógico.
- Nunca poner valores de dron por defecto en el código (constitución I), tampoco "temporalmente".
