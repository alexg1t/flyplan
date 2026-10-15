# Contrato: módulos de lógica

Funciones públicas que usa la interfaz (`main.js`) y que podrán reutilizar la feature de
cuadrícula y un servidor futuro. Ninguno de estos módulos toca el DOM ni Leaflet, salvo
`DOMParser` en `wpml.js`, que en Node se sustituye por `@xmldom/xmldom`.

## public/js/mission.js

```text
LIMITS                                   constante congelada (data-model.md)
emptyMission() -> Mission
effective(mission, waypoint, field) -> number
distance(mission) -> number              metros (research R10)
duration(mission) -> number              segundos (research R10)
validate(mission) -> ValidationResult    errores bloquean, avisos se confirman
```

## public/js/wpml.js

```text
WPML_VERIFIED                            false hasta confirmar los elementos [F] con el fixture (T035)
buildFiles(mission, profile, now?) -> { 'wpmz/template.kml': string, 'wpmz/waylines.wpml': string }
parseMission(files, name) -> { mission: Mission, warnings: string[] }   name = nombre del archivo sin .kmz
parseProfile(files) -> DroneProfile      lanza Error con mensaje en español si no es válido
```

## public/js/kmz.js

```text
zip(files: { [path]: string }) -> Uint8Array          ZIP sin compresión
unzip(bytes: Uint8Array) -> Promise<{ [path]: string }>
```

## Reglas

- Funciones puras: misma entrada, misma salida. La única excepción es `createTime` y
  `updateTime` en `buildFiles`, que acepta un `now` opcional para las pruebas.
- Los errores para el usuario van en español.
- `main.js` es el único módulo con estado, DOM, Leaflet y `localStorage`.
