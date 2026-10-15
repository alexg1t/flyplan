# Contrato: KMZ para DJI Fly (Air 3S)

Archivo que flyplan exporta (FR-010) y lee (FR-008, FR-013).

**Estado**: Provisional. Las marcas **[F]** son elementos cuya forma exacta se fija copiando
el KMZ de referencia real (`fixtures/referencia-air3s.kmz`). La prueba de estructura de
research R9 falla si la salida de flyplan difiere del fixture en estos elementos.

## Estructura del archivo

```text
<nombre>.kmz            ZIP, entradas sin compresión (store)
└── wpmz/
    ├── template.kml    obligatorio aunque DJI Fly no lo usa
    └── waylines.wpml   lo que ejecuta el dron
```

- Codificación UTF-8, sin BOM.
- Namespace KML: `http://www.opengis.net/kml/2.2`.
- Namespace `wpml`: `DroneProfile.namespace` (esperado `http://www.uav.com/wpmz/1.0.2`).

## Correspondencia Mission → waylines.wpml

| Mission | Elemento WPML | Valor |
|---------|---------------|-------|
| — | `wpml:missionConfig/wpml:flyToWaylineMode` | `safely` |
| `finishAction` | `wpml:missionConfig/wpml:finishAction` | `goHome` \| `autoLand` \| `noAction` |
| `onSignalLost` = `continue` | `wpml:missionConfig/wpml:exitOnRCLost` | `goContinue` |
| `onSignalLost` = `lostAction` | `wpml:missionConfig/wpml:exitOnRCLost` + `wpml:executeRCLostAction` | `executeLostAction` + `goBack` (volver a casa). Valor de `executeRCLostAction` **[F]** |
| perfil | `wpml:missionConfig/wpml:droneInfo` | `droneEnumValue`, `droneSubEnumValue` del perfil |
| perfil | `wpml:missionConfig/wpml:payloadInfo` | solo si el perfil lo tiene |
| otros campos de `missionConfig` | **[F]** | se emiten exactamente los que tenga el fixture, con sus valores |
| — | `Folder/wpml:templateId`, `wpml:waylineId` | `0`, `0` |
| — | `Folder/wpml:executeHeightMode` | `relativeToStartPoint` |
| `defaults.speed` | `Folder/wpml:autoFlightSpeed` | m/s, 1 decimal |

## Correspondencia Waypoint → Placemark (waylines.wpml)

| Waypoint | Elemento WPML | Valor |
|----------|---------------|-------|
| `lon`, `lat` | `Point/coordinates` | `lon,lat` con 6 decimales |
| posición en el array | `wpml:index` | 0…n−1, contiguos |
| altura efectiva | `wpml:executeHeight` | m, 1 decimal |
| velocidad efectiva | `wpml:waypointSpeed` | m/s, 1 decimal |
| `heading` = `null` | `wpml:waypointHeadingParam/wpml:waypointHeadingMode` | `followWayline` |
| `heading` = número | `wpml:waypointHeadingParam` **[F]** | modo y ángulo como en el fixture. El ángulo pasa de 0…359 a −180…180. |
| — | `wpml:waypointTurnParam/wpml:waypointTurnMode` | `toPointAndStopWithDiscontinuityCurvature` |
| — | `wpml:waypointTurnParam/wpml:waypointTurnDampingDist` | `0` |
| — | `wpml:useStraightLine` | `1` (tramos rectos, spec Assumptions) |
| gimbal efectivo + `actions` | `wpml:actionGroup` | ver abajo |

## actionGroup por waypoint

Un `wpml:actionGroup` por waypoint con al menos una acción:

- `wpml:actionGroupId`: índice del waypoint.
- `wpml:actionGroupStartIndex` = `wpml:actionGroupEndIndex` = índice del waypoint.
- `wpml:actionGroupMode`: `sequence`.
- `wpml:actionTrigger/wpml:actionTriggerType`: `reachPoint`.
- `wpml:actionId`: numerados desde 1 dentro del grupo (DJI Fly empieza en 1).

Orden de las acciones dentro del grupo:

1. `gimbalRotate` **[F]**: pitch efectivo en modo `absoluteAngle`. Solo se emite si el
   pitch cambia respecto al waypoint anterior, o si es el primer waypoint.
2. Las acciones de `Waypoint.actions`, en su orden:

| Action | `wpml:actionActuatorFunc` | Parámetros |
|--------|---------------------------|------------|
| `photo` | `takePhoto` | **[F]** (`payloadPositionIndex`, `fileSuffix`…) |
| `startVideo` | `startRecord` | **[F]** |
| `stopVideo` | `stopRecord` | **[F]** |
| `wait` | `hover` | `wpml:hoverTime` = `seconds` |

## template.kml

- Misma `missionConfig` que `waylines.wpml`, más `wpml:author`, `wpml:createTime` y
  `wpml:updateTime` (ms epoch).
- `Folder`: `wpml:templateType` = `waypoint`, `wpml:templateId` = `0`,
  `wpml:waylineCoordinateSysParam` (`WGS84`, `relativeToStartPoint`, `GPS`),
  `wpml:autoFlightSpeed`, `wpml:globalHeight` = `defaults.height`.
- Un `Placemark` por waypoint con `wpml:index`, `wpml:height` y los mismos parámetros de
  velocidad, rumbo y gimbal. Forma exacta **[F]**.

## Lectura (parseMission)

- Acepta entradas comprimidas (deflate) o sin comprimir.
- Busca `wpmz/waylines.wpml`. Si no existe, el archivo no es una misión de DJI Fly (spec,
  US3 escenario 3).
- Reconstruye los waypoints desde `waylines.wpml`.
- Valores de misión que `waylines.wpml` no guarda:
  - `name`: el nombre del archivo sin `.kmz` (parámetro `name`).
  - `defaults.height`: `wpml:globalHeight` de `template.kml`.
  - `defaults.speed`: `wpml:autoFlightSpeed` de `template.kml`, o si no, de `waylines.wpml`.
  - `defaults.gimbalPitch`: el pitch del primer `gimbalRotate`.
  - Si falta alguno, se usa el de `emptyMission()`.
- Un waypoint cuyo valor coincide con el valor por defecto de la misión se carga con `null`
  en ese campo.
- Conversión de acciones:
  - `gimbalRotate` → `gimbalPitch` del waypoint. El pitch se arrastra a los waypoints
    siguientes hasta el próximo `gimbalRotate`, porque solo se emite cuando cambia.
  - `takePhoto` → `photo`, `startRecord` → `startVideo`, `stopRecord` → `stopVideo`,
    `hover` → `wait` (`seconds` = `wpml:hoverTime`).
- Acciones desconocidas (por ejemplo `zoom`): la importación sigue, pero flyplan avisa de
  que esas acciones se perderán al exportar.
- La ida y vuelta conserva los **valores efectivos** de cada waypoint (lo que vuela el dron),
  no necesariamente qué campos eran `null`.

## Rechazo del KMZ de referencia (FR-009)

Se rechaza si falta `wpml:droneInfo` o si el namespace no es el de DJI Fly. El mensaje
muestra el namespace y el par enum/subenum detectados. Si se acepta, la interfaz muestra
esos valores y pide al piloto que confirme que el KMZ es de su Air 3S.

## Exportación bloqueada hasta verificar (constitución I)

`wpml.js` exporta `WPML_VERIFIED`. Vale `false` mientras queden elementos **[F]** sin
confirmar con el fixture real. Con `false`, la interfaz no permite exportar. Las pruebas
pueden llamar a `buildFiles` igualmente. Solo T035 lo pasa a `true`.
