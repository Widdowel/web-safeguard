-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'ANALYST', 'OPERATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "SiteStatus" AS ENUM ('PENDING', 'SAFE', 'SUSPICIOUS', 'DANGEROUS', 'WHITELISTED');

-- CreateEnum
CREATE TYPE "ScanProvider" AS ENUM ('GOOGLE_SAFE_BROWSING', 'PHISHTANK', 'URLSCAN', 'VIRUSTOTAL', 'INTERNAL_CRAWLER');

-- CreateEnum
CREATE TYPE "ScanVerdict" AS ENUM ('SAFE', 'SUSPICIOUS', 'MALICIOUS', 'ERROR', 'NO_DATA');

-- CreateEnum
CREATE TYPE "BlockRuleType" AS ENUM ('DOMAIN', 'IP', 'IP_PREFIX');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'SITE_CLASSIFY', 'SITE_RESCAN', 'BLOCK_ADD', 'BLOCK_REMOVE', 'BLOCKLIST_PUBLISH', 'INGEST_SOURCE_CREATE', 'INGEST_TOKEN_CREATE', 'INGEST_TOKEN_REVOKE', 'USER_CREATE', 'USER_DELETE', 'USER_ROLE_CHANGE', 'USER_DEACTIVATE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "hashedPassword" TEXT,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "SiteStatus" NOT NULL DEFAULT 'PENDING',
    "trafficScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteClassification" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "fromState" "SiteStatus" NOT NULL,
    "toState" "SiteStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteClassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanRun" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "requesterId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "aggregateScore" DOUBLE PRECISION,
    "aggregateVerdict" "ScanVerdict",

    CONSTRAINT "ScanRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanResult" (
    "id" TEXT NOT NULL,
    "scanRunId" TEXT NOT NULL,
    "provider" "ScanProvider" NOT NULL,
    "verdict" "ScanVerdict" NOT NULL,
    "score" DOUBLE PRECISION,
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockRule" (
    "id" TEXT NOT NULL,
    "siteId" TEXT,
    "type" "BlockRuleType" NOT NULL,
    "value" TEXT NOT NULL,
    "reason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "BlockRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlocklistPublish" (
    "id" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "ruleCount" INTEGER NOT NULL,
    "etag" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlocklistPublish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestToken" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "IngestToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrafficSample" (
    "id" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "srcIpHash" TEXT NOT NULL,
    "dstDomain" TEXT NOT NULL,
    "dstIp" TEXT,
    "bytes" BIGINT NOT NULL DEFAULT 0,
    "countryIso" CHAR(2) NOT NULL,
    "sourceId" TEXT,
    "siteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrafficSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HashSalt" (
    "id" TEXT NOT NULL,
    "saltCipher" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "HashSalt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "AuditAction" NOT NULL,
    "target" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Site_domain_key" ON "Site"("domain");

-- CreateIndex
CREATE INDEX "Site_status_idx" ON "Site"("status");

-- CreateIndex
CREATE INDEX "Site_trafficScore_idx" ON "Site"("trafficScore");

-- CreateIndex
CREATE INDEX "SiteClassification_siteId_idx" ON "SiteClassification"("siteId");

-- CreateIndex
CREATE INDEX "ScanRun_siteId_idx" ON "ScanRun"("siteId");

-- CreateIndex
CREATE INDEX "ScanRun_startedAt_idx" ON "ScanRun"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScanResult_scanRunId_provider_key" ON "ScanResult"("scanRunId", "provider");

-- CreateIndex
CREATE INDEX "BlockRule_isActive_idx" ON "BlockRule"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BlockRule_type_value_key" ON "BlockRule"("type", "value");

-- CreateIndex
CREATE INDEX "BlocklistPublish_publishedAt_idx" ON "BlocklistPublish"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IngestSource_name_key" ON "IngestSource"("name");

-- CreateIndex
CREATE UNIQUE INDEX "IngestToken_tokenHash_key" ON "IngestToken"("tokenHash");

-- CreateIndex
CREATE INDEX "IngestToken_sourceId_idx" ON "IngestToken"("sourceId");

-- CreateIndex
CREATE INDEX "TrafficSample_dstDomain_idx" ON "TrafficSample"("dstDomain");

-- CreateIndex
CREATE INDEX "TrafficSample_ts_idx" ON "TrafficSample"("ts");

-- CreateIndex
CREATE UNIQUE INDEX "TrafficSample_ts_srcIpHash_dstDomain_key" ON "TrafficSample"("ts", "srcIpHash", "dstDomain");

-- CreateIndex
CREATE INDEX "HashSalt_isCurrent_idx" ON "HashSalt"("isCurrent");

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_idx" ON "AuditEvent"("actorId");

-- CreateIndex
CREATE INDEX "AuditEvent_action_idx" ON "AuditEvent"("action");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteClassification" ADD CONSTRAINT "SiteClassification_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteClassification" ADD CONSTRAINT "SiteClassification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanRun" ADD CONSTRAINT "ScanRun_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanRun" ADD CONSTRAINT "ScanRun_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanResult" ADD CONSTRAINT "ScanResult_scanRunId_fkey" FOREIGN KEY ("scanRunId") REFERENCES "ScanRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockRule" ADD CONSTRAINT "BlockRule_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlocklistPublish" ADD CONSTRAINT "BlocklistPublish_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestToken" ADD CONSTRAINT "IngestToken_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "IngestSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrafficSample" ADD CONSTRAINT "TrafficSample_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
