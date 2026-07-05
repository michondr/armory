-- CreateTable
CREATE TABLE "cartridges" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cartridges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cartridges_userId_idx" ON "cartridges"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "cartridges_userId_name_key" ON "cartridges"("userId", "name");

-- AddForeignKey
ALTER TABLE "cartridges" ADD CONSTRAINT "cartridges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
