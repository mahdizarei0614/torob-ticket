-- Additive, reviewer-scoped traffic evidence. Existing confirmations are NOT backfilled.
CREATE TABLE "ProviderTariff" (
  "sessionId" TEXT NOT NULL, "providerId" TEXT NOT NULL, "revision" TEXT NOT NULL,
  "payload" JSONB NOT NULL, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "ProviderTariff_pkey" PRIMARY KEY ("sessionId","providerId"),
  CONSTRAINT "ProviderTariff_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "OutboundReferral" (
  "sessionId" TEXT NOT NULL, "referralId" TEXT NOT NULL, "providerId" TEXT NOT NULL,
  "visitorKey" TEXT NOT NULL, "kind" TEXT NOT NULL, "redirectedAt" TIMESTAMPTZ(3) NOT NULL,
  "billable" BOOLEAN NOT NULL, "reason" TEXT NOT NULL, "monthKey" TEXT NOT NULL,
  "monthOrdinal" BIGINT, "rateRial" BIGINT, "tariffRevision" TEXT NOT NULL, "tierIndex" INTEGER,
  CONSTRAINT "OutboundReferral_pkey" PRIMARY KEY ("sessionId","referralId"),
  CONSTRAINT "OutboundReferral_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OutboundReferral_sessionId_referralId_fkey" FOREIGN KEY ("sessionId","referralId") REFERENCES "ReferralEvent"("sessionId","id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OutboundReferral_charge_shape" CHECK (("billable" AND "reason"='eligible' AND "monthOrdinal" IS NOT NULL AND "monthOrdinal">0 AND "tierIndex" IS NOT NULL AND "tierIndex">=0 AND ("rateRial" IS NULL OR "rateRial">=0)) OR (NOT "billable" AND "reason"='repeat-within-hour' AND "monthOrdinal" IS NULL AND "rateRial" IS NULL AND "tierIndex" IS NULL)),
  CONSTRAINT "OutboundReferral_kind" CHECK ("kind" IN ('transport','hotel'))
);
CREATE UNIQUE INDEX "OutboundReferral_sessionId_providerId_monthKey_monthOrdinal_key" ON "OutboundReferral"("sessionId","providerId","monthKey","monthOrdinal");
CREATE INDEX "OutboundReferral_sessionId_providerId_redirectedAt_idx" ON "OutboundReferral"("sessionId","providerId","redirectedAt");
CREATE INDEX "OutboundReferral_sessionId_redirectedAt_idx" ON "OutboundReferral"("sessionId","redirectedAt");
CREATE INDEX "OutboundReferral_sessionId_visitorKey_providerId_billable_redirectedAt_idx" ON "OutboundReferral"("sessionId","visitorKey","providerId","billable","redirectedAt");
