-- Full reviewer histories require indexed child-side lineage lookups. These
-- also keep namespace reset/expiry cascades bounded as more reviewers arrive.
CREATE INDEX "Quote_sessionId_offerId_idx" ON "Quote"("sessionId", "offerId");
CREATE INDEX "Quote_sessionId_hotelSearchId_idx" ON "Quote"("sessionId", "hotelSearchId");
CREATE INDEX "ReferralIntent_sessionId_quoteId_quoteVersion_idx" ON "ReferralIntent"("sessionId", "quoteId", "quoteVersion");
CREATE INDEX "ReferralEvent_sessionId_intentId_idx" ON "ReferralEvent"("sessionId", "intentId");
