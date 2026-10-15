# Research: Editor de misiones waypoint con exportación KMZ para DJI Fly

**Feature**: `001-waypoint-kmz-editor` | **Date**: 2026-10-15

Estado de cada decisión: **Verificado** (fuente fiable o KMZ real), **Provisional** (fuentes
de comunidad coherentes; se confirma con el KMZ de referencia del piloto antes de cerrar la
feature).

## R1. Vía de entrega al dron

- **Decision**: flyplan genera un KMZ. El piloto lo copia al móvil y sustituye el KMZ de una
  misión ficticia creada en DJI Fly. Rutas:
  - Android: `Android/data/dji.go.v5/files/waypoint/<GUID>/<GUID>.kmz`
  - iOS: app Archivos > DJI Fly > `wayline_mission/<GUID>/`
  Hay que reiniciar DJI Fly después de sustituir el archivo.
- **Rationale**: el Air 3S no tiene Mobile SDK. DJI Fly no tiene función de importar, solo
  lista carpetas de misión que ella misma creó. Varias herramientas (FlyPath, dji-waypoints,
  Dronelink, Litchi) usan este mismo método.
- **Alternatives considered**: MSDK v5 (no admite Air 3S); app Android propia (no hay SDK
  que la soporte).
- **Status**: Verificado (varias fuentes independientes).

## R2. Formato del KMZ que acepta DJI Fly

- **Decision**: ZIP con `wpmz/template.kml` y `wpmz/waylines.wpml`. Namespace
  `http://www.uav.com/wpmz/1.0.2` (no el `www.dji.com` de los drones enterprise).
  `wpml:author` = `fly`. Alturas `relativeToStartPoint`. Detalle completo en
  [contracts/kmz-dji-fly.md](./contracts/kmz-dji-fly.md).
- **Rationale**: DJI Fly ignora `template.kml`, pero rechaza el KMZ si falta. Un KMZ
  rechazado no da error visible: la misión simplemente no se abre. Por eso la estructura se
  copia de un KMZ real y se valida antes de exportar.
- **Alternatives considered**: seguir solo la especificación pública DJI WPML (Cloud API).
  Se descarta como fuente única porque difiere de DJI Fly en el namespace y en campos que
  DJI Fly omite (por ejemplo `takeOffSecurityHeight`).
- **Status**: Provisional. El conjunto exacto de elementos se fija comparando con el KMZ de
  referencia del piloto (prueba de estructura, ver R9).

## R3. Valores del dron (`droneEnumValue`, `droneSubEnumValue`, payload)

- **Decision**: flyplan los lee del KMZ de referencia que carga el piloto y los guarda como
  perfil de dron. No hay valores por defecto en el código.
- **Rationale**: DJI no publica enums de drones de consumo. La comunidad confirma 68/0 en
  Mini 4 Pro y Mini 5 Pro y supone 68/0 en Air 3S, sin verificar. La constitución
  (principio I) prohíbe inventarlos.
- **Detección de modelo (FR-009)**: el perfil guarda el par enum/subenum del primer KMZ de
  referencia. Si no hay forma fiable de distinguir un Air 3S de otro modelo con enum 68, la
  comprobación se limita a: namespace de DJI Fly + presencia de `droneInfo`. El piloto
  confirma en la interfaz que el KMZ es de su Air 3S.
- **Status**: Provisional hasta tener el KMZ del piloto.

## R4. Límites del Air 3S en DJI Fly

| Límite | Valor | Fuente | Estado |
|--------|-------|--------|--------|
| Waypoints por misión | 2–200 | FlyPath, dji-waypoints, guías de comunidad | Provisional |
| Velocidad por tramo | 1–15 m/s | Guía de comunidad (0,1–15) | Provisional, se usa 1 como mínimo conservador |
| Altura relativa al despegue | 2–500 m | Máximo de DJI Fly configurable | Provisional |
| Aviso de altura | > 120 m | EASA / AESA | Verificado (normativa) |
| Gimbal pitch en waypoint | −90° a 0° | WaypointMap; rango mecánico del Air 3S −90° a +60° | Provisional |
| Espera (hover) | 1–30 s | Guía de comunidad (0–30) | Provisional |
| Distancia mínima entre waypoints consecutivos | 1 m | Criterio propio | Provisional |
| Aviso de autonomía | > 35 min estimados | 80 % de 45 min (ficha DJI Air 3S) | Verificado (ficha) |

