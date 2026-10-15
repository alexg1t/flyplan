# Research: Planificación de vuelos para ortomosaico (cuadrícula de mapeo)

**Feature**: `002-mapping-grid` | **Date**: 2026-10-15

Estados: **Verificado** (ficha oficial de DJI o cálculo comprobable) o **Provisional** (se
confirma con una foto o un vuelo real antes de cerrar la feature).

## R1. Geometría de la cámara principal del Air 3S

| Dato | Valor | Fuente | Estado |
|------|-------|--------|--------|
| Sensor | 1 pulgada, 50 MP | Ficha DJI Air 3S | Verificado |
| Campo de visión (diagonal) | 84° | Ficha DJI | Verificado |
| Focal equivalente | 24 mm (coherente con 84°: 2·atan(43,27 / 48) = 84,0°) | Ficha DJI | Verificado |
| Formato | 4:3 | 8192×6144 en la ficha | Verificado |
| Ancho de imagen 50 MP | 8192 px | Ficha DJI | Verificado |
| Ancho de imagen 12 MP | 4096 px (agrupación 2×2 de 8192) | Deducido | Provisional: confirmar con el EXIF de una foto real |
| Intervalo mínimo entre fotos | 12 MP: 2 s · 50 MP: 5 s | Ficha DJI (modo temporizado) | Verificado |

- **Decision**: la huella de una foto vertical a altura `h` se calcula desde el campo de
  visión diagonal y el formato 4:3:
  - `diagonal = 2 · h · tan(42°)`
  - `ancho = diagonal · 4/5` ≈ 1,4406 · h
  - `alto = diagonal · 3/5` ≈ 1,0805 · h
  - `GSD (cm/px) = 100 · ancho / píxeles de ancho`
  - Ejemplo a 60 m: huella de 86,4 × 64,8 m; GSD de 2,11 cm/px en 12 MP y 1,05 cm/px en 50 MP.
- **Rationale**: no hace falta el tamaño físico del sensor ni la focal real. El campo de
  visión y la resolución de DJI bastan y se comprueban entre sí.
- **Alternatives considered**: usar el tamaño nominal del sensor de 1" (13,2 × 8,8 mm, 3:2).
  Se descarta porque la imagen del Air 3S es 4:3 y DJI no publica el recorte usado.

## R2. Orientación de la foto y rumbo del dron

- **Decision**: rumbo "seguir la ruta" (el mismo modo que la feature 001). Con el gimbal a
  -90°, el lado largo de la foto (4) queda perpendicular a la pasada y el corto (3) en la
  dirección de avance.
  - Separación entre pasadas = `ancho · (1 − solape lateral)`.
  - Separación entre fotos = `alto · (1 − solape frontal)`.
- **Rationale**: el lado largo en transversal reduce el número de pasadas, que es lo que más
  tiempo cuesta (giros). No se añaden campos WPML nuevos.
- **Alternatives considered**: rumbo fijo en todas las pasadas (el dron volaría de lado o
  hacia atrás la mitad del tiempo). Sin ventaja para nadir y con un campo **[F]** más que
  verificar.

## R3. Cálculo de la cuadrícula

- **Decision**:
  1. Proyección local equirectangular centrada en el polígono (x = R·Δlon·cos(lat₀),
     y = R·Δlat). El error es despreciable para áreas de pocos km.
  2. Rotación para que las pasadas queden horizontales según la dirección elegida
     (0–179°, 0 = pasadas norte-sur).
  3. Número de pasadas `n = max(1, ceil(alto_total / separación))`, centradas en el polígono.
     La primera queda a media separación del borde, así la huella sobresale del área.
  4. Cada pasada se encarga de la franja `[y − sep/2, y + sep/2]`. Se recorta el polígono a
     esa franja y la pasada va del x mínimo al x máximo del recorte. Así se cubren también
     los lados inclinados, no solo el cruce de la línea central.
  5. Fotos a la separación exacta, centradas en el tramo: `m = ceil(largo / sep) + 1`.
     Sobresalen un poco por los extremos, lo que cubre los bordes.
  6. Ida y vuelta: se invierte una pasada de cada dos.
  7. Inicio: de los 4 posibles (primera o última pasada, en un sentido u otro), el más
     cercano al primer vértice del polígono.
  8. Antes de generar los puntos se estima `pasadas · fotos por pasada`. Si supera
     `MAPPING_LIMITS.maxPhotos` (20 000), se devuelve un error en lugar de la cuadrícula
     (FR-019). Así un área grande a poca altura no congela el navegador.
- **Rationale**: es el patrón estándar de las apps de mapeo y se puede comprobar con una
  prueba de cobertura (R10).
- **Alternatives considered**: Turf.js u otra librería de geometría. Se descarta porque son
  unas 80 líneas sobre operaciones simples y la constitución pide no añadir dependencias.

## R4. Polígonos cóncavos

- **Decision**: un solo tramo por franja, del x mínimo al x máximo. En una forma de U, la
  pasada cruza el hueco y también hace fotos ahí.
- **Rationale**: cobertura garantizada con el algoritmo más simple. El coste son algunas
  fotos de más.
