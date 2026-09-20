# `GET /api/state`

Reverse-engineered from a live board manager
(Autodarts board-manager firmware, v1.0.7, running on a Raspberry Pi 4) and
its frontend bundle (`assets/index-DPXP01sS.js`, called via
`getState()` → `this.bestAxios().get("/state")`).

This endpoint reports the **live detection state** of a single Autodarts
board (camera/detection engine status + the last throws it has seen). It is
a small, fast-polled snapshot — not game/match/score data (that lives in a
separate service).

## Request

```
GET /api/state
Accept: application/json
```

No parameters. No auth required on the local board manager (may differ if
proxied through the cloud API with a board API key).

Related endpoints found in the same frontend bundle, for context:

| Endpoint | Purpose |
|---|---|
| `GET /api/state` | This document — live detection snapshot |
| `GET /api/state/dump` | Full diagnostic dump, returned as a `.zip` (`application/zip`) containing `state.json` (full internal state: host info, OS/CPU, camera devices, config, calibration matrices, motion grid) plus `motion.jpeg`, `image.jpeg`, `dart.jpeg`, `diff.jpeg` debug frames. Much larger/broader than `/api/state`; intended for support/bug-report use, not polling. |
| `PUT /{board}/start` / `/stop` | Start/stop the detection engine |
| `POST /{board}/reset` | Reset current throws |
| `POST /{board}/calibrate` | Trigger auto-calibration |
| `GET /api/ping` | Liveness check |
| `GET /api/streams/detection`, `/api/streams/motion`, `/api/streams/live` | Video/detection stream endpoints |

The `/{board}/...` paths above are frontend API abstractions. SlopDarts
connects directly to the local board manager at `BOARD_URL` and sends these
commands from `server/index.ts`:

| Local board endpoint | Purpose |
|---|---|
| `PUT /api/start` | Start detection |
| `PUT /api/stop` | Stop detection |
| `POST /api/reset` | Reset reported throws |
| `POST /api/config/calibration/auto?distortion=true` | Request automatic calibration |

These are board-manager routes, separate from SlopDarts' own
`POST /api/board/:command` proxy endpoint. This document describes the
observed firmware version above; other board-manager versions may differ.

## Response

`Content-Type: application/json`

### Observed live example (board idle/stopped)

```json
{
  "connected": false,
  "running": false,
  "status": "Stopped",
  "event": "Stopped",
  "numThrows": 3,
  "throws": [
    {
      "segment": { "name": "S6",  "number": 6,  "bed": "SingleOuter", "multiplier": 1 },
      "coords":  { "x": 0.6373859001969797, "y": 0.0793742758064617 }
    },
    {
      "segment": { "name": "S18", "number": 18, "bed": "SingleInner", "multiplier": 1 },
      "coords":  { "x": 0.136545617097536,  "y": 0.16788588006289595 }
    },
    {
      "segment": { "name": "S20", "number": 20, "bed": "SingleOuter", "multiplier": 1 },
      "coords":  { "x": 0.06666071248226796, "y": 0.6629248432505958 }
    }
  ]
}
```

Throws persist in this field even while the board is `Stopped`/disconnected —
it reflects the *last* completed set of throws, not necessarily "throws right
now."

### Observed live example (dart in flight)

Captured mid-turn on a live board:

```json
{
  "connected": false,
  "running": true,
  "status": "Throw",
  "event": "Throw detected",
  "numThrows": 2,
  "throws": [
    {
      "segment": { "name": "S1",  "number": 1,  "bed": "SingleInner", "multiplier": 1 },
      "coords":  { "x": 0.10244761711214914, "y": 0.27642075595717425 }
    },
    {
      "segment": { "name": "S11", "number": 11, "bed": "SingleOuter", "multiplier": 1 },
      "coords":  { "x": -0.6527137881738723, "y": -0.08366881784201861 }
    }
  ]
}
```

Two things this sample disproves from a first pass at this doc:

- **`connected` and `running` are independent.** `connected: false` was seen
  together with `running: true` and `status: "Throw"`. So `connected` is
  *not* simply "is the engine running" — it tracks something else (hardware/
  network link to the board), and can be `false` even mid-throw while the
  engine is actively detecting. Treat `running`/`status` as the source of
  truth for "is a game/turn active," not `connected`.
- **`coords.x`/`coords.y` are not clamped to `[0, 1]`.** The second throw
  above has negative coordinates (`x: -0.65`, `y: -0.08`). They're normalized
  *relative to the calibrated board*, but a dart landing outside the
  calibrated capture frame (or a noisy detection) can push them negative or
  presumably above `1.0` too.

### Top-level shape

