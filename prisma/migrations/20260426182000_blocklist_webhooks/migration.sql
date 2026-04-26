-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'WEBHOOK_SUBSCRIBE';
ALTER TYPE "AuditAction" ADD VALUE 'WEBHOOK_UNSUBSCRIBE';

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "BlocklistSubscriber" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEtagSent" TEXT,
    "lastSuccessAt" TIMESTAMP(3),

    CONSTRAINT "BlocklistSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "etag" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "responseCode" INTEGER,
    "responseBody" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlocklistSubscriber_isActive_idx" ON "BlocklistSubscriber"("isActive");

-- CreateIndex
CREATE INDEX "WebhookDelivery_subscriberId_idx" ON "WebhookDelivery"("subscriberId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_idx" ON "WebhookDelivery"("status");

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "BlocklistSubscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
