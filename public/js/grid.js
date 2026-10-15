// Cuadrícula de mapeo para ortomosaico (specs/002-mapping-grid, research R1–R5).
import { LIMITS } from './mission.js';

export const CAMERA = Object.freeze({
  dfov: 84, // grados, campo de visión diagonal de la cámara principal del Air 3S
  aspect: Object.freeze([4, 3]),
  // 50 MP verificado en la ficha de DJI. 12 MP provisional: confirmar con EXIF (T027).
  width: Object.freeze({ 12: 4096, 50: 8192 }),
  minInterval: Object.freeze({ 12: 2, 50: 5 }), // s, modo temporizado (ficha de DJI)
});

export const MAPPING_LIMITS = Object.freeze({
  overlap: Object.freeze({ min: 50, max: 90 }), // %
  partSeconds: 1500, // 25 min de mapeo por parte (FR-015)
  partWaypoints: LIMITS.waypoints.max,
  maxPhotos: 20000, // por encima no se calcula la ruta (FR-019)
});

const STOP_SECONDS = 2; // igual que mission.js
// ponytail: heurístico; ajustar tras el vuelo de prueba (T028).
const PHOTO_EXTRA_SECONDS = { 12: 1, 50: 3 };
const EARTH_RADIUS = 6371008.8;

const rad = (deg) => (deg * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

export function emptyArea() {
  return {
    type: 'area',
    name: 'Mapeo',
    vertices: [],
    closed: false,
    params: { height: 60, resolution: 12, frontOverlap: 80, sideOverlap: 70, direction: null, speed: 5, captureMode: 'stop' },
    finishAction: 'goHome',
    onSignalLost: 'lostAction',
    takeoff: null, // {lat, lon} del punto de despegue (feature 003)
  };
}

/** Segundos por foto en modo parada: parada + tiempo de cámara. */
export const photoSeconds = (resolution) => STOP_SECONDS + PHOTO_EXTRA_SECONDS[resolution];

/** Terreno que cubre una foto vertical: lado largo transversal, lado corto en avance (R1, R2). */
export function footprint(height) {
  const diagonal = 2 * height * Math.tan(rad(CAMERA.dfov / 2));
  const [w, h] = CAMERA.aspect;
  const d = Math.hypot(w, h);
  return { across: (diagonal * w) / d, along: (diagonal * h) / d };
}

export const gsd = (height, resolution) => (100 * footprint(height).across) / CAMERA.width[resolution];

export const heightForGsd = (cmPerPx, resolution) => (cmPerPx * CAMERA.width[resolution]) / (100 * footprint(1).across);

// ---------- Geometría local ----------

/** Proyección equirectangular centrada en el polígono; error despreciable a escala de mapeo. */
function projection(vertices) {
  const lat0 = vertices.reduce((s, v) => s + v.lat, 0) / vertices.length;
  const lon0 = vertices.reduce((s, v) => s + v.lon, 0) / vertices.length;
  const ky = (EARTH_RADIUS * Math.PI) / 180;
  const kx = ky * Math.cos(rad(lat0));
  return {
    toLocal: (p) => ({ x: (p.lon - lon0) * kx, y: (p.lat - lat0) * ky }),
    toLatLon: (q) => ({ lat: lat0 + q.y / ky, lon: lon0 + q.x / kx }),
  };
}

const rotate = (p, a) => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) });
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

export function areaHectares(vertices) {
  if (vertices.length < 3) return 0;
  const { toLocal } = projection(vertices);
  const p = vertices.map(toLocal);
  let twice = 0;
  p.forEach((a, i) => {
    const b = p[(i + 1) % p.length];
    twice += a.x * b.y - b.x * a.y;
  });
  return Math.abs(twice) / 2 / 10000;
}

const orient = (a, b, c) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));

/** false si dos lados no contiguos se cruzan. */
export function isSimple(vertices) {
  const n = vertices.length;
  if (n < 4) return true;
  const { toLocal } = projection(vertices);
  const p = vertices.map(toLocal);
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // lados contiguos
      const [a, b, c, d] = [p[i], p[(i + 1) % n], p[j], p[(j + 1) % n]];
      if (orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0) return false;
    }
  }
  return true;
}

/** Rumbo 0–179° del lado más largo (0 = norte). */
export function autoDirection(vertices) {
  const { toLocal } = projection(vertices);
  const p = vertices.map(toLocal);
  let best = { length: -1, bearing: 0 };
  p.forEach((a, i) => {
    const b = p[(i + 1) % p.length];
    const length = dist(a, b);
    if (length > best.length) best = { length, bearing: deg(Math.atan2(b.x - a.x, b.y - a.y)) };
  });
  return ((best.bearing % 180) + 180) % 180;
}

/** Recorta el polígono al semiplano y >= limit (above) o y <= limit (Sutherland–Hodgman). */
function clipY(poly, limit, above) {
  const inside = (p) => (above ? p.y >= limit : p.y <= limit);
  const out = [];
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length];
    if (inside(p)) out.push(p);
    if (inside(p) !== inside(q)) out.push({ x: p.x + ((limit - p.y) / (q.y - p.y)) * (q.x - p.x), y: limit });
  });
  return out;
}

/** Extensión en x del polígono dentro de la franja [y1, y2], o null. */
function xRange(poly, y1, y2) {
  const strip = clipY(clipY(poly, y1, true), y2, false);
  if (!strip.length) return null;
  const xs = strip.map((p) => p.x);
  return [Math.min(...xs), Math.max(...xs)];
}

const serpentine = (passes, flip) => passes.flatMap((pass, k) => ((k % 2 === 0) !== flip ? pass : [...pass].reverse()));