- **Decision**: los límites viven en un único objeto constante en `public/js/mission.js`.
  Antes de cerrar la feature, el piloto comprueba en la interfaz de DJI Fly los mínimos y
  máximos reales y se ajustan los valores provisionales (tarea manual).
- **Rationale**: no hay documentación oficial de estos límites para DJI Fly. Valores
  conservadores evitan exportar misiones que DJI Fly rechace.

## R5. Stack de la web

- **Decision**: HTML + CSS + JavaScript con módulos ES nativos. Sin paso de build, sin
  framework.
- **Rationale**: principio III. Los módulos ES funcionan en hosting estático y en servidor
  local (FR-019). No funcionan con `file://`, por eso el modo local usa un servidor
  (`python -m http.server`).
- **Alternatives considered**: React/Vite (añade build y dependencias sin necesidad para una
  pantalla); TypeScript (añade compilación).

## R6. Mapa y búsqueda

- **Decision**: Leaflet 1.9.4 desde cdnjs, con teselas satélite Esri World Imagery y su
  atribución. Búsqueda: si el texto son coordenadas (`lat, lon`), se centra el mapa sin red;
  si no, se consulta Nominatim (OpenStreetMap) al pulsar Enter, una petición por búsqueda.
- **Rationale**: Leaflet trae marcadores arrastrables y polilíneas de serie; el navegador no
  tiene mapa nativo. Esri World Imagery es gratuito con atribución para uso no comercial.
  Nominatim exige no hacer autocompletado ni más de 1 petición/s, lo que encaja con buscar
  al pulsar Enter.
- **Alternatives considered**: Google Maps (requiere clave y cuenta de facturación);
  MapLibre (más pesado, pensado para teselas vectoriales).
- **Dependencia justificada**: única dependencia de ejecución.

## R7. Lectura y escritura del ZIP (KMZ)

- **Decision**: código propio en `public/js/kmz.js`:
  - Escritura: ZIP sin compresión (store) con CRC32. Unas 40 líneas.
  - Lectura: recorre el directorio central y descomprime con `DecompressionStream`
    (`deflate-raw`), nativo en navegadores actuales y en Node 24.
- **Rationale**: el navegador ya trae la descompresión. Un KMZ tiene 2 archivos pequeños,
  sin ZIP64 ni cifrado. dji-waypoints usa este mismo enfoque y DJI Fly acepta ZIP sin
  compresión.
- **Alternatives considered**: fflate o JSZip. Se descartan por ser una dependencia para lo
  que hacen unas pocas líneas sobre APIs nativas. Si aparece un KMZ real que el lector no
  abre (por ejemplo ZIP64), se reevalúa fflate.

## R8. XML

- **Decision**: generación con plantillas de texto y escape de `& < > " '`. Lectura con
  `DOMParser` y `getElementsByTagName('wpml:...')` por nombre cualificado.
- **Rationale**: generar con texto da control exacto de los elementos emitidos (principio
  I). Buscar por nombre cualificado funciona igual con los dos namespaces de DJI.
- **Pruebas en Node**: Node no tiene `DOMParser`. Las pruebas usan `@xmldom/xmldom` como
  dependencia solo de desarrollo. El código de la app solo usa métodos que `xmldom` también
  implementa (`getElementsByTagName`, `textContent`, `getAttribute`); nada de
  `querySelector`.

## R9. Pruebas

- **Decision**: `node --test` (runner nativo de Node 24). Archivos `tests/*.test.js`.
  - Ida y vuelta: misión → KMZ → misión, comparación campo a campo (principio IV).
  - Fixture real: `fixtures/referencia-air3s.kmz` del piloto. Se comprueba que (a) se parsea
    sin pérdida, (b) el KMZ generado con su perfil tiene el mismo conjunto de rutas de
    elementos que el original en `missionConfig` y `Folder`, y (c) cada tipo de acción
    generada tiene la misma forma XML que en el fixture.
  - Límites: cada límite de R4 justo dentro y justo fuera.
