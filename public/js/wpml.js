// Generación y lectura de DJI WPML (contracts/kmz-dji-fly.md).
import { emptyMission, effective } from './mission.js';

// Solo T035 lo pasa a true, cuando todos los [F] coinciden con el fixture real.
export const WPML_VERIFIED = false;

// PROVISIONAL [F]: confirmar con fixtures/referencia-air3s.kmz. DJI Fly usa el dominio
// uav.com; los drones enterprise usan dji.com.
const DJI_FLY_NS_PREFIX = 'http://www.uav.com/wpmz/';
const KML_NS = 'http://www.opengis.net/kml/2.2';

const FINISH_ACTIONS = ['goHome', 'autoLand', 'noAction'];

// ---------- Generación ----------

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const f1 = (n) => n.toFixed(1);
const f6 = (n) => n.toFixed(6);
const tag = (name, value) => `<wpml:${name}>${value}</wpml:${name}>`;

/** Rumbo 0…359 (flyplan) → −180…180 (WPML). */
const toWpmlAngle = (deg) => (deg > 180 ? deg - 360 : deg);

function missionConfig(mission, profile) {
  const payload = profile.payloadInfo;
  return [
    '<wpml:missionConfig>',
    tag('flyToWaylineMode', 'safely'),
    tag('finishAction', mission.finishAction),
    tag('exitOnRCLost', mission.onSignalLost === 'continue' ? 'goContinue' : 'executeLostAction'),
    // PROVISIONAL [F]: valor de executeRCLostAction.
    mission.onSignalLost === 'continue' ? '' : tag('executeRCLostAction', 'goBack'),
    // PROVISIONAL [F]: DJI Fly podría omitir este campo.
    tag('globalTransitionalSpeed', f1(mission.defaults.speed)),
    '<wpml:droneInfo>',
    tag('droneEnumValue', profile.droneEnumValue),
    tag('droneSubEnumValue', profile.droneSubEnumValue),
    '</wpml:droneInfo>',
    payload
      ? [
          '<wpml:payloadInfo>',
          ...['payloadEnumValue', 'payloadSubEnumValue', 'payloadPositionIndex']
            .filter((k) => payload[k] != null)
            .map((k) => tag(k, payload[k])),
          '</wpml:payloadInfo>',
        ].join('')
      : '',
    '</wpml:missionConfig>',
  ].join('');
}

// PROVISIONAL [F]: forma del rumbo fijo (modo y ángulo).
function headingParam(heading) {
  const fixed = heading !== null;
  return [
    '<wpml:waypointHeadingParam>',
    tag('waypointHeadingMode', fixed ? 'smoothTransition' : 'followWayline'),
    tag('waypointHeadingAngle', fixed ? f1(toWpmlAngle(heading)) : '0'),
    tag('waypointPoiPoint', '0.000000,0.000000,0.000000'),
    tag('waypointHeadingPathMode', 'followBadArc'),
    '</wpml:waypointHeadingParam>',
  ].join('');
}

const TURN_PARAM =
  '<wpml:waypointTurnParam>' +
  tag('waypointTurnMode', 'toPointAndStopWithDiscontinuityCurvature') +
  tag('waypointTurnDampingDist', '0') +
  '</wpml:waypointTurnParam>';

// PROVISIONAL [F]: parámetros de cada acción.
function actionXml(id, func, params) {
  return (
    '<wpml:action>' +
    tag('actionId', id) +
    tag('actionActuatorFunc', func) +
    `<wpml:actionActuatorFuncParam>${params}</wpml:actionActuatorFuncParam>` +
    '</wpml:action>'
  );
}

const ACTION_XML = {
  photo: () => ['takePhoto', tag('payloadPositionIndex', 0)],
  startVideo: () => ['startRecord', tag('payloadPositionIndex', 0)],
  stopVideo: () => ['stopRecord', tag('payloadPositionIndex', 0)],
  wait: (a) => ['hover', tag('hoverTime', f1(a.seconds))],
};

