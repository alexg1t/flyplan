# Quickstart: validar el editor de misiones waypoint

**Feature**: `001-waypoint-kmz-editor`

## Requisitos

- Node 24 o superior (pruebas).
- Python 3 (servidor local). Cualquier otro servidor estático también vale.
- DJI Fly en un móvil Android o iOS conectado al RC-N3, con el Air 3S vinculado.

## 1. Conseguir el KMZ de referencia (una sola vez)

Este archivo es el fixture de las pruebas y el KMZ de referencia de la app.

1. En DJI Fly, entra en Waypoints y crea una misión de 4 waypoints:
   - WP1: acción hacer foto.
   - WP2: acción empezar vídeo y rumbo fijo (cualquier ángulo).
   - WP3: espera de 3 s y acción parar vídeo.
   - WP4: gimbal a −90°.
2. Guárdala con el nombre `referencia`.
3. Copia el KMZ al PC:
   - Android: conecta por USB y abre
     `Android/data/dji.go.v5/files/waypoint/`. Entra en la carpeta más reciente y copia
     `<GUID>.kmz`.
   - iOS: abre Archivos > DJI Fly > `wayline_mission/`. Entra en la carpeta más reciente y
     comparte el `.kmz` al PC.
4. Guárdalo como `fixtures/referencia-air3s.kmz`.
5. En DJI Fly, anota los mínimos y máximos que permite la interfaz para altura, velocidad,
   gimbal y espera. Así se confirman los límites provisionales de research R4.

## 2. Pruebas automáticas

```powershell
npm install        # solo instala @xmldom/xmldom (desarrollo)
npm test           # node --test tests/*.test.js
```

Resultado esperado: todas las pruebas pasan, incluidas:

- Ida y vuelta misión → KMZ → misión.
- Estructura del KMZ generado igual a la del fixture.
- Cada límite, justo dentro y justo fuera.

Sin el fixture, las pruebas que lo usan se marcan como `skip` con el mensaje "falta
fixtures/referencia-air3s.kmz".

## 3. Arrancar en local

```powershell
python -m http.server 8000 -d public
```

Abre `http://localhost:8000`.

## 4. Escenarios de validación manual

Hasta T035, `WPML_VERIFIED` es `false` y la exportación está desactivada. En esa fase, los
escenarios 3 y 5 deben mostrar el mensaje "Exportación desactivada hasta verificar el
formato con tu KMZ real de DJI Fly". Después de T035 deben dar el resultado de la tabla.

| # | Historia | Pasos | Resultado esperado |
|---|----------|-------|--------------------|
| 1 | US1 | Clic en 3 puntos del mapa. | Waypoints 1, 2 y 3 unidos por una línea. Distancia y tiempo visibles. |
| 2 | US1 | Exportar sin KMZ de referencia. | flyplan pide el KMZ y explica cómo obtenerlo. |
| 3 | US1 | Cargar `fixtures/referencia-air3s.kmz` y exportar. | Se descarga un `.kmz` y aparece el enlace a la guía. |
| 4 | US1 | Poner 600 m de altura en un waypoint y exportar. | Exportación bloqueada; el mensaje nombra el waypoint y el valor. |
| 5 | US1 | Poner 130 m y exportar. | Aviso de más de 120 m; tras confirmar, se descarga el archivo. |
| 6 | US2 | Arrastrar, borrar y reordenar waypoints. | Línea, números, distancia y tiempo se actualizan al instante. |
| 7 | US2 | Cambiar la altura por defecto. | Solo cambian los waypoints sin altura propia. |
| 8 | US3 | Abrir el fixture y exportarlo sin cambios. | Mismos waypoints y parámetros (prueba automática equivalente). |
| 9 | US3 | Abrir un `.txt` renombrado a `.kmz`. | Mensaje claro; la misión actual no cambia. |
| 10 | US4 | Abrir la ayuda y elegir Android, luego iOS. | Pasos correctos para cada sistema. |
| 11 | — | Recargar la página. | Se recupera la misión en curso. |

## 5. Comprobación en DJI Fly (gate de la constitución)

Hazla en tierra, sin volar:

1. Exporta 3 misiones: una simple de 5 waypoints, una con todas las acciones y una con
   rumbos fijos y gimbal distinto por punto.
2. Instala cada una sustituyendo la misión ficticia (guía en `ayuda.html`) y reinicia
   DJI Fly.
3. Comprueba que DJI Fly abre cada misión y que la vista previa coincide: puntos, orden,
   alturas, acciones y distancia total (±5 %, SC-006).
4. No vuelvas a guardar la misión en DJI Fly antes de volar (research, riesgos abiertos).
