# Data Model: Editor de misiones waypoint con exportación KMZ para DJI Fly

**Feature**: `001-waypoint-kmz-editor` | **Date**: 2026-10-15

Objetos JavaScript planos, serializables a JSON. Sin clases. Unidades: metros, m/s,
segundos y grados.

## Mission

| Campo | Tipo | Regla |
|-------|------|-------|
| `name` | string | 1–60 caracteres. Por defecto `"Misión"`. |
| `defaults.height` | number | Altura por defecto (m, relativa al despegue). Por defecto 50. |
| `defaults.speed` | number | Velocidad por defecto (m/s). Por defecto 5. |
| `defaults.gimbalPitch` | number | Ángulo por defecto (°). Por defecto −30. |
| `finishAction` | `"goHome"` \| `"autoLand"` \| `"noAction"` | Volver a casa, aterrizar, quedarse en el sitio. Por defecto `"goHome"`. |
| `onSignalLost` | `"continue"` \| `"lostAction"` | Continuar la misión o volver a casa (RTH). Por defecto `"lostAction"`. |
| `waypoints` | Waypoint[] | El orden del array es el orden de vuelo. |

Valores derivados (no se guardan): `distance` (m) y `duration` (s), ver research R10.

## Waypoint

| Campo | Tipo | Regla |
|-------|------|-------|
| `lat` | number | −90…90, 6 decimales al exportar. |
| `lon` | number | −180…180, 6 decimales al exportar. |
| `height` | number \| null | `null` = usa `defaults.height`. |
| `speed` | number \| null | `null` = usa `defaults.speed`. Se aplica al tramo que sale de este punto. |
| `gimbalPitch` | number \| null | `null` = usa `defaults.gimbalPitch`. |
| `heading` | `null` \| number | `null` = seguir la ruta. Un número es un ángulo fijo, 0–359 (0 = norte, sentido horario). |
| `actions` | Action[] | Lista ordenada, puede estar vacía. |

El número visible del waypoint es su posición en el array + 1. No hay id propio: mover,
borrar o reordenar renumera (spec, US2).

**Valor efectivo**: `effective(mission, wp, campo)` devuelve `wp[campo] ?? mission.defaults[campo]`.
Al cambiar un valor por defecto, solo cambian los waypoints con `null` en ese campo (US2,
escenario 4).

## Action

| `type` | Campos extra | Regla |
|--------|--------------|-------|
| `"photo"` | — | |
| `"startVideo"` | — | |
| `"stopVideo"` | — | |
| `"wait"` | `seconds: number` | Límites en `LIMITS.waitSeconds`. |

## DroneProfile

Lo que flyplan extrae del KMZ de referencia (FR-008). Se guarda en `flyplan.droneProfile`.

| Campo | Tipo | Origen en el KMZ |
|-------|------|------------------|
| `namespace` | string | `xmlns:wpml` de `waylines.wpml`. |
| `author` | string | `wpml:author` de `template.kml`. |
| `droneEnumValue` | number | `wpml:droneInfo/wpml:droneEnumValue`. |
| `droneSubEnumValue` | number | `wpml:droneInfo/wpml:droneSubEnumValue`. |
| `payloadInfo` | object \| null | `wpml:payloadInfo` si existe (enum, subenum, posición). |
| `loadedAt` | string | Fecha ISO de carga. |

Se pueden añadir campos cuando el fixture real muestre otros valores propios del dron.
Nunca se rellenan con valores por defecto (constitución, principio I).

## LIMITS (constante)

Objeto congelado en `mission.js`. Valores y fuentes en [research.md](./research.md) R4.

```text
waypoints: { min: 2, max: 200 }
height:    { min: 2, max: 500, warnAbove: 120 }
speed:     { min: 1, max: 15 }
gimbalPitch: { min: -90, max: 0 }
waitSeconds: { min: 1, max: 30 }
minSegment: 1          // m entre waypoints consecutivos
warnDuration: 2100     // s (35 min)
```

## ValidationResult

Lo que devuelve `validate(mission)`.

| Campo | Tipo | Uso |
|-------|------|-----|
| `errors` | Issue[] | Bloquean la exportación (FR-011). |
| `warnings` | Issue[] | Hay que confirmarlos para exportar (FR-012, autonomía). |

`Issue = { waypoint: number | null, field: string, value: number, limit: string, message: string }`

- `waypoint` es el número visible (1…n) o `null` si el problema es de la misión.
- `message` está en español y nombra el waypoint y el valor (US1, escenarios 4 y 5).

## Estados de la misión en la interfaz

```text
vacía ──clic en mapa──▶ editando ──Exportar──▶ validando
                                              ├─ errores ──▶ editando (bloqueado, lista de errores)
                                              ├─ sin perfil ──▶ pide KMZ de referencia
                                              ├─ avisos ──▶ confirmación ──▶ descarga KMZ
                                              └─ ok ──▶ descarga KMZ
editando ──abrir KMZ / misión nueva──▶ confirmación si hay waypoints (FR-018) ──▶ editando
```

## Persistencia

| Clave `localStorage` | Contenido | Cuándo se escribe |
|----------------------|-----------|-------------------|
| `flyplan.mission` | `Mission` en JSON | Tras cada cambio (FR-014). |
| `flyplan.droneProfile` | `DroneProfile` en JSON | Al cargar un KMZ de referencia válido. |

Toda lectura y escritura va en `try/catch`. Un JSON corrupto se descarta con aviso y se
empieza una misión vacía.