| Field | Type | Description |
|---|---|---|
| `connected` | `boolean` | Whether the board manager has an active connection to the board hardware/cameras. Observed **independent** of `running`/`status` — e.g. `connected: false` while `running: true` and `status: "Throw"`. Don't use it as a proxy for "engine active." |
| `running` | `boolean` | Whether the detection engine loop is currently running. |
| `status` | `string` (enum) | Current detection-engine status. See [Status / Event values](#status--event-values). |
| `event` | `string` | Most recent status-change message. Sometimes mirrors `status` exactly (e.g. `"Stopped"`), but often is a distinct human-readable message describing what just happened, following a `"<Thing> detected"` / `"<Thing> finished"` pattern — observed: `"Throw detected"` (while `status: "Throw"`), `"Calibration finished"`. Treat it as free-form text, not a small closed enum. |
| `numThrows` | `integer` | Number of throws currently recorded for the in-progress turn (0–3 in a standard game, since a turn is 3 darts). |
| `throws` | `Throw[]` | Array of the detected throws, in throw order. Length matches `numThrows`. |

### `Throw` object

| Field | Type | Description |
|---|---|---|
| `segment` | `Segment` | The dartboard segment the dart landed in. |
| `coords` | `Coords` | Normalized image-space position of the dart tip. |

### `Segment` object

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Short label. Observed pattern: `"S" + number` for a single-value hit (e.g. `"S6"`, `"S18"`, `"S20"`) regardless of inner/outer ring — the ring is disambiguated by `bed`. Presumed (not directly observed) conventions consistent with the codebase's enums: `"D" + number` for doubles, `"T" + number` for triples, `"25"` / `"50"` for outer/inner bull, and a miss/off-board sentinel for `bed: "Outside"`. |
| `number` | `integer` | The dartboard wedge number (1–20). Likely `0` or absent/`null` for bull and miss — not confirmed from live data. |
| `bed` | `string` (enum) | Which ring/area of the segment was hit. Enum values pulled from the frontend's `Bed` enum: `"Single"`, `"SingleInner"`, `"SingleOuter"`, `"Double"`, `"Triple"`, `"Outside"`. (`"Outside"` = missed the scoring area / off the board.) |
| `multiplier` | `integer` | Score multiplier for the hit: `1` (single/outer-bull), `2` (double/inner-bull), `3` (triple). |

### `Coords` object

| Field | Type | Description |
|---|---|---|
| `x` | `float` | Horizontal position, normalized relative to the calibrated board image (roughly `0.0`–`1.0` for on-board hits). **Not clamped** — can go negative (observed `-0.65`) or presumably above `1.0` for detections outside the calibrated frame. |
| `y` | `float` | Vertical position, normalized relative to the calibrated board image. Same caveat as `x` (observed `-0.08`). |

## Status / event values

Collected from the frontend's status→icon/color mapping logic (`L5()` and
related switch statements). Not all of these were observed live; some are
inferred from the UI's exhaustive `switch` handling and are believed to be
the full set the board manager can emit:

| Value | Meaning | UI treatment |
|---|---|---|
| `"Offline"` | No connection to the board at all (derived: `!connected \|\| event === "Offline"`) | red |
| `"Starting"` | Detection engine starting up | orange |
| `"Running"` | Engine active, no dart in flight | green |
| `"Stopping"` | Engine shutting down | orange |
| `"Stopped"` | Engine stopped (matches the idle example above) | yellow/orange |
| `"Throw"` | A dart is currently being detected/processed | green |
| `"Takeout"` | Darts are being pulled out of the board | yellow/green |
| `"Takeout in progress"` | Takeout detected, still ongoing | yellow |
| `"Calibrating"` | Auto-calibration running | purple |
| `"Setup"` | Initial setup mode | — |
| `"Error"` | Error state | red |

The frontend derives a simplified `connection` status from `connected` +
`status`/`event`:

```
connection =
  (!connected || event === "Offline")                        → "Offline"
  status in {"Throw", "Takeout", "Takeout in progress"}        → "Running"
  status === "Stopped"                                         → "Stopped"
  status (whatever it is)                                      → status
  (fallback)                                                    → "Offline"
```

`event` can additionally carry one-off messages that aren't steady-state
statuses, e.g. `"Calibration finished"` (checked via
`state.event === "Calibration finished"` in the UI to trigger a one-time
animation) or `"Throw detected"` (observed live, paired with
`status: "Throw"`). Likely siblings by the same naming pattern (not directly
observed): `"Takeout detected"`, `"Takeout finished"`, `"Reset detected"` —
unconfirmed.

## Notes / caveats

- This documents the **live** `/api/state` response shape only. The much
  larger internal application state (exposed via `/api/state/dump` as
  `state.json` inside a zip) additionally includes `host` (OS/CPU/camera
  device info), `config` (camera, motion, detection, calibration settings),
  and a per-cell motion grid — none of which appear in `/api/state`.
- Bull's-eye (`25`/`50`) and miss (`bed: "Outside"`) throw shapes were **not
  observed** in the sampled live data (the board was idle); their exact
  `name`/`number` representation is inferred from enum definitions in the
  frontend bundle, not confirmed against a live payload. Verify against a
  real throw before depending on it.
- Initial polling caught the board idle/disconnected (`status: "Stopped"`)
  and returned an identical payload every time; a later live sample caught
  it mid-turn (`status: "Throw"`, `connected: false`, `running: true`) which
  disproved the initial assumption that `connected` tracks engine activity.
  `Takeout`/`Calibrating`/`Error` states are still unconfirmed live.
