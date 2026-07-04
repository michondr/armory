# Shooting Diary — Build Plan

## Context

Greenfield, self-hosted, **multiuser** app for a firearms hobbyist to manage a gun + ammo
inventory, log range sessions, score targets (from photos or manually), track per-gun round
counts + cleaning reminders, and compute long-range scope adjustments. It runs in the user's
Docker network behind Traefik at `armory.domain.com`, with a **companion mobile app that works
fully offline at the range and syncs afterwards**.

Working dir `/home/michondr/_michondr/shooting-diary` is empty (not a git repo yet).

### Decisions already locked (this conversation)
- **Images**: stored as files on a **mounted Docker volume**; DB stores only path + metadata. No MinIO, no bytea.
- **Scoring**: **precision rings** first; schema + UI built **IPSC-ready** (zones + hit factor, phone speaker-beep → mic shot-detection timer — stubbed with UI hints now, wired later).
- **Units**: canonical **SI stored**, **per-user display units** (metric/imperial) + **per-scope click value** (MOA or MRAD).
- **Vision**: **local OpenCV pipeline in a Python worker** (no external API, no key, no cost, offline-capable). Images still **cropped + downscaled client-side** before upload. Behind a provider-agnostic `VisionScorer` interface (swappable for an ONNX/on-device model later).

---

## Stack

| Layer | Choice |
|---|---|
| Repo | TypeScript **monorepo**, pnpm workspaces + Turborepo |
| Backend | **NestJS** + **PostgreSQL** + **Prisma**; REST + Zod DTOs |
| Web | **React + Vite** + TanStack Query + Tailwind + shadcn/ui; **dark mode by default** (theme-aware, user toggle, persisted) |
| Mobile | **Expo (React Native)** + local **SQLite (Drizzle)** + custom sync |
| Jobs | **pg-boss** (Postgres-backed queue → **no Redis**), enqueued by the API |
| Vision | **Python + OpenCV** scorer service, consumes scoring jobs from pg-boss (local, offline, no API) |
| Email | **nodemailer**, per-user SMTP (encrypted at rest) |
| Shared | `@armory/ballistics` (pure TS), `@armory/shared` (types + Zod schemas + score math) |
| Deploy | `docker-compose`: `postgres`, `api`, `web`, `scorer` (4 services) + Traefik labels |

Monorepo layout:
```
apps/api        NestJS backend (enqueues pg-boss jobs)
apps/web        React + Vite SPA
apps/mobile     Expo app
apps/scorer     Python + OpenCV worker (target scoring)
packages/shared     types, Zod schemas, unit conversion, score/stat math
packages/ballistics trajectory solver + click derivation
infra/          docker-compose.yml, Dockerfiles, Traefik labels, .env.example
```

---

## Data model (Prisma)

All user-owned tables carry `id` (client-gen UUID), `userId`, `updatedAt`, `deletedAt` (soft
delete) to support sync.

- **User** — email, passwordHash (argon2), displayName, unitSystem, angularUnit, smtp{host,port,user,passEnc,from}
- **Gun** — name, purchasePrice, purchaseDate, initialRoundCount, imagePath, caliber, notes, cleaningIntervalRounds, lastCleanedAtRound
  - total rounds = initialRoundCount + Σ session shots; cleaning due when `(total − lastCleanedAtRound) ≥ cleaningIntervalRounds`
- **ScopeProfile** — gunId, name, clickValue, angularUnit, zeroRangeM, sightHeightMm, reticle notes
- **Ammo** — name, caliber, bulletWeightG, muzzleVelocityMps, ballisticCoefficient, bcModel (G1/G7), notes; Postgres `tsvector` fulltext on name+notes
- **AmmoImage** — ammoId, imagePath
- **AmmoPriceEntry** — ammoId, date, pricePerRound, currency, quantity, vendor, note *(price-per-round log over time)*
- **Session** — gunId, ammoId?, startedAt, locationName, lat, lng, discipline (SHORT|LONG), env{temp,pressure,humidity}? , notes
- **ShootingSet** — sessionId, order, distanceM, ipscTimeSeconds? (IPSC-ready), notes
- **Target** — setId, imagePath?, shotCount, scoringSystem (RINGS|IPSC|GROUP), templateId, status (PENDING|SCORED|APPROVED|MANUAL), totalScore, maxScorePerShot
- **Shot** — targetId, x, y (normalized to target center/scale), ringValue | zone (A/C/D), source (AI|MANUAL)
- **TargetTemplate** — userId? (null = global preset), name, type, geometry (ring radii+values or zones), physicalSizeMm — used both to compute score from hole position and to guide the vision prompt
- **Device** — userId, name, lastSyncAt

---

## Sync protocol (mobile ⇄ api)

Single-user-per-record ⇒ **last-write-wins by `updatedAt`**; conflicts are rare.
- **Pull**: `GET /sync/changes?since=<cursor>` → all rows (incl. soft-deleted) updated after cursor; response carries new cursor (server clock).
- **Push**: `POST /sync/changes` with locally-changed rows → server upserts LWW, returns authoritative rows.
- **Images**: captured offline, queued locally; after row sync the client uploads each pending image (multipart, content-addressed by hash for idempotency); server writes to volume, sets `imagePath`, enqueues scoring job.
- Client stores cursor + dirty flags in SQLite. Everything the range flow touches works offline.

---

## Scoring & stats (`packages/shared`)

