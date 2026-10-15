import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyMission, duration } from '../public/js/mission.js';
import { emptyArea, computeGrid, footprint } from '../public/js/grid.js';
import { CLIMB_RATE, buildTimeline, stateAt, footprintPolygon } from '../public/js/sim.js';

// ---------- Misiones de prueba (T001), en metros respecto a un origen ----------

const ORIGIN = { lat: 40.4168, lon: -3.7038 };
const KY = (6371008.8 * Math.PI) / 180;
const KX = KY * Math.cos((ORIGIN.lat * Math.PI) / 180);
const at = ([x, y]) => ({ lat: ORIGIN.lat + y / KY, lon: ORIGIN.lon + x / KX });
const meters = (a, b) => Math.hypot((b.lon - a.lon) * KX, (b.lat - a.lat) * KY);

const wp = (xy, extra = {}) => ({ ...at(xy), height: null, speed: null, gimbalPitch: null, heading: null, actions: [], ...extra });

function route(extra = {}) {
  return {
    ...emptyMission(),
    takeoff: at([-50, -50]),
    waypoints: [
      wp([0, 0], { actions: [{ type: 'photo' }] }),
      wp([100, 0], { actions: [{ type: 'wait', seconds: 3 }] }),
      wp([100, 100], { height: 80 }),
      wp([0, 100]),
    ],
    ...extra,
  };
}

function area(size, extra = {}) {
  const a = emptyArea();
  return {
    ...a,
    vertices: [[0, 0], [size, 0], [size, size], [0, size]].map(at),
    closed: true,
    takeoff: at([-50, -50]),
    ...extra,
  };
}

const SMALL = () => area(140); // ~2 ha, una parte
const BIG = () => area(600); // varias partes

function contiguous(tl) {
  return tl.segments.every((s, i) => i === 0 || Math.abs(tl.segments[i - 1].t0 + tl.segments[i - 1].dt - s.t0) < 1e-9);
}

// ---------- US1: áreas ----------

test('buildTimeline es null sin despegue o sin área cerrada', () => {
  assert.equal(buildTimeline({ ...SMALL(), takeoff: null }), null);
  assert.equal(buildTimeline({ ...SMALL(), closed: false }), null);
  assert.equal(buildTimeline({ ...route(), waypoints: [] }), null);
});

for (const [label, make] of [['una parte', SMALL], ['varias partes', BIG]]) {
  test(`área (${label}): el tiempo de misión coincide con el resumen (SC-001)`, () => {
    const a = make();
    const tl = buildTimeline(a);
    const grid = computeGrid(a);
    assert.ok(Math.abs(tl.missionSeconds - grid.stats.duration) < 1, `${tl.missionSeconds} vs ${grid.stats.duration}`);
    assert.ok(contiguous(tl));
    assert.equal(tl.batteries.length, grid.parts.length);
    const sum = tl.batteries.reduce((s, b) => s + b.seconds, 0);
    assert.ok(Math.abs(sum - tl.total) < 1e-6);
  });
}

test('área de varias partes: cada parte despega, va, mapea, vuelve y aterriza', () => {
  const tl = buildTimeline(BIG());
  assert.ok(tl.batteries.length > 1);
  for (const b of tl.batteries) {
    const phases = tl.segments.filter((s) => s.part === b.part).map((s) => s.phase);
    const compact = phases.filter((p, i) => p !== phases[i - 1]);
    assert.deepEqual(compact, ['despegue', 'ida', 'mision', 'vuelta', 'aterrizaje'], `parte ${b.part + 1}`);
    assert.equal(b.returnsHome, true);
  }
});

// ---------- US1: estado y huella ----------

test('stateAt: empieza y termina en tierra en el despegue', () => {
  const a = SMALL();
  const tl = buildTimeline(a);
  const start = stateAt(tl, 0);
  assert.ok(meters(start, a.takeoff) < 0.01 && start.height === 0);
  assert.equal(start.phase, 'despegue');
  const end = stateAt(tl, tl.total);
  assert.ok(meters(end, a.takeoff) < 0.01 && Math.abs(end.height) < 1e-9);
  assert.equal(stateAt(tl, -10).elapsed, 0);
  assert.equal(stateAt(tl, tl.total + 10).remaining, 0);
});

