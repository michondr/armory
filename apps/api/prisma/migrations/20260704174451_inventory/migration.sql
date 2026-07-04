-- CreateEnum
CREATE TYPE "BcModel" AS ENUM ('G1', 'G7');

-- CreateTable
CREATE TABLE "guns" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "caliber" TEXT,
    "purchasePrice" DECIMAL(12,2),
    "purchaseDate" TIMESTAMP(3),
    "initialRoundCount" INTEGER NOT NULL DEFAULT 0,
    "cleaningIntervalRounds" INTEGER,
    "lastCleanedAtRound" INTEGER NOT NULL DEFAULT 0,
    "imagePath" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "guns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ammo" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "caliber" TEXT,
    "bulletWeightG" DOUBLE PRECISION,
    "muzzleVelocityMps" DOUBLE PRECISION,
    "ballisticCoefficient" DOUBLE PRECISION,
    "bcModel" "BcModel",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ammo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ammo_images" (
    "id" UUID NOT NULL,
    "ammoId" UUID NOT NULL,
    "imagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ammo_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ammo_price_entries" (
    "id" UUID NOT NULL,
    "ammoId" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "pricePerRound" DECIMAL(12,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CZK',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "vendor" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ammo_price_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guns_userId_idx" ON "guns"("userId");

-- CreateIndex
CREATE INDEX "ammo_userId_idx" ON "ammo"("userId");

-- CreateIndex
CREATE INDEX "ammo_images_ammoId_idx" ON "ammo_images"("ammoId");

-- CreateIndex
CREATE INDEX "ammo_price_entries_ammoId_idx" ON "ammo_price_entries"("ammoId");

-- AddForeignKey
ALTER TABLE "guns" ADD CONSTRAINT "guns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ammo" ADD CONSTRAINT "ammo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ammo_images" ADD CONSTRAINT "ammo_images_ammoId_fkey" FOREIGN KEY ("ammoId") REFERENCES "ammo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ammo_price_entries" ADD CONSTRAINT "ammo_price_entries_ammoId_fkey" FOREIGN KEY ("ammoId") REFERENCES "ammo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
