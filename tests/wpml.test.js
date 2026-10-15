globalThis.DOMParser ??= (await import('@xmldom/xmldom')).DOMParser;

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyMission, effective } from '../public/js/mission.js';
import { WPML_VERIFIED, buildFiles, parseMission, parseProfile } from '../public/js/wpml.js';
import { zip, unzip } from '../public/js/kmz.js';

// Perfil sintético SOLO para pruebas: los enums 0/0 no son valores reales de ningún dron.
const PROFILE = {
  namespace: 'http://www.uav.com/wpmz/1.0.2',
  author: 'fly',
  droneEnumValue: 0,
  droneSubEnumValue: 0,
  payloadInfo: null,
};

const wp = (lat, lon, extra = {}) => ({
  lat, lon, height: null, speed: null, gimbalPitch: null, heading: null, actions: [], ...extra,
});

function sampleMission() {
  return {
    ...emptyMission(),
    name: 'Prueba ida y vuelta',
    defaults: { height: 60, speed: 6, gimbalPitch: -20 },
    finishAction: 'autoLand',
    onSignalLost: 'continue',
    waypoints: [
      wp(40.4168, -3.7038, { actions: [{ type: 'photo' }] }),
      wp(40.4172, -3.7031, { height: 80, heading: 90, actions: [{ type: 'startVideo' }] }),
      wp(40.4177, -3.7025, { speed: 3.5, heading: 270, actions: [{ type: 'wait', seconds: 3 }, { type: 'stopVideo' }] }),
      wp(40.4181, -3.7019, { gimbalPitch: -90, height: 60 }),
      wp(40.4185, -3.7012),
    ],
  };
}

const FIELDS = ['height', 'speed', 'gimbalPitch'];
const flown = (m) =>
  m.waypoints.map((w) => ({
    lat: w.lat,
    lon: w.lon,
    heading: w.heading,
    actions: w.actions,
    ...Object.fromEntries(FIELDS.map((f) => [f, effective(m, w, f)])),
  }));

async function roundTrip(mission, profile = PROFILE) {
  const files = await unzip(zip(buildFiles(mission, profile, 0)));
  return parseMission(files, mission.name);
}

test('WPML_VERIFIED sigue en false hasta verificar con el fixture real', () => {
  assert.equal(WPML_VERIFIED, false);
});

test('ida y vuelta conserva misión y valores efectivos de cada waypoint', async () => {
  const original = sampleMission();
  const { mission, warnings } = await roundTrip(original);
  assert.deepEqual(warnings, []);
  assert.equal(mission.name, original.name);
  assert.deepEqual(mission.defaults, original.defaults);
  assert.equal(mission.finishAction, original.finishAction);
  assert.equal(mission.onSignalLost, original.onSignalLost);
  assert.deepEqual(flown(mission), flown(original));
});

test('ida y vuelta con pérdida de señal "volver a casa" y al terminar "quedarse"', async () => {
  const original = { ...sampleMission(), finishAction: 'noAction', onSignalLost: 'lostAction' };
  const { mission } = await roundTrip(original);
  assert.equal(mission.finishAction, 'noAction');
  assert.equal(mission.onSignalLost, 'lostAction');
});

test('los textos del perfil se escapan y el XML sigue siendo válido', () => {
  const files = buildFiles(sampleMission(), { ...PROFILE, author: 'A & <B> "c"' }, 0);
  assert.match(files['wpmz/template.kml'], /A &amp; &lt;B&gt; &quot;c&quot;/);
  for (const xml of Object.values(files)) {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    assert.equal(doc.getElementsByTagName('parsererror').length, 0);
  }
});

test('índices contiguos desde 0 y actionId desde 1', () => {
  const xml = buildFiles(sampleMission(), PROFILE, 0)['wpmz/waylines.wpml'];
  const indexes = [...xml.matchAll(/<wpml:index>(\d+)<\/wpml:index>/g)].map((m) => Number(m[1]));
  assert.deepEqual(indexes, [0, 1, 2, 3, 4]);
  for (const group of xml.match(/<wpml:actionGroup>.*?<\/wpml:actionGroup>/gs)) {
    const ids = [...group.matchAll(/<wpml:actionId>(\d+)<\/wpml:actionId>/g)].map((m) => Number(m[1]));
    assert.deepEqual(ids, ids.map((_, i) => i + 1));
  }
});