test('stateAt: punto medio de un tramo, rumbo y fotos alcanzadas', () => {
  const tl = buildTimeline(SMALL());
  const leg = tl.segments.find((s) => s.kind === 'fly' && s.phase === 'mision');
  const mid = stateAt(tl, leg.t0 + leg.dt / 2);
  assert.ok(Math.abs(mid.lat - (leg.from.lat + leg.to.lat) / 2) < 1e-9);
  assert.equal(mid.reached, leg.point - 1);
  const stop = tl.segments.find((s) => s.kind === 'stop' && s.point === leg.point);
  assert.equal(stateAt(tl, stop.t0 - 1e-6).reached, leg.point - 1);
  assert.equal(stateAt(tl, stop.t0 + 1e-6).reached, leg.point);
  const climb = stateAt(tl, 1);
  const ida = tl.segments[1];
  assert.equal(climb.heading, ida.heading, 'durante la subida, rumbo de la ida');
});

test('stateAt es rápido: 10 000 consultas en menos de 250 ms (SC-002)', () => {
  const tl = buildTimeline(BIG());
  const started = performance.now();
  for (let i = 0; i < 10000; i++) stateAt(tl, Math.random() * tl.total);
  assert.ok(performance.now() - started < 250);
});

test('footprintPolygon: lados across × along, lado largo transversal', () => {
  const center = at([0, 0]);
  const { across, along } = footprint(60);
  const [a, b, c] = footprintPolygon(center, 60, 0);
  // Dirección 0 (norte): a→b es transversal (este-oeste) y b→c en avance (norte-sur).
  assert.ok(Math.abs(meters(a, b) / across - 1) < 0.005);
  assert.ok(Math.abs(meters(b, c) / along - 1) < 0.005);
  assert.ok(Math.abs(b.lat - a.lat) < 1e-9, 'lado largo este-oeste con pasadas norte-sur');
});

// ---------- US3: rutas ----------

test('ruta: el tiempo de misión es exactamente duration()', () => {
  const m = route();
  const tl = buildTimeline(m);
  assert.ok(Math.abs(tl.missionSeconds - duration(m)) < 1e-6);
  assert.ok(contiguous(tl));
  const stop = tl.segments.find((s) => s.kind === 'stop' && s.point === 1);
  assert.equal(stop.dt, 5);
  assert.equal(tl.actions(1)[0].type, 'wait');
});

test('ruta: la subida va a la altura del WP1 y los tramos interpolan la altura', () => {
  const tl = buildTimeline(route());
  assert.equal(tl.segments[0].kind, 'climb');
  assert.equal(tl.segments[0].dt, 50 / CLIMB_RATE);
  const toWp3 = tl.segments.find((s) => s.kind === 'fly' && s.point === 2);
  assert.equal(stateAt(tl, toWp3.t0 + toWp3.dt / 2).height, 65); // de 50 a 80 m
});

test('ruta cerrada: la misión termina en el WP1', () => {
  const m = route();
  m.waypoints.push({ ...m.waypoints[0], actions: [] });
  const tl = buildTimeline(m);
  const lastStop = tl.segments.filter((s) => s.kind === 'stop').at(-1);
  assert.ok(meters(lastStop.to, m.waypoints[0]) < 1e-6);
});

test('ruta: aterrizar en el sitio o quedarse en el sitio', () => {
  const land = buildTimeline(route({ finishAction: 'autoLand' }));
  assert.equal(land.segments.at(-1).kind, 'descend');
  assert.ok(!land.segments.some((s) => s.phase === 'vuelta'));
  const stay = buildTimeline(route({ finishAction: 'noAction' }));
  assert.equal(stay.segments.at(-1).kind, 'stop');
  assert.equal(stay.batteries[0].returnsHome, false);
});
