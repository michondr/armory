# Armory mobile (Expo)

Offline-first companion app: capture range sessions, score targets by tapping the
photo, run the ballistics calculator, and sync everything to the server when online.

## Run it (development)

From the repo root:

```bash
pnpm install
pnpm --filter @armory/mobile start   # or: cd apps/mobile && npx expo start
```

Then open **Expo Go** on your Android phone and scan the QR code. Phone and dev
machine must be on the same network (otherwise `npx expo start --tunnel`).

### Pointing at an API

By default the app talks to production (`https://armory.michondr.space/api`, set in
`app.json` → `extra.apiUrl`). For a local API, start Expo with your machine's LAN IP
(`localhost` won't resolve from the phone):

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000/api npx expo start
```

## Standalone APK (range use, no Play Store)

```bash
npx eas build --platform android --profile preview   # cloud build → installable APK
# or fully local:
npx eas build --platform android --profile preview --local
```

Sideload the APK. It works fully offline and syncs when it has a connection.

## Architecture

- **Local mirror** — `src/db`: every synced table is mirrored in SQLite
  (`expo-sqlite`). Schema is generated from `src/db/tables.ts` metadata. All writes
  go through `src/data/mutations.ts`, which set `updatedAt`, generate client UUIDs,
  and mark rows dirty.
- **Sync engine** — `src/sync/engine.ts`: push dirty rows → pull since cursor →
  apply last-write-wins locally → drain the image upload queue. Runs on foreground,
  reconnect (`NetInfo`), after finishing a session, and on manual pull-to-refresh.
- **Images** — captured with the camera/gallery, downscaled client-side, queued in
  `pending_images`, and uploaded content-addressed (idempotent retries).
- **Ballistics** — `@armory/ballistics` (shared with web); the calculator and scope
  profiles live under the Ballistics tab.

> Note: the local store uses `expo-sqlite` directly (raw SQL from table metadata)
> rather than Drizzle ORM, to avoid bundling drizzle-kit migrations in the app.