- **Rationale**: runner sin dependencias. La prueba de estructura detecta campos inventados
  o que faltan sin tener que volar.
- **Gate**: la historia 1 no se cierra sin el fixture real y sin la comprobación manual en
  DJI Fly (constitución, flujo de desarrollo).

## R10. Distancia y tiempo estimado

- **Decision**:
  - Distancia de tramo = √(horizontal² + Δaltura²). La distancia horizontal se calcula con
    haversine, radio 6 371 008,8 m.
  - Tiempo = Σ (distancia de tramo / velocidad del waypoint de origen) + 2 s por waypoint
    (frenado y aceleración, porque el giro es "parar en el punto") + Σ esperas.
- **Rationale**: en DJI WPML, la velocidad de un waypoint se aplica al tramo que sale de él.
  El margen de 2 s es una heurística; se marca con un comentario `ponytail:` y se ajusta
  comparando con la estimación de DJI Fly.
- **Alternatives considered**: Vincenty (más exacto, pero innecesario a escala de misión,
  donde el error de haversine es menor al 0,5 %).

## R11. Persistencia

- **Decision**: `localStorage`, claves `flyplan.mission` (misión en curso) y
  `flyplan.droneProfile` (perfil del KMZ de referencia). Todo con `try/catch`: si el
  almacenamiento falla, la app funciona sin autoguardado y lo avisa.
- **Rationale**: FR-014 y FR-019. Los datos nunca salen del navegador.

## R12. Hosting

- **Decision**: la carpeta `public/` es la web completa. Se publica tal cual en cualquier
  hosting estático (por defecto GitHub Pages). En local: `python -m http.server 8000 -d
  public`.
- **Rationale**: sin build, el mismo directorio sirve en local y en producción (FR-019).
  La lógica de misión y KMZ (`mission.js`, `wpml.js`, `kmz.js`) no toca el DOM ni Leaflet,
  así que un servidor futuro puede importarla en Node tal cual.

## Riesgos abiertos

- `droneEnumValue` del Air 3S sin confirmar (R3).
- Forma XML exacta de `startRecord`, `stopRecord`, `hover` y del rumbo fijo en DJI Fly
  (R2). Se fija con el fixture.
- FlyPath avisa de que, con tramos rectos (`globalUseStraightLine` = 1), DJI Fly puede
  reordenar waypoints si el piloto vuelve a guardar la misión en el móvil. Mitigación: la
  guía indica no volver a guardar la misión en DJI Fly tras instalarla.

## Sources

- [FlyPath (QGIS plugin, DJI WPML KMZ)](https://github.com/dronnix-io/FlyPath)
- [dji-waypoints (planificador web para DJI Fly)](https://github.com/jedrula/dji-waypoints)
- [DJI Cloud API – waylines.wpml](https://github.com/dji-sdk/Cloud-API-Doc/blob/master/docs/en/60.api-reference/00.dji-wpml/30.waylines-wpml.md)
- [DJI Cloud API – template.kml](https://github.com/dji-sdk/Cloud-API-Doc/blob/master/docs/en/60.api-reference/00.dji-wpml/20.template-kml.md)
- [Dronelink – Convert and Export to KMZ](https://support.dronelink.com/hc/en-us/articles/4410621290387-Onboard-DJI-Waypoint-Missions-Convert-and-Export-to-KMZ)
- [DJI – Waypoint Flight Mode of DJI Fly](https://support.dji.com/help/content?customId=en-us03400007343&spaceId=34&re=US&lang=en&documentType=artical&paperDocType=paper)
- [DJI Air 3S – Specs](https://www.dji.com/air-3s/specs)
- [Mini 4 Pro WPMZ_FILE_LOAD_ERROR (MSDK v5 issue #791)](https://github.com/dji-sdk/Mobile-SDK-Android-V5/issues/791)
