-- CreateEnum
CREATE TYPE "ScanRunStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- AlterTable Site
ALTER TABLE "Site" ADD COLUMN "trustScore" INTEGER;
ALTER TABLE "Site" ADD COLUMN "lastScanAt" TIMESTAMP(3);

-- AlterTable ScanRun
ALTER TABLE "ScanRun" ADD COLUMN "status" "ScanRunStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "ScanRun" ADD COLUMN "trustScore" INTEGER;

-- Backfill: existing scans with finishedAt are DONE, others are PENDING
UPDATE "ScanRun" SET "status" = 'DONE' WHERE "finishedAt" IS NOT NULL;

-- CreateIndex
CREATE INDEX "Site_trustScore_idx" ON "Site"("trustScore");
CREATE INDEX "Site_lastScanAt_idx" ON "Site"("lastScanAt");
CREATE INDEX "ScanRun_status_idx" ON "ScanRun"("status");
