globalThis.DOMParser ??= (await import('@xmldom/xmldom')).DOMParser;

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMERA, MAPPING_LIMITS, emptyArea, photoSeconds, footprint, gsd, heightForGsd,
  areaHectares, isSimple, autoDirection, computeGrid, toMissions,
} from '../public/js/grid.js';
import { validate } from '../public/js/mission.js';
import { buildFiles, parseMission } from '../public/js/wpml.js';
import { zip, unzip } from '../public/js/kmz.js';

// ---------- Polígonos de prueba, definidos en metros alrededor de un origen ----------

const ORIGIN = { lat: 40.4168, lon: -3.7038 };
const R = 6371008.8;
const KY = (R * Math.PI) / 180;
const KX = KY * Math.cos((ORIGIN.lat * Math.PI) / 180);
const toLatLon = ([x, y]) => ({ lat: ORIGIN.lat + y / KY, lon: ORIGIN.lon + x / KX });
const toMeters = (p) => ({ x: (p.lon - ORIGIN.lon) * KX, y: (p.lat - ORIGIN.lat) * KY });

const SQUARE = [[0, 0], [100, 0], [100, 100], [0, 100]];
const L_SHAPE = [[0, 0], [120, 0], [120, 40], [40, 40], [40, 120], [0, 120]];
const s30 = Math.sin(Math.PI / 6);
const c30 = Math.cos(Math.PI / 6);
// Rectángulo de 200 × 80 m con el lado largo a rumbo 30°.
const ROTATED = [[0, 0], [200 * s30, 200 * c30], [200 * s30 + 80 * c30, 200 * c30 - 80 * s30], [80 * c30, -80 * s30]];
const BOW_TIE = [[0, 0], [100, 100], [100, 0], [0, 100]];

function area(meters, params = {}) {
  const a = emptyArea();
  return { ...a, vertices: meters.map(toLatLon), closed: true, params: { ...a.params, ...params } };
}

function inside(pt, poly) {
  let isIn = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi) isIn = !isIn;
  }
  return isIn;
}

/** Comprobación independiente de cobertura (SC-003): cada punto del polígono cae en la huella de alguna foto. */
function uncovered(meters, a, grid) {
  const { across, along } = footprint(a.params.height);
  const t = (grid.direction * Math.PI) / 180;
  const u = { x: Math.sin(t), y: Math.cos(t) }; // avance
  const v = { x: Math.cos(t), y: -Math.sin(t) }; // transversal
  const photos = grid.photos.map(toMeters);
  const xs = meters.map((p) => p[0]);
  const ys = meters.map((p) => p[1]);
  const missing = [];
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 2) {
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += 2) {
      const pt = { x, y };
      if (!inside(pt, meters)) continue;
      const ok = photos.some((p) => {
        const d = { x: pt.x - p.x, y: pt.y - p.y };
        return Math.abs(d.x * u.x + d.y * u.y) <= along / 2 + 1e-6 && Math.abs(d.x * v.x + d.y * v.y) <= across / 2 + 1e-6;
      });
      if (!ok) missing.push(pt);
    }
  }
  return missing;
}

const meters = (a, b) => Math.hypot(toMeters(b).x - toMeters(a).x, toMeters(b).y - toMeters(a).y);
const bearing = (a, b) => {
  const [p, q] = [toMeters(a), toMeters(b)];
  return (((Math.atan2(q.x - p.x, q.y - p.y) * 180) / Math.PI) % 180 + 180) % 180;
};

// ---------- Setup y base ----------

test('emptyArea tiene los valores por defecto del data-model', () => {
  const a = emptyArea();
  assert.equal(a.type, 'area');
  assert.equal(a.name, 'Mapeo');
  assert.deepEqual(a.vertices, []);
  assert.equal(a.closed, false);
  assert.deepEqual(a.params, { height: 60, resolution: 12, frontOverlap: 80, sideOverlap: 70, direction: null, speed: 5, captureMode: 'stop' });
  assert.equal(MAPPING_LIMITS.partWaypoints, 200);
  assert.equal(MAPPING_LIMITS.maxPhotos, 20000);
  assert.deepEqual(CAMERA.minInterval, { 12: 2, 50: 5 });
});

test('GSD a 60 m: 2,11 cm/px en 12 MP y 1,05 cm/px en 50 MP', () => {
  assert.ok(Math.abs(gsd(60, 12) - 2.11) < 0.01);
  assert.ok(Math.abs(gsd(60, 50) - 1.05) < 0.01);
  const { across, along } = footprint(60);
  assert.ok(Math.abs(across - 86.4) < 0.1 && Math.abs(along - 64.8) < 0.1);
});

test('heightForGsd es la inversa de gsd', () => {
  for (const resolution of [12, 50]) {
    assert.ok(Math.abs(gsd(heightForGsd(1.5, resolution), resolution) - 1.5) < 1e-9);
  }
});

