-- CreateEnum
CREATE TYPE "ScoringJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "scoring_jobs" (
    "id" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "status" "ScoringJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scoring_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scoring_jobs_status_idx" ON "scoring_jobs"("status");

-- CreateIndex
CREATE INDEX "scoring_jobs_targetId_idx" ON "scoring_jobs"("targetId");

-- AddForeignKey
ALTER TABLE "scoring_jobs" ADD CONSTRAINT "scoring_jobs_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