- **Rings**: hole (x,y) → highest ring touched via template geometry → per-shot value.
- **IPSC (ready, later)**: zone hits → points; **hit factor = points ÷ time**; time from set `ipscTimeSeconds` (later: phone beep+mic).
- **Grouping**: extreme spread + mean radius from hole coordinates.
- **Stat definitions (per user's spec)**:
  - *average score* = mean per-shot ring value.
  - *90% score* = mean value of the **best 90%** of shots.
  - *10% score* = mean value of the **worst 10%** of shots.
  - *grouping* = extreme spread (mm), converted to display units.

## Vision pipeline (Phase 3) — local OpenCV

Client crop+downscale → upload → api enqueues a pg-boss job → **`scorer` (Python/OpenCV)** picks
it up and:
1. **Locate the target**: detect the ring pattern / boundary (Hough circles or template match) to establish **center + scale (px→mm)**.
2. **Detect holes**: blob/contour detection (dark round blobs against the target, aided by `shotCount` as an expected-count prior; optional diff against a clean-target reference of that `TargetTemplate`).
3. **Score by geometry** (not the model): map each hole → normalized coords → highest ring touched via `TargetTemplate`.
4. Write `Shot` rows + `totalScore`, set status `SCORED`, notify api → **email** (user SMTP) with a link to the session detail.

User then reviews holes overlaid on the photo, adjusts, and **approves** (`APPROVED`). All CV
params live in config so the pipeline is tunable as we test on real photos. Behind a
`VisionScorer` contract so an ONNX/on-device model can replace it later without touching the api.

## Ballistics (`packages/ballistics`, mobile UI only)

Point-mass numerical trajectory with G1/G7 drag tables. Inputs: muzzle velocity, BC, bullet
weight, sight height, zero range, target range, wind speed+angle, air density (temp/pressure,
sensible defaults), scope click value + unit. Outputs elevation + windage **clicks**, plus a
**derivation breakdown** (drop cm → angular MOA/MRAD → clicks, time of flight, retained velocity,
wind lag) surfaced as the "advanced info" learning view. Pure TS, offline.

---

## UX
**Dark mode is the default theme** across web and mobile, with a persisted light/dark toggle; all
UI styled to be theme-aware in both.

## Web app (behind auth)
Dashboard (gun carousel; gun list by `lastShotAt` desc; recent sessions with hit-factor/grouping/
avg/90%/10% + gun avatar; click gun → expand stats + filter sessions), Guns CRUD, Ammo CRUD +
price log + fulltext + autosuggest, Session wizard (when/where/discipline/gun/ammo → sets →
targets: optional photo + shotCount, manual **or** AI → finish), Session detail (holes overlaid,
approve/adjust), Settings (units, angular unit, SMTP). **No ballistics UI on web** (mobile only).

## Mobile app (Expo)
Auth + offline token, SQLite mirror + sync engine + image upload queue, offline session capture
(camera, GPS, location preselect from history), **ballistics calculator** + scope profiles, IPSC
timer **scaffolding** (speaker beep + mic shot-detect stub, with UI hints). Talks to `https://armory.domain.com/api`.

## Ammo autosuggest
Start with a **bundled seed dataset** of common calibers/loads (caliber, weight, muzzle velocity,
BC) + manual entry; **online lookup deferred to Phase 5** (no reliable free ammo API — will
evaluate a maintained dataset/scrape then).

## Deploy (`infra/`)
`docker-compose` with `postgres`, `api`, `web`, `scorer`. Traefik labels: web on
`Host(armory.domain.com)`, api on `Host(armory.domain.com) && PathPrefix(/api)` (`scorer` is
internal, not exposed via Traefik). Secrets (JWT, app encryption key for SMTP pass, DB creds) via
`.env`. `scorer` shares the images volume (read) + Postgres (pg-boss). Volumes for images +
Postgres data.

---

## Phased roadmap (each phase independently reviewable)

- **Phase 0 — Foundation**: monorepo, docker-compose + Traefik, Prisma schema + migrations, auth (register/login, JWT access+refresh, argon2), user settings (units + SMTP). *Deliverable: log in, set preferences, app boots at armory.domain.com.*
- **Phase 1 — Inventory (web)**: Guns CRUD (+ image, round count, cleaning reminder), Ammo CRUD (+ images, price log, fulltext), seed-dataset autosuggest.
- **Phase 2 — Sessions & scoring (web)**: session wizard, sets, targets, **manual** ring scoring + stat math, dashboard with stats + gun filtering, session detail.
- **Phase 3 — Vision + review loop**: `scorer` (Python/OpenCV) service, pg-boss job flow, crop/downscale, ring/hole detection + geometric scoring, email notify, holes-overlay review/approve UI. Iterate CV params on real photos.
- **Phase 4 — Mobile app**: Expo + SQLite + sync engine + image upload queue, offline capture flow, ballistics calculator + derivation + scope profiles, IPSC timer scaffolding.
- **Phase 5 — Advanced**: full IPSC (beep/mic timer + hit factor), online ammo autosuggest, cleaning-due notifications, polish.

I'll build **Phase 0 first and stop for your review** before proceeding, then go phase by phase.

---

## Verification
- **Phase 0**: `docker compose up` boots postgres+api+web; register + login returns tokens; Prisma migration applies; settings persist; Traefik routes `armory.domain.com` (+ `/api`). Auth e2e test (register→login→me).
- **Per phase**: run the affected flow end-to-end in the running app (not just unit tests) — e.g. Phase 2: create a session → add set → add target → enter shots → see it scored + reflected in dashboard stats. Unit tests for `packages/shared` score/stat math + `packages/ballistics` (known-trajectory fixtures). Sync tested with an offline→online round-trip. `verify` skill gates each phase before moving on.