test('namespace y valores del dron salen del perfil, nunca de valores por defecto', () => {
  const profile = { ...PROFILE, namespace: 'http://www.uav.com/wpmz/9.9.9', droneEnumValue: 123, droneSubEnumValue: 4 };
  const xml = buildFiles(sampleMission(), profile, 0)['wpmz/waylines.wpml'];
  assert.match(xml, /xmlns:wpml="http:\/\/www\.uav\.com\/wpmz\/9\.9\.9"/);
  assert.match(xml, /<wpml:droneEnumValue>123<\/wpml:droneEnumValue>/);
  assert.match(xml, /<wpml:droneSubEnumValue>4<\/wpml:droneSubEnumValue>/);
  assert.throws(() => buildFiles(sampleMission(), null), /Falta el KMZ de referencia/);
});

test('gimbalRotate solo se emite cuando cambia el pitch', () => {
  const xml = buildFiles(sampleMission(), PROFILE, 0)['wpmz/waylines.wpml'];
  const pitches = [...xml.matchAll(/<wpml:gimbalPitchRotateAngle>(-?[\d.]+)</g)].map((m) => Number(m[1]));
  assert.deepEqual(pitches, [-20, -90, -20]); // WP1, WP4 (cambia a -90), WP5 (vuelve a -20)
});

test('parseMission: un KMZ sin waylines.wpml lanza error en español', () => {
  assert.throws(() => parseMission({ 'doc.kml': '<kml/>' }, 'x'), { message: 'El archivo no contiene una misión de DJI Fly.' });
  assert.throws(() => parseMission({ 'wpmz/waylines.wpml': '<kml><sin cerrar' }, 'x'), /XML dañado/);
});

test('parseMission: una acción desconocida avisa y no rompe la carga', () => {
  const files = buildFiles(sampleMission(), PROFILE, 0);
  files['wpmz/waylines.wpml'] = files['wpmz/waylines.wpml'].replace(
    '<wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>',
    '<wpml:actionActuatorFunc>zoom</wpml:actionActuatorFunc>'
  );
  const { mission, warnings } = parseMission(files, 'x');
  assert.equal(mission.waypoints.length, 5);
  assert.deepEqual(mission.waypoints[0].actions, []);
  assert.deepEqual(warnings, ['Waypoint 1: acción "zoom" no soportada; se perderá al exportar.']);
});

test('parseMission: valores iguales al de la misión se cargan como null', async () => {
  const { mission } = await roundTrip(sampleMission());
  assert.equal(mission.waypoints[3].height, null); // 60 explícito = altura por defecto
  assert.equal(mission.waypoints[1].height, 80);
});

test('parseMission: el gimbal se arrastra hasta el siguiente gimbalRotate', async () => {
  const { mission } = await roundTrip(sampleMission());
  assert.deepEqual(mission.waypoints.map((w) => effective(mission, w, 'gimbalPitch')), [-20, -20, -20, -90, -20]);
});

test('parseMission: hover se carga como esperar con sus segundos', async () => {
  const { mission } = await roundTrip(sampleMission());
  assert.deepEqual(mission.waypoints[2].actions, [{ type: 'wait', seconds: 3 }, { type: 'stopVideo' }]);
});

test('parseProfile lee namespace, enums y autor', async () => {
  const files = await unzip(zip(buildFiles(sampleMission(), { ...PROFILE, droneEnumValue: 7, droneSubEnumValue: 1 }, 0)));
  const profile = parseProfile(files);
  assert.equal(profile.namespace, PROFILE.namespace);
  assert.equal(profile.droneEnumValue, 7);
  assert.equal(profile.droneSubEnumValue, 1);
  assert.equal(profile.author, 'fly');
  assert.equal(profile.payloadInfo, null);
});

test('parseProfile rechaza un KMZ sin droneInfo o de otro namespace', () => {
  const files = buildFiles(sampleMission(), PROFILE, 0);
  const noDrone = { ...files, 'wpmz/waylines.wpml': files['wpmz/waylines.wpml'].replace(/<wpml:droneInfo>.*?<\/wpml:droneInfo>/s, '') };
  assert.throws(() => parseProfile(noDrone), /no sirve como referencia de DJI Fly .*dron \?\/\?/);
  const enterprise = buildFiles(sampleMission(), { ...PROFILE, namespace: 'http://www.dji.com/wpmz/1.0.2' }, 0);
  assert.throws(() => parseProfile(enterprise), /namespace "http:\/\/www\.dji\.com\/wpmz\/1\.0\.2", dron 0\/0/);
  assert.throws(() => parseProfile({}), /no contiene una misión de DJI Fly/);
});