test('área, polígono simple y dirección automática', () => {
  assert.ok(Math.abs(areaHectares(SQUARE.map(toLatLon)) - 1) < 0.01);
  assert.equal(isSimple(SQUARE.map(toLatLon)), true);
  assert.equal(isSimple(L_SHAPE.map(toLatLon)), true);
  assert.equal(isSimple(BOW_TIE.map(toLatLon)), false);
  assert.ok(Math.abs(autoDirection(ROTATED.map(toLatLon)) - 30) < 1);
});

// ---------- US1: cuadrícula ----------

test('computeGrid es null si el área no está cerrada o tiene lados cruzados', () => {
  assert.equal(computeGrid({ ...area(SQUARE), closed: false }), null);
  assert.equal(computeGrid(area(BOW_TIE)), null);
});

for (const [name, shape] of [['cuadrado', SQUARE], ['rectángulo girado', ROTATED], ['forma en L', L_SHAPE]]) {
  test(`cobertura del 100 % en ${name}`, () => {
    const a = area(shape);
    const grid = computeGrid(a);
    assert.deepEqual(uncovered(shape, a, grid), []);
  });
}

test('separación entre pasadas y entre fotos según los solapes', () => {
  const a = area(ROTATED);
  const grid = computeGrid(a);
  const { across, along } = footprint(60);
  const [p0, p1] = grid.photos;
  // Tolerancia 1e-4: la prueba proyecta desde ORIGIN y grid.js desde el centro del polígono.
  assert.ok(Math.abs(meters(p0, p1) / (along * 0.2) - 1) < 1e-4, 'separación entre fotos');
  // Fin de la primera pasada y comienzo de la segunda: misma posición en avance, separadas una pasada.
  const firstPass = grid.photos.findIndex((p, i) => i > 0 && Math.abs(bearing(grid.photos[i - 1], p) - grid.direction) > 1);
  const turnGap = meters(grid.photos[firstPass - 1], grid.photos[firstPass]);
  assert.ok(Math.abs(turnGap / (across * 0.3) - 1) < 1e-4, 'separación entre pasadas');
});

test('las pasadas van en ida y vuelta y la ruta empieza cerca del primer vértice', () => {
  const a = area(SQUARE);
  const grid = computeGrid(a);
  const perPass = grid.photos.length / grid.lines;
  const heading = (i) => {
    const [p, q] = [toMeters(grid.photos[i]), toMeters(grid.photos[i + 1])];
    return Math.sign(q.x - p.x) || Math.sign(q.y - p.y);
  };
  for (let k = 0; k < grid.lines - 1; k++) {
    assert.equal(heading(k * perPass), -heading((k + 1) * perPass), `pasada ${k + 1}`);
  }
  const start = meters(grid.photos[0], a.vertices[0]);
  for (const p of [grid.photos.at(-1)]) assert.ok(start <= meters(p, a.vertices[0]));
});

test('el resumen tiene todos los datos', () => {
  const grid = computeGrid(area(SQUARE));
  const { stats } = grid;
  assert.ok(Math.abs(stats.areaHa - 1) < 0.01);
  assert.ok(Math.abs(stats.gsd - 2.11) < 0.01);
  assert.equal(stats.lines, grid.lines);
  assert.equal(stats.photos, grid.photos.length);
  assert.equal(stats.batteries, grid.parts.length);
  assert.ok(stats.distance > 0 && stats.duration > 0);
});

function partSeconds(a, grid, { start, end }) {
  let s = 0;
  for (let i = start; i < end; i++) {
    s += photoSeconds(a.params.resolution);
    if (i > start) s += meters(grid.photos[i - 1], grid.photos[i]) / a.params.speed;
  }
  return s;
}

for (const [label, params] of [['por waypoints', {}], ['por tiempo', { speed: 1 }]]) {
  test(`un área grande se divide en partes válidas (${label})`, () => {
    const big = [[0, 0], [600, 0], [600, 600], [0, 600]];
    const a = area(big, params);
    const grid = computeGrid(a);
    assert.ok(grid.parts.length > 1);
    let expected = 0;
    for (const part of grid.parts) {
      assert.equal(part.start, expected, 'sin huecos ni repeticiones');
      assert.ok(part.end - part.start >= 2 && part.end - part.start <= MAPPING_LIMITS.partWaypoints);
      assert.ok(partSeconds(a, grid, part) <= MAPPING_LIMITS.partSeconds);
      assert.ok(Math.abs(part.seconds - partSeconds(a, grid, part)) < 0.01, 'part.seconds');
      expected = part.end;
    }
    assert.equal(expected, grid.photos.length);
  });
}

test('el tiempo del resumen es la suma de las partes, sin los tramos entre partes', () => {
  const a = area([[0, 0], [600, 0], [600, 600], [0, 600]]);
  const grid = computeGrid(a);
  const sum = grid.parts.reduce((s, p) => s + p.seconds, 0);
  assert.ok(Math.abs(grid.stats.duration - sum) < 1e-9);
  const withGaps = grid.stats.distance / a.params.speed + grid.photos.length * photoSeconds(a.params.resolution);
  assert.ok(grid.stats.duration < withGaps);
});

