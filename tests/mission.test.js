import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, emptyMission, effective, distance, duration, validate } from '../public/js/mission.js';

const wp = (lat, lon, extra = {}) => ({
  lat, lon, height: null, speed: null, gimbalPitch: null, heading: null, actions: [], ...extra,
});

/** Misión válida de 2 puntos separados ~111 m en latitud. */
function mission(...waypoints) {
  return { ...emptyMission(), waypoints: waypoints.length ? waypoints : [wp(40, -3), wp(40.001, -3)] };
}

const fields = (list) => list.map((i) => `${i.waypoint}:${i.field}`);

test('effective hereda solo cuando el campo es null', () => {
  const m = mission(wp(40, -3), wp(40.001, -3, { height: 80 }));
  m.defaults.height = 70;
  assert.equal(effective(m, m.waypoints[0], 'height'), 70);
  assert.equal(effective(m, m.waypoints[1], 'height'), 80);
});

test('distance: 0,001° de latitud ≈ 111,2 m', () => {
  assert.ok(Math.abs(distance(mission()) - 111.2) < 0.5);
});

test('distance incluye la diferencia de altura', () => {
  const m = mission(wp(40, -3), wp(40, -3, { height: 80 }));
  assert.ok(Math.abs(distance(m) - 30) < 1e-9);
});

test('duration: tramo / velocidad + 2 s por waypoint + esperas', () => {
  const m = mission(wp(40, -3, { actions: [{ type: 'wait', seconds: 3 }] }), wp(40.001, -3));
  const expected = distance(m) / 5 + 2 * 2 + 3;
  assert.ok(Math.abs(duration(m) - expected) < 1e-9);
});

test('una misión normal es válida', () => {
  assert.deepEqual(validate(mission()), { errors: [], warnings: [] });
});

for (const field of ['height', 'speed', 'gimbalPitch']) {
  const { min, max } = LIMITS[field];
  test(`${field}: ${min} y ${max} son válidos; fuera de ellos es error`, () => {
    for (const ok of [min, max]) {
      const m = mission(wp(40, -3, { [field]: ok }), wp(40.001, -3));
      assert.ok(!fields(validate(m).errors).includes(`1:${field}`), `${ok} debería ser válido`);
    }
    for (const bad of [min - 0.1, max + 0.1, NaN]) {
      const m = mission(wp(40, -3, { [field]: bad }), wp(40.001, -3));
      assert.ok(fields(validate(m).errors).includes(`1:${field}`), `${bad} debería ser error`);
    }
  });
}

test('espera: 1 y 30 s válidos; 0,9 y 30,1 s error', () => {
  for (const [seconds, isError] of [[1, false], [30, false], [0.9, true], [30.1, true]]) {
    const m = mission(wp(40, -3, { actions: [{ type: 'wait', seconds }] }), wp(40.001, -3));
    assert.equal(fields(validate(m).errors).includes('1:wait'), isError, `${seconds} s`);
  }
});

test('número de waypoints: menos de 2 o más de 200 es error', () => {
  assert.ok(fields(validate(mission(wp(40, -3))).errors).includes('null:waypoints'));
  const many = Array.from({ length: 201 }, (_, i) => wp(40 + i * 0.0001, -3));
  assert.ok(fields(validate(mission(...many)).errors).includes('null:waypoints'));
  assert.ok(!fields(validate(mission(...many.slice(0, 200))).errors).includes('null:waypoints'));
});

test('dos waypoints consecutivos a menos de 1 m es error', () => {
  const m = mission(wp(40, -3), wp(40.000005, -3)); // ~0,56 m
  const issue = validate(m).errors.find((i) => i.field === 'position');
  assert.equal(issue.waypoint, 2);
  assert.match(issue.message, /Waypoint 2: está a menos de 1 m del waypoint 1/);
});

test('aviso por encima de 120 m que menciona el relieve; 120 m exactos no avisa', () => {
  const at120 = mission(wp(40, -3, { height: 120 }), wp(40.001, -3));
  assert.deepEqual(validate(at120).warnings, []);
  const above = mission(wp(40, -3, { height: 120.1 }), wp(40.001, -3));
  const [warning] = validate(above).warnings;
  assert.equal(warning.waypoint, 1);
  assert.match(warning.message, /relieve del terreno/);
  assert.deepEqual(validate(above).errors, []);
});

test('aviso cuando el tiempo estimado supera 35 min', () => {
  const slow = mission(wp(40, -3, { speed: 1 }), wp(40.02, -3)); // ~2224 m a 1 m/s ≈ 37 min
  assert.ok(fields(validate(slow).warnings).includes('null:duration'));
});

test('el error nombra el waypoint y el valor', () => {
  const m = mission(wp(40, -3), wp(40.001, -3, { height: 600 }));
  const [error] = validate(m).errors;
  assert.equal(error.waypoint, 2);
  assert.equal(error.value, 600);
  assert.match(error.message, /Waypoint 2: altura 600 m/);
});

test('nombre de misión vacío o de más de 60 caracteres es error', () => {
  for (const name of ['  ', 'x'.repeat(61)]) {
    assert.ok(fields(validate({ ...mission(), name }).errors).includes('null:name'));
  }
});