- Se marca con un comentario `ponytail:` en el código. Mejora posible: quitar las fotos cuya
  huella no toca el polígono.

## R5. Tiempo, baterías y partes

- **Decision**:
  - Tiempo del modo parada = tramos / velocidad + (2 s de parada + extra de cámara) por
    foto. El extra de cámara es 1 s en 12 MP y 3 s en 50 MP. Valores provisionales, marcados
    `ponytail:`; se ajustan con un vuelo real.
  - Partes: se recorren los waypoints en orden y se abre una parte nueva cuando el siguiente
    haría pasar de **1500 s (25 min)** o de **200 waypoints**. Baterías = número de partes.
  - Tiempo total = suma del tiempo de las partes. El tramo entre la última foto de una parte
    y la primera de la siguiente no se suma, porque entre partes el dron vuelve a casa
    (cambio de la feature 003).
  - El tiempo no incluye ir del despegue a la primera foto ni volver. Por eso las partes
    tienen 25 min y no los 45 de la autonomía.
- **Status**: Provisional (heurística de tiempo).

## R6. Modos de disparo

- **Decision**: solo se implementa **parada con foto**: cada punto de foto es un waypoint
  con `gimbalRotate` (-90°, solo en el primero) y `takePhoto`. Son los mismos elementos que
  ya emite la feature 001, así que no hay campos WPML nuevos.
- **Disparo por intervalo**: la opción aparece desactivada con su explicación (FR-014).
  También quedan aplazados su cálculo (waypoints solo en los extremos de las pasadas y
  `multipleDistance`) y el aviso de velocidad máxima de FR-011
  (`v_max = separación entre fotos / intervalo mínimo`), que solo aplica en ese modo. Se
  hacen cuando un KMZ real confirme que DJI Fly respeta `multipleDistance`.
- **Rationale**: constitución I. En modo parada el dron se detiene en cada foto, así que la
  velocidad nunca impide disparar.
- **Nota**: el Air 3S no tiene obturador mecánico. Pararse en cada foto también evita la
  deformación por obturador rodante, otro motivo para que este modo sea el de por defecto.

## R7. Dibujo en el mapa

- **Decision**: Leaflet, que ya está en el proyecto.
  - Área: `L.polygon` semitransparente. Vértices como marcadores cuadrados arrastrables.
    Un marcador pequeño en el centro de cada lado sirve para insertar un vértice.
  - Ruta: `L.polyline`, con un color por parte.
  - Fotos: `L.circleMarker` de 3 px con el renderizador `L.canvas()`, para dibujar miles de
    puntos sin crear miles de elementos HTML.
  - Inicio y fin: etiquetas "Inicio" y "Fin"; cada parte, "P2", "P3"… en su inicio.
- **Rendimiento**: 50 ha a 60 m en 12 MP son unas 28 pasadas y 1500 fotos; el cálculo es
  O(pasadas · vértices + fotos). Objetivo SC-002: menos de 0,5 s.

## R8. Modelo y almacenamiento

- **Decision**: la misión guardada (`flyplan.mission`) gana un campo `type`: `"route"` o
  `"area"`. Una misión antigua sin `type` se trata como `"route"`. La cuadrícula no se guarda:
  se recalcula al cargar. Detalle en [data-model.md](./data-model.md).

## R9. Exportación

- **Decision**: cada parte se convierte en una `Mission` de la feature 001 (altura de vuelo,
  gimbal -90°, rumbo seguir la ruta, acción `photo` en cada waypoint) y pasa por los mismos
  `validate()`, `buildFiles()` y `zip()`.
  - Las partes intermedias terminan con `goHome`; la última usa la acción al terminar de la
    misión.
  - En lugar de lanzar N descargas seguidas (los navegadores las bloquean), flyplan muestra
    un enlace de descarga por parte: `<nombre>-parte-1-de-N.kmz`.
- El bloqueo `WPML_VERIFIED` de la feature 001 se aplica igual.

## R10. Pruebas

- **Cobertura (SC-003)**: para polígonos convexos y cóncavos, se toma una rejilla de puntos
  de prueba dentro del polígono y se comprueba que cada uno cae dentro de la huella de al
  menos una foto, rotada según la dirección de las pasadas.
- **Solapes**: la distancia entre pasadas vecinas y entre fotos consecutivas cumple las
  fórmulas de R2.
- **GSD (SC-004)**: valores de ejemplo de R1 con una tolerancia de 0,01 cm/px.
- **Partes**: ninguna parte supera 200 waypoints ni 1500 s, y su concatenación da la ruta
  completa.
- **Exportación**: cada parte pasa la ida y vuelta de `wpml.js` de la feature 001.

## Sources

- [DJI Air 3S – Specs](https://www.dji.com/air-3s/specs)
- [DJI Air 3S – Support](https://www.dji.com/support/product/air-3s)
- [FlyPath (planificación de mapeo para DJI Fly)](https://github.com/dronnix-io/FlyPath)
- [dji-waypoints (multipleDistance en DJI Fly, sin verificar)](https://github.com/jedrula/dji-waypoints)