test('la ruta empieza en el extremo más cercano al despegue (FR-014)', () => {
  const takeoff = toLatLon([130, 130]); // más allá de la esquina opuesta al vértice 1
  const withTakeoff = computeGrid({ ...area(SQUARE), takeoff });
  const without = computeGrid(area(SQUARE));
  assert.ok(meters(withTakeoff.photos[0], takeoff) <= meters(withTakeoff.photos.at(-1), takeoff));
  assert.ok(meters(withTakeoff.photos[0], takeoff) < meters(without.photos[0], takeoff));
  assert.equal(emptyArea().takeoff, null);
});

test('demasiadas fotos devuelve un error sin generar la cuadrícula', () => {
  const huge = [[0, 0], [707, 0], [707, 707], [0, 707]]; // 50 ha
  const started = performance.now();
  const result = computeGrid(area(huge, { height: 5 }));
  assert.match(result.error, /^Demasiadas fotos \(unas .*\): sube la altura o reduce el área\.$/);
  assert.ok(performance.now() - started < 250); // generar ~200 000 puntos tardaría mucho más
});

test('50 ha a 60 m se calculan en menos de medio segundo (SC-002)', () => {
  const started = performance.now();
  const grid = computeGrid(area([[0, 0], [707, 0], [707, 707], [0, 707]]));
  assert.ok(grid.photos.length > 1000);
  assert.ok(performance.now() - started < 500);
});

// ---------- US2: parámetros ----------

test('más solape lateral da más pasadas; más solape frontal, más fotos', () => {
  const base = computeGrid(area(ROTATED));
  assert.ok(computeGrid(area(ROTATED, { sideOverlap: 80 })).lines > base.lines);
  assert.ok(computeGrid(area(ROTATED, { frontOverlap: 85 })).photos.length > base.photos.length);
});

test('50 MP divide el GSD a la mitad y alarga el tiempo', () => {
  const g12 = computeGrid(area(SQUARE)).stats;
  const g50 = computeGrid(area(SQUARE, { resolution: 50 })).stats;
  assert.ok(Math.abs(g50.gsd - g12.gsd / 2) < 0.01);
  assert.ok(g50.duration > g12.duration);
});

test('la dirección gira las pasadas', () => {
  const at = (direction) => {
    const grid = computeGrid(area(SQUARE, { direction }));
    return bearing(grid.photos[0], grid.photos[1]);
  };
  assert.ok(Math.abs(at(0) % 180) < 0.5 || Math.abs(at(0) - 180) < 0.5);
  assert.ok(Math.abs(at(90) - 90) < 0.5);
});

test('solapes fuera de 50–90 % dan un error', () => {
  assert.match(computeGrid(area(SQUARE, { sideOverlap: 95 })).error, /entre 50 y 90 %/);
});

// ---------- US3: exportación ----------

// Perfil sintético SOLO para pruebas: los enums 0/0 no son valores reales de ningún dron.
const PROFILE = { namespace: 'http://www.uav.com/wpmz/1.0.2', author: 'fly', droneEnumValue: 0, droneSubEnumValue: 0, payloadInfo: null };

test('toMissions crea una misión válida por parte', async () => {
  const a = { ...area([[0, 0], [600, 0], [600, 600], [0, 600]]), finishAction: 'autoLand', onSignalLost: 'continue' };
  const grid = computeGrid(a);
  const missions = toMissions(a, grid);
  const n = grid.parts.length;
  assert.equal(missions.length, n);
  for (const [k, m] of missions.entries()) {
    assert.equal(m.name, `Mapeo parte ${k + 1} de ${n}`);
    assert.deepEqual(m.defaults, { height: 60, speed: 5, gimbalPitch: -90 });
    assert.equal(m.finishAction, k === n - 1 ? 'autoLand' : 'goHome');
    assert.equal(m.onSignalLost, 'continue');
    for (const w of m.waypoints) {
      assert.deepEqual([w.height, w.speed, w.gimbalPitch, w.heading, w.actions], [null, null, null, null, [{ type: 'photo' }]]);
    }
    assert.deepEqual(validate(m).errors, []);
  }
  const back = parseMission(await unzip(zip(buildFiles(missions[0], PROFILE, 0))), missions[0].name).mission;
  assert.equal(back.waypoints.length, missions[0].waypoints.length);
  assert.ok(back.waypoints.every((w, i) => Math.abs(w.lat - missions[0].waypoints[i].lat) < 1e-6 && w.actions[0].type === 'photo'));
});

test('una sola parte usa el nombre del área sin sufijo', () => {
  const a = area(SQUARE);
  assert.deepEqual(toMissions(a, computeGrid(a)).map((m) => m.name), ['Mapeo']);
});
