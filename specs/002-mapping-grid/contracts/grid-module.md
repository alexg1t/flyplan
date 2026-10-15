# Contrato: módulo `public/js/grid.js`

Funciones puras: sin DOM, sin Leaflet, sin `localStorage`. Se prueban con `node --test`
igual que `mission.js`.

```text
CAMERA                                   constante congelada (research R1)
MAPPING_LIMITS                           constante congelada (data-model.md)

emptyArea() -> AreaMission
footprint(height) -> { across, along }   metros: lado largo transversal, lado corto en avance
gsd(height, resolution) -> number        cm/px
heightForGsd(gsd, resolution) -> number  m
areaHectares(vertices) -> number
isSimple(vertices) -> boolean            false si dos lados no contiguos se cruzan
autoDirection(vertices) -> number        0–179°, rumbo del lado más largo
computeGrid(area) -> Grid | {error} | null
                                         null si el área no está cerrada o no es válida;
                                         {error} si harían falta más de maxPhotos fotos (FR-019)
toMissions(area, grid) -> Mission[]      una Mission de la feature 001 por parte
```

## Reglas

- `computeGrid` usa `area.params.direction ?? autoDirection(area.vertices)`.
- Los puntos de `Grid.photos` están en orden de vuelo, en ida y vuelta, y empiezan en el
  extremo más cercano a `vertices[0]` (research R3).
- `Grid.parts` cumple: cada parte tiene como máximo `MAPPING_LIMITS.partWaypoints` puntos y
  un tiempo estimado de como máximo `MAPPING_LIMITS.partSeconds`. Concatenadas, cubren
  `photos` sin huecos ni repeticiones.
- `toMissions` no añade elementos WPML nuevos respecto a la feature 001: solo waypoints con
  `gimbalPitch` -90 y la acción `photo` (research R6, constitución I).
- Los mensajes para el usuario van en español.

## Uso desde `main.js`

- `main.js` decide qué dibujar según `mission.type`.
- En modo área, cada cambio llama a `computeGrid` y redibuja el área, la ruta, los puntos de
  foto y el resumen (FR-008).
- La exportación llama a `toMissions` y después, por cada parte, a las funciones de la
  feature 001 (`validate`, `buildFiles`, `zip`). Muestra un enlace de descarga por parte.
