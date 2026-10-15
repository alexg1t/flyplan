// Interfaz: único módulo con estado, DOM, Leaflet y localStorage (contracts/modules.md).
import { LIMITS, emptyMission, effective, distance, duration, validate, isClosed, closeRoute } from './mission.js';
import { WPML_VERIFIED, buildFiles, parseMission, parseProfile } from './wpml.js';
import { zip, unzip } from './kmz.js';
import { MAPPING_LIMITS, emptyArea, gsd, heightForGsd, computeGrid, toMissions } from './grid.js';

const MISSION_KEY = 'flyplan.mission';
const PROFILE_KEY = 'flyplan.droneProfile';
const FIELDS = ['height', 'speed', 'gimbalPitch'];
const ACTION_LABELS = { photo: 'Foto', startVideo: 'Empezar vídeo', stopVideo: 'Parar vídeo', wait: 'Esperar' };
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const PART_COLORS = ['#ffd400', '#00e5ff'];

const $ = (id) => document.getElementById(id);

// ---------- Mensajes ----------

function notify(text, kind = 'info', ...extra) {
  const box = document.createElement('div');
  box.className = `msg ${kind}`;
  box.append(text, ...extra);
  $('messages').replaceChildren(box);
}

function link(href, text) {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = text;
  return a;
}

function button(text, onClick, className = '', label = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  if (className) b.className = className;
  if (label) b.setAttribute('aria-label', label);
  b.addEventListener('click', onClick);
  return b;
}

function showIssues(title, issues, kind) {
  const list = document.createElement('ul');
  for (const issue of issues) {
    const li = document.createElement('li');
    li.append(issue.message);
    if (issue.waypoint) li.append(button('Ver', () => select(issue.waypoint - 1)));
    list.append(li);
  }
  notify(title, kind, list);
}

// ---------- Persistencia ----------

const finite = (...values) => values.every(Number.isFinite);

const isRoute = (m) =>
  (m?.type ?? 'route') === 'route' &&
  typeof m.name === 'string' &&
  FIELDS.every((f) => Number.isFinite(m.defaults?.[f])) &&
  Array.isArray(m.waypoints) &&
  m.waypoints.every((w) => finite(w.lat, w.lon) && Array.isArray(w.actions));

const validParams = (p) =>
  finite(p?.height, p?.speed, p?.frontOverlap, p?.sideOverlap) &&
  (p.direction === null || (p.direction >= 0 && p.direction < 180)) &&
  [12, 50].includes(p.resolution) &&
  ['stop', 'interval'].includes(p.captureMode);

const isAreaMission = (m) =>
  m?.type === 'area' &&
  typeof m.name === 'string' &&
  Array.isArray(m.vertices) &&
  m.vertices.every((v) => finite(v.lat, v.lon)) &&
  typeof m.closed === 'boolean' &&
  validParams(m.params);

const isMission = (m) => isRoute(m) || isAreaMission(m);

const isProfile = (p) =>
  typeof p?.namespace === 'string' && Number.isFinite(p.droneEnumValue) && Number.isFinite(p.droneSubEnumValue);

function load(key, isValid, what) {
  let raw;
  try {
    raw = localStorage.getItem(key);
  } catch {
    notify('El navegador no permite guardar datos: la misión no se guardará automáticamente.', 'warn');
    return null;
  }
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw);
    if (isValid(value)) return value;
  } catch {
    // JSON dañado: se descarta abajo.
  }
  notify(`${what} guardado estaba dañado y se ha descartado.`, 'warn');
  return null;
}

let storageWarned = false;
function store(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    if (!storageWarned) notify('El navegador no permite guardar datos: la misión no se guardará automáticamente.', 'warn');
    storageWarned = true;
  }
}

// ---------- Estado ----------

let mission = load(MISSION_KEY, isMission, 'La misión') ?? emptyMission();
let profile = load(PROFILE_KEY, isProfile, 'El KMZ de referencia');
let selected = null; // waypoint seleccionado (ruta)
let selectedVertex = null; // vértice seleccionado (área)
let grid = null; // última cuadrícula calculada (área)

const isArea = () => mission.type === 'area';
const hasContent = () => (isArea() ? mission.vertices.length : mission.waypoints.length) > 0;
const current = () => mission.waypoints[selected];