/** @param {number|null} pitch gimbalRotate a emitir, o null si no cambia. */
function actionGroup(index, wp, pitch) {
  const actions = [];
  if (pitch !== null) {
    actions.push([
      'gimbalRotate',
      tag('gimbalRotateMode', 'absoluteAngle') +
        tag('gimbalPitchRotateEnable', 1) +
        tag('gimbalPitchRotateAngle', f1(pitch)) +
        tag('gimbalRollRotateEnable', 0) +
        tag('gimbalRollRotateAngle', 0) +
        tag('gimbalYawRotateEnable', 0) +
        tag('gimbalYawRotateAngle', 0) +
        tag('gimbalRotateTimeEnable', 0) +
        tag('gimbalRotateTime', 0) +
        tag('payloadPositionIndex', 0),
    ]);
  }
  for (const a of wp.actions) actions.push(ACTION_XML[a.type](a));
  if (!actions.length) return '';
  return [
    '<wpml:actionGroup>',
    tag('actionGroupId', index),
    tag('actionGroupStartIndex', index),
    tag('actionGroupEndIndex', index),
    tag('actionGroupMode', 'sequence'),
    `<wpml:actionTrigger>${tag('actionTriggerType', 'reachPoint')}</wpml:actionTrigger>`,
    ...actions.map(([func, params], i) => actionXml(i + 1, func, params)),
    '</wpml:actionGroup>',
  ].join('');
}

const point = (wp) => `<Point><coordinates>${f6(wp.lon)},${f6(wp.lat)}</coordinates></Point>`;

const header = (ns) => `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="${KML_NS}" xmlns:wpml="${esc(ns)}">`;

/**
 * @param {ReturnType<typeof emptyMission>} mission
 * @param {{namespace: string, author: string|null, droneEnumValue: number, droneSubEnumValue: number, payloadInfo: object|null}} profile
 */
export function buildFiles(mission, profile, now = Date.now()) {
  if (!profile) throw new Error('Falta el KMZ de referencia de tu DJI Fly.');
  const config = missionConfig(mission, profile);
  const speed = f1(mission.defaults.speed);

  let lastPitch = null;
  const placemarks = mission.waypoints.map((wp, i) => {
    const pitch = effective(mission, wp, 'gimbalPitch');
    const group = actionGroup(i, wp, pitch !== lastPitch ? pitch : null);
    lastPitch = pitch;
    return { wp, i, pitch, group, height: f1(effective(mission, wp, 'height')), speed: f1(effective(mission, wp, 'speed')) };
  });

  const waylines = [
    header(profile.namespace),
    '<Document>',
    config,
    '<Folder>',
    tag('templateId', 0),
    tag('executeHeightMode', 'relativeToStartPoint'),
    tag('waylineId', 0),
    tag('autoFlightSpeed', speed),
    ...placemarks.map(
      (p) =>
        '<Placemark>' +
        point(p.wp) +
        tag('index', p.i) +
        tag('executeHeight', p.height) +
        tag('waypointSpeed', p.speed) +
        headingParam(p.wp.heading) +
        TURN_PARAM +
        tag('useStraightLine', 1) +
        p.group +
        '</Placemark>'
    ),
    '</Folder>',
    '</Document>',
    '</kml>',
  ].join('\n');

  // PROVISIONAL [F]: forma de template.kml (DJI Fly no lo usa, pero lo exige).
  const template = [
    header(profile.namespace),
    '<Document>',
    profile.author ? tag('author', esc(profile.author)) : '',
    tag('createTime', now),
    tag('updateTime', now),
    config,
    '<Folder>',
    tag('templateType', 'waypoint'),
    tag('templateId', 0),
    '<wpml:waylineCoordinateSysParam>' +
      tag('coordinateMode', 'WGS84') +
      tag('heightMode', 'relativeToStartPoint') +
      tag('positioningType', 'GPS') +
      '</wpml:waylineCoordinateSysParam>',
    tag('autoFlightSpeed', speed),
    tag('globalHeight', f1(mission.defaults.height)),
    tag('gimbalPitchMode', 'usePointSetting'),
    '<wpml:globalWaypointHeadingParam>' +
      tag('waypointHeadingMode', 'followWayline') +
      tag('waypointHeadingAngle', 0) +
      tag('waypointPoiPoint', '0.000000,0.000000,0.000000') +
      tag('waypointHeadingPathMode', 'followBadArc') +
      '</wpml:globalWaypointHeadingParam>',
    tag('globalWaypointTurnMode', 'toPointAndStopWithDiscontinuityCurvature'),
    tag('globalUseStraightLine', 1),
    ...placemarks.map(
      (p) =>
        '<Placemark>' +
        point(p.wp) +
        tag('index', p.i) +
        tag('height', p.height) +
        tag('useGlobalHeight', 0) +
        tag('useGlobalSpeed', 0) +
        tag('waypointSpeed', p.speed) +
        tag('useGlobalHeadingParam', 0) +
        headingParam(p.wp.heading) +
        tag('useGlobalTurnParam', 0) +
        TURN_PARAM +
        tag('useStraightLine', 1) +
        tag('gimbalPitchAngle', f1(p.pitch)) +
        p.group +
        '</Placemark>'
    ),
    '</Folder>',
    '</Document>',
    '</kml>',
  ].join('\n');

  return { 'wpmz/template.kml': template, 'wpmz/waylines.wpml': waylines };
}

