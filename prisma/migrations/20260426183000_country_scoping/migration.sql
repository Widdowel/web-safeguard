-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'BLOCK_BULK_ADD';

-- AlterTable
ALTER TABLE "BlockRule" ADD COLUMN "countries" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "ScanRun" ADD COLUMN "countries" TEXT[] DEFAULT ARRAY[]::TEXT[];