/** Guarda y redibuja. full=false no redibuja los formularios (para no perder el foco). */
function commit(full = true) {
  store(MISSION_KEY, mission);
  const mode = isArea() ? 'area' : 'route';
  for (const el of document.querySelectorAll('[data-mode]')) el.hidden = el.dataset.mode !== mode;
  document.querySelector(`input[name="mission-type"][value="${mode}"]`).checked = true;
  if (isArea()) {
    markers.clearLayers();
    route.setLatLngs([]);
    renderArea();
    if (full) renderAreaForm();
  } else {
    areaLayer.clearLayers();
    renderMap();
    renderStats();
    renderList();
    if (full) renderEditor();
  }
  if (full) renderMissionForm();
}

function select(i) {
  selected = i;
  commit();
}

// ---------- Mapa ----------

const map = L.map('map', { zoomControl: false }).setView([40.4168, -3.7038], 6);
L.control.zoom({ zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(map);
map.attributionControl.setPrefix('<a href="https://leafletjs.com" title="Biblioteca de mapas interactivos">Leaflet</a>');
const tiles = L.tileLayer(ESRI, {
  maxZoom: 20,
  maxNativeZoom: 19,
  attribution: 'Imágenes © Esri — Fuente: Esri, Maxar, Earthstar Geographics y la comunidad de usuarios GIS',
}).addTo(map);
let offline = false;
tiles.on('tileerror', () => {
  if (!offline) notify('Sin conexión: el mapa no carga, tu misión no se pierde.', 'warn');
  offline = true;
});
tiles.on('tileload', () => {
  offline = false;
});

const route = L.polyline([], { color: '#ffd400', weight: 3 }).addTo(map);
const markers = L.layerGroup().addTo(map);
const areaLayer = L.layerGroup().addTo(map);
const photoRenderer = L.canvas({ padding: 0.5 });

const ll = (p) => [p.lat, p.lon];

function icon(label, isSelected) {
  const width = String(label).length > 2 ? 44 : 26; // "1/12" necesita más ancho que "12"
  return L.divIcon({
    className: 'wp-marker',
    html: `<div class="wp-icon${isSelected ? ' selected' : ''}">${label}</div>`,
    iconSize: [width, 26],
    iconAnchor: [width / 2, 13],
  });
}

function closeRouteFromMap() {
  closeRoute(mission);
  const n = mission.waypoints.length;
  selected = n - 1;
  commit();
  notify(`Ruta cerrada: el waypoint ${n} vuelve al punto de inicio. Para deshacerlo, borra el waypoint ${n}.`);
}

function renderMap() {
  const n = mission.waypoints.length;
  const closed = isClosed(mission);
  // En una ruta cerrada, el último waypoint está encima del primero: un solo marcador "1/n" mueve los dos.
  const linked = (i) => (closed && (i === 0 || i === n - 1) ? [0, n - 1] : [i]);
  markers.clearLayers();
  mission.waypoints.forEach((w, i) => {
    if (closed && i === n - 1) return;
    const label = closed && i === 0 ? `1/${n}` : i + 1;
    const isSelected = linked(i).includes(selected);
    const marker = L.marker(ll(w), { draggable: true, icon: icon(label, isSelected), title: `Waypoint ${label}` });
    marker.on('click', () => {
      if (i === 0 && n >= 3 && !closed) closeRouteFromMap();
      else select(i);
    });
    marker.on('drag', (e) => {
      const points = route.getLatLngs();
      for (const j of linked(i)) points[j] = e.target.getLatLng();
      route.setLatLngs(points);
    });
    marker.on('dragend', (e) => {
      const { lat, lng } = e.target.getLatLng();
      for (const j of linked(i)) Object.assign(mission.waypoints[j], { lat, lon: lng });
      selected = i;
      commit();
    });
    markers.addLayer(marker);
  });
  route.setLatLngs(mission.waypoints.map(ll));
  $('route-hint').hidden = n < 3 || closed;
}

function fitMission() {
  const points = isArea() ? mission.vertices : mission.waypoints;
  if (points.length) map.fitBounds(L.latLngBounds(points.map(ll)), { padding: [40, 40], maxZoom: 18 });
}

map.on('click', (e) => {
  if (isArea()) {
    addVertex(e.latlng);
    return;
  }
  if (mission.waypoints.length >= LIMITS.waypoints.max) {
    notify(`Máximo ${LIMITS.waypoints.max} waypoints por misión (límite de DJI Fly).`, 'warn');
    return;
  }
  mission.waypoints.push({
    lat: e.latlng.lat,
    lon: e.latlng.lng,
    height: null,
    speed: null,
    gimbalPitch: null,
    heading: null,
    actions: [],
  });
  selected = mission.waypoints.length - 1;
  commit();
});

// ---------- Área de mapeo ----------

function addVertex({ lat, lng }) {
  if (mission.closed) {
    selectedVertex = null;
  } else {
    mission.vertices.push({ lat, lon: lng });
    selectedVertex = mission.vertices.length - 1;
  }
  commit();
}

const flag = (latlng, text) =>
  L.tooltip({ permanent: true, direction: 'top', className: 'flag', offset: [0, -6] }).setLatLng(latlng).setContent(text);

function renderArea() {
  const { vertices, closed } = mission;
  const n = vertices.length;
  areaLayer.clearLayers();
  grid = closed ? computeGrid(mission) : null;

  const outlineStyle = { color: '#ffffff', weight: 2, dashArray: '6 4', interactive: false };
  const outline = closed
    ? L.polygon(vertices.map(ll), { ...outlineStyle, fillOpacity: 0.12 })
    : L.polyline(vertices.map(ll), outlineStyle);
  areaLayer.addLayer(outline);

  if (grid?.photos) {
    grid.parts.forEach((part, k) => {
      const points = grid.photos.slice(part.start, part.end).map(ll);
      areaLayer.addLayer(L.polyline(points, { color: PART_COLORS[k % 2], weight: 2, interactive: false }));
      if (k > 0) areaLayer.addLayer(flag(points[0], `P${k + 1}`));
    });
    for (const p of grid.photos) {
      areaLayer.addLayer(L.circleMarker(ll(p), {
        renderer: photoRenderer, radius: 3, color: '#000', weight: 1, fillColor: '#fff', fillOpacity: 1, interactive: false,
      }));
    }
    areaLayer.addLayer(flag(ll(grid.photos[0]), 'Inicio'));
    areaLayer.addLayer(flag(ll(grid.photos.at(-1)), 'Fin'));
  }

  vertices.forEach((v, i) => {
    const closer = !closed && i === 0 && n >= 3;
    const marker = L.marker(ll(v), {
      draggable: true,
      title: closer ? 'Vértice 1: haz clic para cerrar el área' : `Vértice ${i + 1}`,
      icon: L.divIcon({
        className: 'vx-marker',
        html: `<div class="vx-icon${i === selectedVertex ? ' selected' : ''}${closer ? ' closer' : ''}"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      }),
    });
    marker.on('click', () => {
      if (closer) mission.closed = true;
      else selectedVertex = i;
      commit();
    });
    marker.on('drag', (e) => {
      const points = vertices.map(ll);
      points[i] = e.target.getLatLng();
      outline.setLatLngs(points);
    });
    marker.on('dragend', (e) => {
      const { lat, lng } = e.target.getLatLng();
      Object.assign(vertices[i], { lat, lon: lng });
      selectedVertex = i;
      commit();
    });
    areaLayer.addLayer(marker);
  });

  // Un "+" en el centro de cada lado inserta un vértice ahí (FR-002).
  if (closed) {
    vertices.forEach((a, i) => {
      const b = vertices[(i + 1) % n];
      const mid = L.marker([(a.lat + b.lat) / 2, (a.lon + b.lon) / 2], {
        title: 'Añadir un vértice aquí',
        icon: L.divIcon({ className: 'mid-marker', html: '<div class="mid-icon">+</div>', iconSize: [14, 14], iconAnchor: [7, 7] }),
      });
      mid.on('click', () => {
        vertices.splice(i + 1, 0, { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 });
        selectedVertex = i + 1;
        commit();
      });
      areaLayer.addLayer(mid);
    });
  }
  renderAreaSummary();
}

function setStatus(text, kind) {
  const el = $('area-status');
  el.textContent = text;
  el.className = kind ? `msg ${kind}` : 'muted';
}

function renderAreaSummary() {
  const set = (id, text) => {
    $(id).textContent = text;
  };
  const stats = grid?.stats;
  set('a-area', stats ? `${number(stats.areaHa, 2)} ha` : '—');
  set('a-gsd', `${number(gsd(mission.params.height, mission.params.resolution), 2)} cm/px`);
  set('a-lines', stats ? stats.lines : '—');
  set('a-photos', stats ? stats.photos : '—');
  set('a-distance', stats ? formatDistance(stats.distance) : '—');
  set('a-time', stats ? formatDuration(stats.duration) : '—');
  set('a-batteries', stats ? stats.batteries : '—');

  const n = mission.vertices.length;
  if (!mission.closed) {
    setStatus(n < 3
      ? 'Marca en el mapa los vértices del área (al menos 3). Los vértices no se vuelan: solo delimitan la zona.'
      : 'Haz clic en el vértice 1 (borde amarillo) para cerrar el área.');
  } else if (grid === null) {
    setStatus('El área no es válida: dos lados se cruzan. Mueve un vértice para corregirla.', 'error');
  } else if (grid.error) {
    setStatus(grid.error, 'error');
  } else if (stats.batteries > 1) {
    setStatus(`Hacen falta ${stats.batteries} baterías: la misión se divide en ${stats.batteries} partes (P2, P3… en el mapa).`, 'warn');
  } else {
    setStatus('Arrastra los vértices o pulsa "+" en un lado para añadir uno.');
  }
}

function renderAreaForm() {
  const p = mission.params;
  setValue($('p-height'), p.height);
  setValue($('p-gsd'), gsd(p.height, p.resolution).toFixed(2));
  $('p-resolution').value = String(p.resolution);
  setValue($('p-front'), p.frontOverlap);
  setValue($('p-side'), p.sideOverlap);
  setValue($('p-speed'), p.speed);
  $('p-direction-auto').checked = p.direction === null;
  $('p-direction').disabled = p.direction === null;
  setValue($('p-direction'), Math.round(p.direction ?? grid?.direction ?? 0));
  document.querySelector(`input[name="capture"][value="${p.captureMode}"]`).checked = true;
}

$('vx-delete').addEventListener('click', () => {
  if (selectedVertex === null) {
    notify('Selecciona un vértice en el mapa para borrarlo.', 'warn');
    return;
  }
  mission.vertices.splice(selectedVertex, 1);
  if (mission.vertices.length < 3) mission.closed = false;
  selectedVertex = null;
  commit();
});

for (const [key, id] of [['height', 'p-height'], ['speed', 'p-speed'], ['frontOverlap', 'p-front'], ['sideOverlap', 'p-side']]) {
  $(id).addEventListener('input', (e) => {
    if (Number.isFinite(e.target.valueAsNumber)) {
      mission.params[key] = e.target.valueAsNumber;
      commit();
    }
  });
}
$('p-height').min = LIMITS.height.min;
$('p-height').max = LIMITS.height.max;
$('p-speed').min = LIMITS.speed.min;
$('p-speed').max = LIMITS.speed.max;
for (const id of ['p-front', 'p-side']) {
  $(id).min = MAPPING_LIMITS.overlap.min;
  $(id).max = MAPPING_LIMITS.overlap.max;
}
$('p-gsd').addEventListener('input', (e) => {
  const value = e.target.valueAsNumber;
  if (value > 0) {
    mission.params.height = Math.round(heightForGsd(value, mission.params.resolution) * 10) / 10;
    commit();
  }
});
$('p-resolution').addEventListener('change', (e) => {
  mission.params.resolution = Number(e.target.value);
  commit();
});
$('p-direction-auto').addEventListener('change', (e) => {
  mission.params.direction = e.target.checked ? null : Math.round(grid?.direction ?? 0);
  commit();
});
$('p-direction').addEventListener('input', (e) => {
  const value = e.target.valueAsNumber;
  if (value >= 0 && value < 180) {
    mission.params.direction = value;
    commit();
  }
});
for (const radio of document.querySelectorAll('input[name="capture"]')) {
  radio.addEventListener('change', () => {
    mission.params.captureMode = radio.value;
    commit();
  });
}

// ---------- Panel de la ruta ----------

const number = (n, digits = 1) => n.toLocaleString('es-ES', { maximumFractionDigits: digits });
const formatDistance = (meters) => (meters < 1000 ? `${Math.round(meters)} m` : `${number(meters / 1000, 2)} km`);
function formatDuration(totalSeconds) {
  const seconds = Math.round(totalSeconds);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function renderStats() {
  $('stat-count').textContent = mission.waypoints.length;
  $('stat-distance').textContent = formatDistance(distance(mission));
  $('stat-time').textContent = formatDuration(duration(mission));
}

function move(list, i, step) {
  const j = i + step;
  [list[i], list[j]] = [list[j], list[i]];
  return j;
}

function removeWaypoint(i) {
  mission.waypoints.splice(i, 1);
  if (selected === i) selected = null;
  else if (selected > i) selected--;
  commit();
}

function renderList() {
  const n = mission.waypoints.length;
  $('wp-empty').hidden = n > 0;
  $('wp-list').replaceChildren(
    ...mission.waypoints.map((w, i) => {
      const li = document.createElement('li');
      li.classList.toggle('selected', i === selected);
      const count = w.actions.length;
      const summary =
        `${i + 1}. ${number(effective(mission, w, 'height'))} m · ${number(effective(mission, w, 'speed'))} m/s` +
        (count ? ` · ${count} ${count === 1 ? 'acción' : 'acciones'}` : '');
      const up = button('↑', () => { selected = move(mission.waypoints, i, -1); commit(); }, '', `Subir waypoint ${i + 1}`);
      const down = button('↓', () => { selected = move(mission.waypoints, i, 1); commit(); }, '', `Bajar waypoint ${i + 1}`);
      up.disabled = i === 0;
      down.disabled = i === n - 1;
      li.append(
        button(summary, () => select(i), 'grow'),
        up,
        down,
        button('✕', () => removeWaypoint(i), 'danger', `Borrar waypoint ${i + 1}`)
      );
      return li;
    })
  );
}

/** No pisa el campo que el piloto está editando. */
function setValue(input, value) {
  if (document.activeElement !== input) input.value = value;
}

function renderEditor() {
  const w = current();
  $('wp-editor').hidden = !w;
  if (!w) return;
  $('wp-number').textContent = selected + 1;
  for (const f of FIELDS) {
    const inherit = w[f] === null;
    $(`wp-${f}-inherit`).checked = inherit;
    $(`wp-${f}`).disabled = inherit;
    setValue($(`wp-${f}`), effective(mission, w, f));
  }
  const fixed = w.heading !== null;
  document.querySelector(`input[name="heading"][value="${fixed ? 'fixed' : 'follow'}"]`).checked = true;
  $('wp-heading').disabled = !fixed;
  setValue($('wp-heading'), fixed ? w.heading : '');
  renderActions(w);
}

function renderActions(w) {
  $('action-empty').hidden = w.actions.length > 0;
  $('action-list').replaceChildren(
    ...w.actions.map((a, k) => {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.className = 'grow';
      label.textContent = `${k + 1}. ${ACTION_LABELS[a.type]}`;
      li.append(label);
      if (a.type === 'wait') {
        const input = document.createElement('input');
        Object.assign(input, { type: 'number', min: LIMITS.waitSeconds.min, max: LIMITS.waitSeconds.max, step: 1, value: a.seconds });
        input.setAttribute('aria-label', 'Segundos de espera');
        input.addEventListener('input', () => {
          if (Number.isFinite(input.valueAsNumber)) {
            a.seconds = input.valueAsNumber;
            commit(false);
          }
        });
        li.append(input, ' s');
      }
      const up = button('↑', () => { move(w.actions, k, -1); commit(); }, '', `Subir acción ${k + 1}`);
      const down = button('↓', () => { move(w.actions, k, 1); commit(); }, '', `Bajar acción ${k + 1}`);
      up.disabled = k === 0;
      down.disabled = k === w.actions.length - 1;
      li.append(up, down, button('✕', () => { w.actions.splice(k, 1); commit(); }, 'danger', `Quitar acción ${k + 1}`));
      return li;
    })
  );
}

function renderMissionForm() {
  setValue($('m-name'), mission.name);
  if (!isArea()) for (const f of FIELDS) setValue($(`m-${f}`), mission.defaults[f]);
  $('m-finish').value = mission.finishAction;
  $('m-signal').value = mission.onSignalLost;
}

function renderProfile() {
  $('profile-status').textContent = profile
    ? `KMZ de referencia cargado (dron ${profile.droneEnumValue}/${profile.droneSubEnumValue}).`
    : 'Sin KMZ de referencia: lo necesitas para exportar.';
}

// ---------- Formularios de la ruta ----------

for (const f of FIELDS) {
  for (const prefix of ['wp', 'm']) {
    $(`${prefix}-${f}`).min = LIMITS[f].min;
    $(`${prefix}-${f}`).max = LIMITS[f].max;
  }
  $(`wp-${f}`).addEventListener('input', (e) => {
    if (Number.isFinite(e.target.valueAsNumber)) {
      current()[f] = e.target.valueAsNumber;
      commit();
    }
  });
  $(`wp-${f}-inherit`).addEventListener('change', (e) => {
    const w = current();
    w[f] = e.target.checked ? null : effective(mission, w, f);
    commit();
  });
  $(`m-${f}`).addEventListener('input', (e) => {
    if (Number.isFinite(e.target.valueAsNumber)) {
      mission.defaults[f] = e.target.valueAsNumber;
      commit();
    }
  });
}

for (const radio of document.querySelectorAll('input[name="heading"]')) {
  radio.addEventListener('change', () => {
    const v = $('wp-heading').valueAsNumber;
    current().heading = radio.value === 'fixed' ? (Number.isFinite(v) ? v : 0) : null;
    commit();
  });
}
$('wp-heading').addEventListener('input', (e) => {
  if (Number.isFinite(e.target.valueAsNumber)) {
    current().heading = e.target.valueAsNumber;
    commit();
  }
});

for (const b of document.querySelectorAll('[data-add]')) {
  b.addEventListener('click', () => {
    const type = b.dataset.add;
    current().actions.push(type === 'wait' ? { type, seconds: 3 } : { type });
    commit();
  });
}
$('wp-delete').addEventListener('click', () => removeWaypoint(selected));

// ---------- Formulario de la misión (los dos modos) ----------

$('m-name').addEventListener('input', (e) => {
  mission.name = e.target.value;
  commit();
});
$('m-finish').addEventListener('change', (e) => {
  mission.finishAction = e.target.value;
  commit();
});
$('m-signal').addEventListener('change', (e) => {
  mission.onSignalLost = e.target.value;
  commit();
});

for (const radio of document.querySelectorAll('input[name="mission-type"]')) {
  radio.addEventListener('change', () => {
    if ((radio.value === 'area') === isArea()) return;
    if (hasContent() && !confirm('Cambiar el tipo de misión sustituye la misión en curso. ¿Continuar?')) {
      commit(); // vuelve a marcar el tipo actual
      return;
    }
    mission = radio.value === 'area' ? emptyArea() : emptyMission();
    selected = null;
    selectedVertex = null;
    commit();
  });
}

// ---------- Búsqueda (FR-001) ----------

$('search').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = $('search-input').value.trim();
  if (!q) return;
  const coords = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (coords) {
    const [lat, lon] = [Number(coords[1]), Number(coords[2])];
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) notify('Coordenadas fuera de rango.', 'error');
    else map.setView([lat, lon], 17);
    return;
  }
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const [place] = await (await fetch(url, { headers: { 'Accept-Language': 'es' } })).json();
    if (place) map.setView([Number(place.lat), Number(place.lon)], 16);
    else notify('Lugar no encontrado.', 'warn');
  } catch {
    notify('No se pudo buscar: comprueba la conexión.', 'error');
  }
});

// ---------- KMZ ----------

let fileMode = 'open';
function pickFile(mode) {
  fileMode = mode;
  $('file-input').value = '';
  $('file-input').click();
}
$('btn-reference').addEventListener('click', () => pickFile('reference'));
$('btn-open').addEventListener('click', () => pickFile('open'));

$('file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const files = await unzip(new Uint8Array(await file.arrayBuffer()));
    if (fileMode === 'reference') loadReference(files);
    else openMission(files, file.name.replace(/\.kmz$/i, ''));
  } catch (err) {
    notify(err.message, 'error');
  }
});

function loadReference(files) {
  const p = parseProfile(files);
  const ok = confirm(
    'Valores detectados en el KMZ:\n' +
      `• Namespace: ${p.namespace}\n` +
      `• Dron (enum/subenum): ${p.droneEnumValue}/${p.droneSubEnumValue}\n\n` +
      '¿Este KMZ lo exportaste de tu Air 3S desde DJI Fly?'
  );
  if (!ok) {
    notify('KMZ de referencia descartado.');
    return;
  }
  profile = p;
  store(PROFILE_KEY, profile);
  renderProfile();
  notify('KMZ de referencia cargado.');
}

function openMission(files, name) {
  const { mission: loaded, warnings } = parseMission(files, name);
  if (hasContent() && !confirm('Abrir este KMZ sustituye la misión en curso. ¿Continuar?')) return;
  mission = loaded;
  selected = null;
  commit();
  fitMission();
  const title = `Misión "${mission.name}" abierta: ${mission.waypoints.length} waypoints.`;
  if (warnings.length) showIssues(`${title} Avisos:`, warnings.map((message) => ({ message })), 'warn');
  else notify(title);
}

$('btn-new').addEventListener('click', () => {
  if (hasContent() && !confirm('Empezar una misión nueva sustituye la misión en curso. ¿Continuar?')) return;
  mission = isArea() ? emptyArea() : emptyMission();
  selected = null;
  selectedVertex = null;
  commit();
});

const fileName = (name) => name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'mision';

function kmzLink(m, file, text) {
  const blob = new Blob([zip(buildFiles(m, profile))], { type: 'application/vnd.google-earth.kmz' });
  const a = link(URL.createObjectURL(blob), text);
  a.download = file;
  return a;
}

/** Un aviso por tipo: en un área todas las fotos tienen la misma altura. */
function uniqueWarnings(warnings) {
  const seen = new Set();
  return warnings
    .filter((w) => !seen.has(w.field) && seen.add(w.field))
    .map((w) => w.message.replace(/^Waypoint \d+: (.)/, (_, c) => c.toUpperCase()));
}

function exportArea() {
  const g = mission.closed ? computeGrid(mission) : null;
  if (!g || g.error) {
    notify(g?.error ?? 'Cierra un área válida antes de exportar.', 'error');
    return;
  }
  const missions = toMissions(mission, g);
  const n = missions.length;
  const errors = missions.flatMap((m, k) =>
    validate(m).errors.map((e) => ({ message: n > 1 ? `Parte ${k + 1}: ${e.message}` : e.message }))
  );
  if (errors.length) {
    showIssues('No se puede exportar. Corrige esto:', errors, 'error');
    return;
  }
  if (!profile) {
    notify('Para exportar necesitas cargar el KMZ de referencia de tu DJI Fly. ', 'warn',
      link('ayuda.html#referencia', 'Cómo obtenerlo'));
    return;
  }
  const warnings = uniqueWarnings(missions.flatMap((m) => validate(m).warnings));
  if (warnings.length && !confirm(`Revisa estos avisos antes de exportar:\n\n${warnings.map((w) => `• ${w}`).join('\n')}\n\n¿Exportar igualmente?`)) return;

  const base = fileName(mission.name);
  const list = document.createElement('ul');
  missions.forEach((m, k) => {
    const li = document.createElement('li');
    li.append(n === 1
      ? kmzLink(m, `${base}.kmz`, 'Descargar KMZ')
      : kmzLink(m, `${base}-parte-${k + 1}-de-${n}.kmz`, `Parte ${k + 1} de ${n}`));
    list.append(li);
  });
  notify(n === 1 ? 'KMZ listo. ' : `${n} KMZ listos, uno por batería. `, 'info',
    link('ayuda.html#ortomosaico', 'Cómo volar un ortomosaico'), list);
}

$('btn-export').addEventListener('click', () => {
  if (!WPML_VERIFIED) {
    notify('Exportación desactivada hasta verificar el formato con tu KMZ real de DJI Fly. ', 'warn',
      link('ayuda.html#referencia', 'Cómo obtenerlo'));
    return;
  }
  if (isArea()) {
    exportArea();
    return;
  }
  const { errors, warnings } = validate(mission);
  if (errors.length) {
    showIssues('No se puede exportar. Corrige esto:', errors, 'error');
    return;
  }
  if (!profile) {
    notify('Para exportar necesitas cargar el KMZ de referencia de tu DJI Fly. ', 'warn',
      link('ayuda.html#referencia', 'Cómo obtenerlo'));
    return;
  }
  if (warnings.length) {
    const text = warnings.map((w) => `• ${w.message}`).join('\n');
    if (!confirm(`Revisa estos avisos antes de exportar:\n\n${text}\n\n¿Exportar igualmente?`)) return;
  }
  const blob = new Blob([zip(buildFiles(mission, profile))], { type: 'application/vnd.google-earth.kmz' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${fileName(mission.name)}.kmz`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  notify('KMZ descargado. ', 'info', link('ayuda.html#transferir', 'Cómo instalarlo en DJI Fly'));
});

// ---------- Inicio ----------

commit();
renderProfile();
fitMission();