// ---------- Lectura ----------

function parseXml(xml) {
  let doc;
  try {
    doc = new DOMParser().parseFromString(xml, 'text/xml');
  } catch {
    doc = null;
  }
  if (!doc?.documentElement || doc.getElementsByTagName('parsererror').length) {
    throw new Error('El KMZ contiene un XML dañado.');
  }
  return doc;
}

/** Texto del primer descendiente wpml:<name>, o null. */
function text(node, name) {
  const el = node?.getElementsByTagName(`wpml:${name}`)[0];
  return el ? el.textContent.trim() : null;
}

function num(node, name) {
  const t = text(node, name);
  return t === null || t === '' ? null : Number(t);
}

export function parseProfile(files) {
  const xml = files['wpmz/waylines.wpml'];
  if (!xml) throw new Error('El archivo no contiene una misión de DJI Fly.');
  const doc = parseXml(xml);
  const namespace = doc.documentElement.getAttribute('xmlns:wpml') || '';
  const droneEnumValue = num(doc, 'droneEnumValue');
  const droneSubEnumValue = num(doc, 'droneSubEnumValue');
  if (!namespace.startsWith(DJI_FLY_NS_PREFIX) || droneEnumValue === null || droneSubEnumValue === null) {
    throw new Error(
      `Este KMZ no sirve como referencia de DJI Fly (namespace "${namespace || 'ninguno'}", ` +
        `dron ${droneEnumValue ?? '?'}/${droneSubEnumValue ?? '?'}). ` +
        'Expórtalo de nuevo desde DJI Fly con tu Air 3S.'
    );
  }
  const payload = doc.getElementsByTagName('wpml:payloadInfo')[0];
  const template = files['wpmz/template.kml'] ? parseXml(files['wpmz/template.kml']) : null;
  return {
    namespace,
    author: text(template, 'author'),
    droneEnumValue,
    droneSubEnumValue,
    payloadInfo: payload
      ? {
          payloadEnumValue: num(payload, 'payloadEnumValue'),
          payloadSubEnumValue: num(payload, 'payloadSubEnumValue'),
          payloadPositionIndex: num(payload, 'payloadPositionIndex'),
        }
      : null,
    loadedAt: new Date().toISOString(),
  };
}

