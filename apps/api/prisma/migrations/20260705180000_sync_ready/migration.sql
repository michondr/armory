-- Phase 4: make the schema sync-ready for the mobile app.
-- Every synced table gets userId (denormalized for flat per-table sync queries),
-- updatedAt (LWW conflict resolution) and deletedAt (tombstones), plus a
-- (userId, updatedAt) index. New tables: scope_profiles, devices.

-- ---- cartridges: add sync columns ----
ALTER TABLE "cartridges"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "cartridges" ALTER COLUMN "updatedAt" DROP DEFAULT;
CREATE INDEX "cartridges_userId_updatedAt_idx" ON "cartridges"("userId", "updatedAt");

-- ---- guns / ammo / sessions: already sync-shaped, add the sync index ----
CREATE INDEX "guns_userId_updatedAt_idx" ON "guns"("userId", "updatedAt");
CREATE INDEX "ammo_userId_updatedAt_idx" ON "ammo"("userId", "updatedAt");
CREATE INDEX "sessions_userId_updatedAt_idx" ON "sessions"("userId", "updatedAt");

-- ---- ammo_images ----
ALTER TABLE "ammo_images"
  ADD COLUMN "userId" UUID,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "ammo_images" i SET "userId" = a."userId" FROM "ammo" a WHERE i."ammoId" = a."id";
ALTER TABLE "ammo_images" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "ammo_images" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "ammo_images" ADD CONSTRAINT "ammo_images_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ammo_images_userId_updatedAt_idx" ON "ammo_images"("userId", "updatedAt");

-- ---- ammo_price_entries ----
ALTER TABLE "ammo_price_entries"
  ADD COLUMN "userId" UUID,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "ammo_price_entries" p SET "userId" = a."userId" FROM "ammo" a WHERE p."ammoId" = a."id";
ALTER TABLE "ammo_price_entries" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "ammo_price_entries" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "ammo_price_entries" ADD CONSTRAINT "ammo_price_entries_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ammo_price_entries_userId_updatedAt_idx" ON "ammo_price_entries"("userId", "updatedAt");

-- ---- shooting_sets ----
ALTER TABLE "shooting_sets"
  ADD COLUMN "userId" UUID,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "shooting_sets" s SET "userId" = sess."userId" FROM "sessions" sess WHERE s."sessionId" = sess."id";
ALTER TABLE "shooting_sets" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "shooting_sets" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "shooting_sets" ADD CONSTRAINT "shooting_sets_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "shooting_sets_userId_updatedAt_idx" ON "shooting_sets"("userId", "updatedAt");

-- ---- targets ----
ALTER TABLE "targets"
  ADD COLUMN "userId" UUID,
  ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "targets" t SET "userId" = s."userId" FROM "shooting_sets" s WHERE t."setId" = s."id";
ALTER TABLE "targets" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "targets" ADD CONSTRAINT "targets_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "targets_userId_updatedAt_idx" ON "targets"("userId", "updatedAt");

-- ---- shots ----
ALTER TABLE "shots"
  ADD COLUMN "userId" UUID,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "shots" sh SET "userId" = t."userId" FROM "targets" t WHERE sh."targetId" = t."id";
ALTER TABLE "shots" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "shots" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "shots" ADD CONSTRAINT "shots_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "shots_userId_updatedAt_idx" ON "shots"("userId", "updatedAt");

-- ---- scope_profiles ----
CREATE TABLE "scope_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "gunId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "clickValue" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "angularUnit" "AngularUnit" NOT NULL DEFAULT 'MRAD',
    "zeroRangeM" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "sightHeightMm" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "scope_profiles_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "scope_profiles_gunId_idx" ON "scope_profiles"("gunId");
CREATE INDEX "scope_profiles_userId_updatedAt_idx" ON "scope_profiles"("userId", "updatedAt");
ALTER TABLE "scope_profiles" ADD CONSTRAINT "scope_profiles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scope_profiles" ADD CONSTRAINT "scope_profiles_gunId_fkey"
  FOREIGN KEY ("gunId") REFERENCES "guns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---- devices ----
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "devices_userId_idx" ON "devices"("userId");
ALTER TABLE "devices" ADD CONSTRAINT "devices_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
