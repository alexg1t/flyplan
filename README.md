# flyplan

Herramienta web para planificar misiones waypoint para un **DJI Air 3S** con **DJI Fly**
(control DJI RC-N3 y móvil Android o iOS). Dibujas la ruta en un mapa satélite, ajustas
alturas, velocidades, gimbal, rumbo y acciones, y exportas un KMZ que se instala en DJI Fly.

Tiene dos tipos de misión:

- **Ruta de waypoints**: marcas los puntos que vuela el dron, con sus acciones.
- **Área de mapeo** (ortomosaico): dibujas el polígono de la zona y flyplan calcula las
  pasadas, los puntos de foto, el GSD, el tiempo y cuántas baterías hacen falta. Si no cabe
  en una batería, divide la misión en partes de 25 minutos.

Toda misión tiene un **punto de despegue** ("H" en el mapa), que es la referencia de las
alturas. Con él, la **simulación 2D** muestra el vuelo completo (despegue, ida, misión, vuelta
a casa y aterrizaje), las fotos que se van tomando y el tiempo real de cada batería.

El Air 3S no tiene SDK, así que la misión se instala sustituyendo el archivo de una misión
ficticia creada en DJI Fly. Los pasos están en [`public/ayuda.html`](public/ayuda.html).

> flyplan no sustituye tu criterio como piloto, la comprobación del espacio aéreo ni la
> revisión de la misión en DJI Fly antes de despegar.

## Estado

La exportación está **desactivada** hasta verificar el formato con un KMZ real de DJI Fly
(`fixtures/referencia-air3s.kmz`). Cómo generarlo:
[`fixtures/instructivo-kmz-referencia.pdf`](fixtures/instructivo-kmz-referencia.pdf).

## Usarlo en local

La web es estática y no necesita build. Los módulos JavaScript no funcionan abriendo el
archivo con doble clic, así que hay que servirla:

```powershell
python -m http.server 8000 -d public
```

Abre <http://localhost:8000>.

## Pruebas

Requiere Node 24 o superior.

```powershell
npm install
npm test
```

## Publicarlo

La carpeta `public/` es la web completa. El workflow
[`.github/workflows/pages.yml`](.github/workflows/pages.yml) pasa las pruebas y la publica en
GitHub Pages en cada push a `main` o `master`. Hay que activar Pages en el repositorio con
la fuente "GitHub Actions".

## Documentación

- Especificación y plan: [`specs/001-waypoint-kmz-editor/`](specs/001-waypoint-kmz-editor/)
- Principios del proyecto: [`.specify/memory/constitution.md`](.specify/memory/constitution.md)
