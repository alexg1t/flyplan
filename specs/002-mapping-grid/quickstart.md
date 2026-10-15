# Quickstart: validar la cuadrícula de mapeo

**Feature**: `002-mapping-grid`

## Requisitos

Los mismos que la feature 001: Node 24 o superior y Python 3. Para el vuelo de prueba
(§4): DJI Fly con el Air 3S y la exportación ya verificada (feature 001, T035).

## 1. Pruebas automáticas

```powershell
npm test
```

Además de las pruebas de la feature 001, deben pasar las de `tests/grid.test.js`:

- Cobertura del 100 % en un cuadrado, un polígono girado y una forma en L.
- GSD a 60 m: 2,11 cm/px en 12 MP y 1,05 cm/px en 50 MP.
- Separación entre pasadas y entre fotos según los solapes.
- Ninguna parte supera 200 waypoints ni 25 minutos.
- Cada parte exportada pasa la ida y vuelta de `wpml.js`.

## 2. Arrancar en local

```powershell
python -m http.server 8000 -d public
```

## 3. Escenarios en el navegador

| # | Historia | Pasos | Resultado esperado |
|---|----------|-------|--------------------|
| 1 | US1 | Elegir "Área de mapeo", marcar 4 vértices y hacer clic en el primero. | Polígono cerrado; aparecen la ruta, los puntos de foto, el inicio, el fin y el resumen. |
| 2 | US1 | Arrastrar un vértice. | La ruta y el resumen se recalculan. |
| 3 | US1 | Insertar un vértice desde el centro de un lado y borrar otro. | El área cambia y todo se recalcula. |
| 4 | US1 | Mover un vértice para que dos lados se crucen. | Mensaje de área no válida; sin ruta. |
| 5 | US2 | Cambiar el solape lateral de 70 % a 80 %. | Más pasadas. |
| 6 | US2 | Escribir un GSD objetivo de 1,5 cm/px. | La altura se ajusta y el GSD mostrado es 1,5. |
| 7 | US2 | Cambiar la resolución a 50 MP. | El GSD baja a la mitad y el tiempo sube. |
| 8 | US2 | Poner la dirección a 90°. | Las pasadas giran 90°. |
| 9 | US2 | Intentar elegir "Disparo por intervalo". | La opción está desactivada y explica por qué. |
| 10 | US3 | Dibujar un área de unas 20 ha. | El resumen indica varias baterías y el mapa marca P2, P3… |
| 11 | US3 | Exportar. | Antes de T035 (feature 001): mensaje de exportación desactivada. Después: un enlace por parte. |
| 12 | — | Recargar la página. | Se recupera el área con sus parámetros. |
| 13 | — | Cambiar a "Ruta de waypoints" con un área dibujada. | Pide confirmación antes de sustituir la misión. |

## 4. Vuelo de prueba (SC-005, SC-006)

Solo después de verificar la exportación (feature 001, T035):

1. Dibuja un área de 1 ha o menos en una zona permitida y abierta.
2. Exporta, instala en DJI Fly y comprueba que la vista previa coincide.
3. En DJI Fly, pon la cámara con la misma resolución elegida en flyplan, en formato 4:3 y con
   el enfoque a infinito.
4. Vuela y cuenta las fotos: deben diferir menos de un 5 % del número planificado.
5. Procesa las fotos en un programa de fotogrametría (por ejemplo WebODM) y comprueba que el
   ortomosaico no tiene huecos.
