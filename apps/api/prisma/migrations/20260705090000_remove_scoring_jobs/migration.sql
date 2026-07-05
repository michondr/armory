-- Auto AI scoring removed in favor of manual tap-to-place. Drop the queue table.
DROP TABLE IF EXISTS "scoring_jobs";
DROP TYPE IF EXISTS "ScoringJobStatus";
