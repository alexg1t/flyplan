# Quickstart: validar la simulación 2D

**Feature**: `003-flight-simulation`

## 1. Pruebas automáticas

```powershell
npm test
```

Además de las anteriores, deben pasar `tests/sim.test.js` y las pruebas nuevas de
`tests/mission.test.js` y `tests/grid.test.js` (research R7).

## 2. Arrancar en local

```powershell
python -m http.server 8000 -d public
```

## 3. Escenarios en el navegador

| # | Historia | Pasos | Resultado esperado |
|---|----------|-------|--------------------|
| 1 | FR-010 | Misión nueva: hacer clic en el mapa. | Aparece la "H" del despegue. El siguiente clic ya añade un waypoint o un vértice. |
| 2 | FR-010 | "Mover despegue" y clic en otro sitio; luego arrastrar la "H". | La "H" se mueve y la simulación vuelve al inicio. |
| 3 | FR-014 | En un área cerrada, mover la "H" a la esquina opuesta. | "Inicio" pasa al extremo de la cuadrícula más cercano a la "H". |
| 4 | US1 | Área de unas 2 ha, pulsar "Simular". | El dron despega, va al Inicio, recorre las pasadas, marca las fotos en verde, muestra la huella y vuelve a la "H". |
| 5 | US1 | Área de 2 partes. | Vuelta a casa y aterrizaje entre partes; el panel cambia de parte y lista el tiempo de cada batería. |
| 6 | US1 | Al terminar, comparar el tiempo de misión con el resumen. | Diferencia menor de 1 s (SC-001). |
| 7 | US2 | Pausa, Reproducir y Reiniciar. | Se detiene, continúa y vuelve al despegue con todas las fotos pendientes. |
| 8 | US2 | Arrastrar la barra al 50 %. | El dron salta a ese momento; el tiempo transcurrido es la mitad del total. |
| 9 | US2 | Velocidad ×10 durante 10 s reales. | Unos 100 s simulados. |
| 10 | US3 | Ruta de 4 waypoints con una espera de 3 s. | Parada de 2 + 3 s en ese waypoint; el panel muestra sus acciones. |
| 11 | FR-008 | Editar la misión durante la simulación. | La simulación se detiene y vuelve al inicio. |
| 12 | FR-012 | Poner la "H" a 3 km de un área de 25 min. | El tiempo de esa batería supera 35 min y salta el aviso. |
| 13 | FR-013 | Misión abierta desde un KMZ (sin "H") y pulsar Exportar. | "Marca el punto de despegue antes de exportar" (después del bloqueo de verificación). |
| 14 | SC-004 | Área de 50 ha (8 partes) a ×120. | Se ve completa en menos de 2 minutos. |
| 15 | — | Ocultar la pestaña durante la simulación y volver. | La simulación está en pausa, sin saltos. |
