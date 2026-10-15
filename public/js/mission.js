// Modelo de misión, límites del Air 3S en DJI Fly y validación (data-model.md).

// Valores provisionales hasta confirmarlos en DJI Fly (research R4, tarea T037).
export const LIMITS = Object.freeze({
  waypoints: Object.freeze({ min: 2, max: 200 }),
  height: Object.freeze({ min: 2, max: 500, warnAbove: 120 }),
  speed: Object.freeze({ min: 1, max: 15 }),
  gimbalPitch: Object.freeze({ min: -90, max: 0 }),
  waitSeconds: Object.freeze({ min: 1, max: 30 }),
  minSegment: 1, // m entre waypoints consecutivos
  warnDuration: 2100, // s (35 min, 80 % de la autonomía del Air 3S)
});

// ponytail: 2 s por parada es heurístico; ajustar comparando con la estimación de DJI Fly.
const STOP_SECONDS = 2;
const EARTH_RADIUS = 6371008.8;

export function emptyMission() {
  return {
    name: 'Misión',
    defaults: { height: 50, speed: 5, gimbalPitch: -30 },
    finishAction: 'goHome',
    onSignalLost: 'lostAction',
    waypoints: [],
    takeoff: null, // {lat, lon} del punto de despegue (feature 003)
  };
}

/** Ruta cerrada: el último waypoint está en la misma posición que el primero. */
export function isClosed(mission) {
  const w = mission.waypoints;
  const first = w[0];
  const last = w[w.length - 1];
  return w.length >= 4 && first.lat === last.lat && first.lon === last.lon;
}

/** Cierra la ruta con un waypoint final en el punto 1 (misma altura y gimbal, sin acciones). */
export function closeRoute(mission) {
  const first = mission.waypoints[0];
  mission.waypoints.push({ ...first, speed: null, heading: null, actions: [] });
}

/** Valor que vuela el dron: el del waypoint o, si es null, el de la misión. */
export function effective(mission, wp, field) {
  return wp[field] ?? mission.defaults[field];
}

const rad = (deg) => (deg * Math.PI) / 180;

function horizontal(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
}

/** Longitud del tramo i → i+1, en 3D. */
function segment(mission, i) {
  const a = mission.waypoints[i];
  const b = mission.waypoints[i + 1];
  const dz = effective(mission, b, 'height') - effective(mission, a, 'height');
  return Math.hypot(horizontal(a, b), dz);
}

export function distance(mission) {
  let total = 0;
  for (let i = 0; i < mission.waypoints.length - 1; i++) total += segment(mission, i);
  return total;
}

/**
 * Única fuente del tiempo de una ruta (resumen y simulación).
 * distances y legs: los n−1 tramos (m y s). stops: las n paradas (s), con sus esperas.
 */
export function timing(mission) {
  const distances = [];
  const legs = [];
  const stops = [];
  mission.waypoints.forEach((wp, i) => {
    stops.push(STOP_SECONDS + wp.actions.reduce((s, a) => s + (a.type === 'wait' ? a.seconds : 0), 0));
    if (i < mission.waypoints.length - 1) {
      const d = segment(mission, i);
      distances.push(d);
      legs.push(d / effective(mission, wp, 'speed'));
    }
  });
  return { distances, legs, stops };
}

export function duration(mission) {
  const { legs, stops } = timing(mission);
  return [...legs, ...stops].reduce((s, x) => s + x, 0);
}

const RANGES = [
  ['height', 'altura', 'm'],
  ['speed', 'velocidad', 'm/s'],
  ['gimbalPitch', 'ángulo del gimbal', '°'],
];

const inRange = (v, { min, max }) => v >= min && v <= max; // false también para NaN

export function validate(mission) {
  const errors = [];
  const warnings = [];
  const add = (list, waypoint, field, value, limit, message) =>
    list.push({ waypoint, field, value, limit, message });
  const n = mission.waypoints.length;

  const nameLength = mission.name.trim().length;
  if (nameLength < 1 || nameLength > 60) {
    add(errors, null, 'name', nameLength, '1–60', 'El nombre de la misión debe tener entre 1 y 60 caracteres.');
  }
  if (n < LIMITS.waypoints.min) {
    add(errors, null, 'waypoints', n, `mínimo ${LIMITS.waypoints.min}`,
      `La misión necesita al menos ${LIMITS.waypoints.min} waypoints (tiene ${n}).`);
  }
  if (n > LIMITS.waypoints.max) {
    add(errors, null, 'waypoints', n, `máximo ${LIMITS.waypoints.max}`,
      `La misión tiene ${n} waypoints; DJI Fly admite como máximo ${LIMITS.waypoints.max}.`);
  }

  mission.waypoints.forEach((wp, i) => {
    const num = i + 1;
    for (const [field, label, unit] of RANGES) {
      const v = effective(mission, wp, field);
      const { min, max } = LIMITS[field];
      if (!inRange(v, LIMITS[field])) {
        add(errors, num, field, v, `${min} a ${max} ${unit}`,
          `Waypoint ${num}: ${label} ${v} ${unit} fuera del límite (${min} a ${max} ${unit}).`);
      }
    }
    if (wp.heading !== null && !(wp.heading >= 0 && wp.heading < 360)) {
      add(errors, num, 'heading', wp.heading, '0 a 359°', `Waypoint ${num}: rumbo ${wp.heading}° fuera del rango 0 a 359°.`);
    }
    for (const a of wp.actions) {
      if (a.type === 'wait' && !inRange(a.seconds, LIMITS.waitSeconds)) {
        const { min, max } = LIMITS.waitSeconds;
        add(errors, num, 'wait', a.seconds, `${min} a ${max} s`,
          `Waypoint ${num}: espera de ${a.seconds} s fuera del límite (${min} a ${max} s).`);
      }
    }
    if (i > 0 && segment(mission, i - 1) < LIMITS.minSegment) {
      add(errors, num, 'position', segment(mission, i - 1), `≥ ${LIMITS.minSegment} m`,
        `Waypoint ${num}: está a menos de ${LIMITS.minSegment} m del waypoint ${i}.`);
    }
    const height = effective(mission, wp, 'height');
    if (height > LIMITS.height.warnAbove) {
      add(warnings, num, 'height', height, `${LIMITS.height.warnAbove} m`,
        `Waypoint ${num}: ${height} m sobre el punto de despegue (más de ${LIMITS.height.warnAbove} m). ` +
        'Esta altura no tiene en cuenta el relieve del terreno.');
    }
  });

  const seconds = duration(mission);
  if (seconds > LIMITS.warnDuration) {
    add(warnings, null, 'duration', seconds, `${LIMITS.warnDuration / 60} min`,
      `Tiempo estimado de ${Math.round(seconds / 60)} min: supera el 80 % de la autonomía del Air 3S.`);
  }
  return { errors, warnings };
}