const READ_ACTIONS = {
  takePhoto: () => ({ type: 'photo' }),
  startRecord: () => ({ type: 'startVideo' }),
  stopRecord: () => ({ type: 'stopVideo' }),
  hover: (el) => ({ type: 'wait', seconds: num(el, 'hoverTime') }),
};

/** @param {string} name nombre del archivo sin .kmz */
export function parseMission(files, name) {
  const xml = files['wpmz/waylines.wpml'];
  if (!xml) throw new Error('El archivo no contiene una misión de DJI Fly.');
  const doc = parseXml(xml);
  const template = files['wpmz/template.kml'] ? parseXml(files['wpmz/template.kml']) : null;
  const base = emptyMission();
  const warnings = [];

  let finishAction = text(doc, 'finishAction');
  if (!FINISH_ACTIONS.includes(finishAction)) {
    warnings.push(`Acción al terminar "${finishAction}" no soportada: se usará "Volver a casa".`);
    finishAction = 'goHome';
  }
  const onSignalLost = text(doc, 'exitOnRCLost') === 'goContinue' ? 'continue' : 'lostAction';
  const lostAction = text(doc, 'executeRCLostAction');
  if (onSignalLost === 'lostAction' && lostAction && lostAction !== 'goBack') {
    warnings.push(`Acción por pérdida de señal "${lostAction}": se exportará como "Volver a casa (RTH)".`);
  }

  // Array.from: las NodeList de @xmldom/xmldom (pruebas en Node) no son iterables.
  const placemarks = Array.from(doc.getElementsByTagName('Placemark')).sort((a, b) => num(a, 'index') - num(b, 'index'));
  let pitch = null;
  let firstPitch = null;
  const waypoints = placemarks.map((pm, i) => {
    const [lon, lat] = pm.getElementsByTagName('coordinates')[0].textContent.trim().split(',').map(Number);
    const mode = text(pm, 'waypointHeadingMode');
    let heading = null;
    if (mode && mode !== 'followWayline') {
      const angle = num(pm, 'waypointHeadingAngle') ?? 0;
      heading = ((Math.round(angle) % 360) + 360) % 360;
      if (!['smoothTransition', 'fixed', 'manually'].includes(mode)) {
        warnings.push(`Waypoint ${i + 1}: modo de rumbo "${mode}" no soportado: se usará ángulo fijo de ${heading}°.`);
      }
    }
    const actions = [];
    for (const el of Array.from(pm.getElementsByTagName('wpml:action'))) {
      const func = text(el, 'actionActuatorFunc');
      if (func === 'gimbalRotate') {
        pitch = num(el, 'gimbalPitchRotateAngle');
        firstPitch ??= pitch;
      } else if (READ_ACTIONS[func]) {
        actions.push(READ_ACTIONS[func](el));
      } else {
        warnings.push(`Waypoint ${i + 1}: acción "${func}" no soportada; se perderá al exportar.`);
      }
    }
    return { lat, lon, height: num(pm, 'executeHeight'), speed: num(pm, 'waypointSpeed'), gimbalPitch: pitch, heading, actions };
  });

  const defaults = {
    height: num(template, 'globalHeight') ?? base.defaults.height,
    speed: num(template, 'autoFlightSpeed') ?? num(doc, 'autoFlightSpeed') ?? base.defaults.speed,
    gimbalPitch: firstPitch ?? base.defaults.gimbalPitch,
  };
  for (const wp of waypoints) {
    for (const field of ['height', 'speed', 'gimbalPitch']) if (wp[field] === defaults[field]) wp[field] = null;
  }

  return {
    // El KMZ no guarda el punto de despegue: el piloto lo marca al abrirlo (feature 003, FR-010).
    mission: { name: (name || base.name).slice(0, 60), defaults, finishAction, onSignalLost, waypoints, takeoff: null },
    warnings,
  };
}