function paramsError({ height, speed, frontOverlap, sideOverlap }) {
  const { min, max } = MAPPING_LIMITS.overlap;
  if (!(height > 0) || !(speed > 0)) return 'La altura y la velocidad deben ser mayores que 0.';
  if (!(frontOverlap >= min && frontOverlap <= max && sideOverlap >= min && sideOverlap <= max)) {
    return `Los solapes deben estar entre ${min} y ${max} %.`;
  }
  return null;
}

// ---------- Cuadrícula ----------

/**
 * @returns {null | {error: string} | {photos, lines, parts, direction, stats}}
 * null: área sin cerrar o con lados cruzados. {error}: no se puede calcular (FR-019).
 */
export function computeGrid(area) {
  const { vertices, params } = area;
  if (!area.closed || vertices.length < 3 || !isSimple(vertices)) return null;
  const error = paramsError(params);
  if (error) return { error };

  const direction = params.direction ?? autoDirection(vertices);
  const turn = rad(direction - 90); // deja las pasadas paralelas al eje x
  const proj = projection(vertices);
  const poly = vertices.map((v) => rotate(proj.toLocal(v), turn));
  const { across, along } = footprint(params.height);
  const lineGap = across * (1 - params.sideOverlap / 100);
  const photoGap = along * (1 - params.frontOverlap / 100);

  const ys = poly.map((p) => p.y);
  const xs = poly.map((p) => p.x);
  const [ymin, ymax] = [Math.min(...ys), Math.max(...ys)];
  const lineCount = Math.max(1, Math.ceil((ymax - ymin) / lineGap));
  const estimate = lineCount * (Math.ceil((Math.max(...xs) - Math.min(...xs)) / photoGap) + 1);
  if (estimate > MAPPING_LIMITS.maxPhotos) {
    return { error: `Demasiadas fotos (unas ${estimate.toLocaleString('es-ES')}): sube la altura o reduce el área.` };
  }

  // Pasadas centradas; cada una cubre la franja de ±lineGap/2 a su alrededor (R3).
  // ponytail: en formas cóncavas se fotografía también el hueco; quitar fotos cuya huella no toque el polígono si sobran.
  const y0 = (ymin + ymax) / 2 - ((lineCount - 1) * lineGap) / 2;
  const passes = [];
  for (let k = 0; k < lineCount; k++) {
    const y = y0 + k * lineGap;
    const span = xRange(poly, y - lineGap / 2, y + lineGap / 2);
    if (!span) continue;
    const count = Math.ceil((span[1] - span[0]) / photoGap) + 1;
    const start = (span[0] + span[1]) / 2 - ((count - 1) * photoGap) / 2;
    passes.push(Array.from({ length: count }, (_, i) => ({ x: start + i * photoGap, y })));
  }

  // Ida y vuelta, empezando por el extremo más cercano al despegue (feature 003, FR-014) o al vértice 1.
  const anchor = area.takeoff ? rotate(proj.toLocal(area.takeoff), turn) : poly[0];
  const candidates = [passes, [...passes].reverse()].flatMap((ps) => [serpentine(ps, false), serpentine(ps, true)]);
  const route = candidates.reduce((best, c) => (dist(c[0], anchor) < dist(best[0], anchor) ? c : best));

  // Partes de 25 min y 200 waypoints como máximo (R5).
  const perPhoto = photoSeconds(params.resolution);
  const parts = [];
  let first = 0;
  let seconds = 0;
  let distance = 0;
  route.forEach((q, i) => {
    const leg = i > 0 ? dist(route[i - 1], q) : 0;
    distance += leg;
    const added = (i > first ? leg / params.speed : 0) + perPhoto;
    if (i > first && (seconds + added > MAPPING_LIMITS.partSeconds || i - first + 1 > MAPPING_LIMITS.partWaypoints)) {
      parts.push({ start: first, end: i });
      first = i;
      seconds = perPhoto;
    } else {
      seconds += added;
    }
  });
  parts.push({ start: first, end: route.length });
  // Una misión de DJI Fly necesita al menos 2 waypoints: la última parte no puede quedarse con 1.
  const last = parts.at(-1);
  if (parts.length > 1 && last.end - last.start < 2) {
    parts.at(-2).end--;
    last.start--;
  }
  // Tiempo de cada parte. Entre partes el dron vuelve a casa, así que ese tramo no cuenta (feature 003).
  for (const part of parts) {
    part.seconds = (part.end - part.start) * perPhoto;
    for (let i = part.start + 1; i < part.end; i++) part.seconds += dist(route[i - 1], route[i]) / params.speed;
  }

  const photos = route.map((q) => proj.toLatLon(rotate(q, -turn)));
  return {
    photos,
    lines: passes.length,
    parts,
    direction,
    stats: {
      areaHa: areaHectares(vertices),
      gsd: gsd(params.height, params.resolution),
      lines: passes.length,
      photos: photos.length,
      distance,
      duration: parts.reduce((s, p) => s + p.seconds, 0),
      batteries: parts.length,
    },
  };
}

/** Una Mission de la feature 001 por parte (data-model, "Missions de exportación"). */
export function toMissions(area, grid) {
  const n = grid.parts.length;
  return grid.parts.map(({ start, end }, k) => {
    const suffix = n === 1 ? '' : ` parte ${k + 1} de ${n}`;
    return {
      name: area.name.slice(0, 60 - suffix.length) + suffix,
      defaults: { height: area.params.height, speed: area.params.speed, gimbalPitch: -90 },
      finishAction: k === n - 1 ? area.finishAction : 'goHome',
      onSignalLost: area.onSignalLost,
      waypoints: grid.photos.slice(start, end).map(({ lat, lon }) => ({
        lat,
        lon,
        height: null,
        speed: null,
        gimbalPitch: null,
        heading: null,
        actions: [{ type: 'photo' }],
      })),
    };
  });
}
