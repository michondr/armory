-- CreateEnum
CREATE TYPE "Discipline" AS ENUM ('SHORT', 'LONG');

-- CreateEnum
CREATE TYPE "ScoringSystem" AS ENUM ('RINGS', 'IPSC', 'GROUP');

-- CreateEnum
CREATE TYPE "TargetStatus" AS ENUM ('PENDING', 'SCORED', 'APPROVED', 'MANUAL');

-- CreateEnum
CREATE TYPE "ShotSource" AS ENUM ('AI', 'MANUAL');

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "gunId" UUID NOT NULL,
    "ammoId" UUID,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locationName" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "discipline" "Discipline" NOT NULL DEFAULT 'SHORT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shooting_sets" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "distanceM" DOUBLE PRECISION,
    "ipscTimeSeconds" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shooting_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "targets" (
    "id" UUID NOT NULL,
    "setId" UUID NOT NULL,
    "imagePath" TEXT,
    "shotCount" INTEGER NOT NULL DEFAULT 0,
    "scoringSystem" "ScoringSystem" NOT NULL DEFAULT 'RINGS',
    "maxScorePerShot" INTEGER,
    "status" "TargetStatus" NOT NULL DEFAULT 'PENDING',
    "totalScore" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shots" (
    "id" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "index" INTEGER NOT NULL DEFAULT 0,
    "ringValue" DOUBLE PRECISION,
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "zone" TEXT,
    "source" "ShotSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_gunId_idx" ON "sessions"("gunId");

-- CreateIndex
CREATE INDEX "shooting_sets_sessionId_idx" ON "shooting_sets"("sessionId");

-- CreateIndex
CREATE INDEX "targets_setId_idx" ON "targets"("setId");

-- CreateIndex
CREATE INDEX "shots_targetId_idx" ON "shots"("targetId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_gunId_fkey" FOREIGN KEY ("gunId") REFERENCES "guns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_ammoId_fkey" FOREIGN KEY ("ammoId") REFERENCES "ammo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shooting_sets" ADD CONSTRAINT "shooting_sets_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "targets" ADD CONSTRAINT "targets_setId_fkey" FOREIGN KEY ("setId") REFERENCES "shooting_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shots" ADD CONSTRAINT "shots_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
