// Simulación 2D: línea de tiempo y estado del dron (specs/003-flight-simulation).
import { effective, timing } from './mission.js';
import { computeGrid, footprint, photoSeconds } from './grid.js';

// ponytail: estimación prudente; la vuelta real de DJI Fly suele ser más rápida.
export const CLIMB_RATE = 5; // m/s de subida y bajada

const EARTH_RADIUS = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

function haversine(a, b) {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
}

function bearing(a, b) {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Puntos de la misión, partes y tiempos, con el mismo modelo que el resumen (research R1). */
function plan(mission) {
  if (mission.type === 'area') {
    const grid = mission.closed ? computeGrid(mission) : null;
    if (!grid?.photos) return null;
    const { height, speed, resolution } = mission.params;
    const points = grid.photos.map((p) => ({ lat: p.lat, lon: p.lon, height }));
    const n = grid.parts.length;
    return {
      points,
      parts: grid.parts.map((p, k) => ({ start: p.start, end: p.end, finish: k === n - 1 ? mission.finishAction : 'goHome' })),
      leg: (i) => haversine(points[i], points[i + 1]) / speed,
      stop: () => photoSeconds(resolution),
      actions: () => [{ type: 'photo' }],
      transitSpeed: speed,
      direction: grid.direction,
      photoHeight: height,
    };
  }
  const w = mission.waypoints;
  if (w.length < 2) return null;
  const { legs, stops } = timing(mission);
  return {
    points: w.map((wp) => ({ lat: wp.lat, lon: wp.lon, height: effective(mission, wp, 'height') })),
    parts: [{ start: 0, end: w.length, finish: mission.finishAction }],
    leg: (i) => legs[i],
    stop: (i) => stops[i],
    actions: (i) => w[i].actions,
    transitSpeed: mission.defaults.speed,
    direction: null,
    photoHeight: null,
  };
}

/** null si no hay punto de despegue o no hay ruta. No modifica la misión (FR-009). */
export function buildTimeline(mission) {
  const home = mission.takeoff;
  const p = home ? plan(mission) : null;
  if (!p) return null;

  const segments = [];
  let t = 0;
  let d = 0;
  let missionSeconds = 0;
  const ground = { lat: home.lat, lon: home.lon, height: 0 };
  const push = (kind, phase, from, to, dt, part, point = null) => {
    const length = kind === 'fly' ? haversine(from, to) : 0;
    segments.push({ kind, phase, t0: t, dt, from, to, d0: d, length, part, point });
    t += dt;
    d += length;
  };

  const batteries = p.parts.map((part, k) => {
    const start = t;
    const first = p.points[part.start];
    const air = { lat: home.lat, lon: home.lon, height: first.height };
    push('climb', 'despegue', ground, air, first.height / CLIMB_RATE, k);
    push('fly', 'ida', air, first, haversine(air, first) / p.transitSpeed, k, part.start);
    for (let i = part.start; i < part.end; i++) {
      if (i > part.start) {
        push('fly', 'mision', p.points[i - 1], p.points[i], p.leg(i - 1), k, i);
        missionSeconds += p.leg(i - 1);
      }
      push('stop', 'mision', p.points[i], p.points[i], p.stop(i), k, i);
      missionSeconds += p.stop(i);
    }
    const last = p.points[part.end - 1];
    if (part.finish === 'goHome') {
      const back = { lat: home.lat, lon: home.lon, height: last.height };
      push('fly', 'vuelta', last, back, haversine(last, back) / p.transitSpeed, k);
      push('descend', 'aterrizaje', back, ground, last.height / CLIMB_RATE, k);
    } else if (part.finish === 'autoLand') {
      push('descend', 'aterrizaje', last, { ...last, height: 0 }, last.height / CLIMB_RATE, k);
    }
    return { part: k, seconds: t - start, returnsHome: part.finish === 'goHome' };
  });

  // Rumbo y último punto alcanzado al empezar cada segmento.
  let heading = bearing(segments[1].from, segments[1].to); // antes del primer vuelo: el de la ida
  let reached = -1;
  for (const s of segments) {
    if (s.kind === 'fly' && s.length > 0) heading = bearing(s.from, s.to);
    s.heading = heading;
    s.reachedBefore = reached;
    if (s.kind === 'stop') reached = s.point;
  }

  return {
    segments,
    points: p.points,
    total: t,
    missionSeconds,
    batteries,
    direction: p.direction,
    photoHeight: p.photoHeight,
    actions: p.actions,
  };
}

/** Estado del dron en el instante t (búsqueda binaria, research R2). */
export function stateAt(timeline, t) {
  const time = Math.min(Math.max(t, 0), timeline.total);
  const segs = timeline.segments;
  let lo = 0;
  let hi = segs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (segs[mid].t0 <= time) lo = mid;
    else hi = mid - 1;
  }
  const s = segs[lo];
  const f = s.dt > 0 ? Math.min(1, (time - s.t0) / s.dt) : 1;
  const lerp = (a, b) => a + (b - a) * f;
  return {
    lat: lerp(s.from.lat, s.to.lat),
    lon: lerp(s.from.lon, s.to.lon),
    height: lerp(s.from.height, s.to.height),
    heading: s.heading,
    phase: s.phase,
    part: s.part,
    reached: s.kind === 'stop' ? s.point : s.reachedBefore,
    distance: s.d0 + s.length * f,
    elapsed: time,
    remaining: timeline.total - time,
    index: lo,
    segment: s,
  };
}

/** Las 4 esquinas de la huella de una foto, con el lado largo transversal a la pasada. */
export function footprintPolygon(center, height, direction) {
  const { across, along } = footprint(height);
  const t = rad(direction);
  const u = { x: Math.sin(t), y: Math.cos(t) }; // avance
  const v = { x: Math.cos(t), y: -Math.sin(t) }; // transversal
  const ky = (EARTH_RADIUS * Math.PI) / 180;
  const kx = ky * Math.cos(rad(center.lat));
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => {
    const x = ((a * along) / 2) * u.x + ((b * across) / 2) * v.x;
    const y = ((a * along) / 2) * u.y + ((b * across) / 2) * v.y;
    return { lat: center.lat + y / ky, lon: center.lon + x / kx };
  });
}
