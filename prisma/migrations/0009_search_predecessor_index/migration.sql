-- Namespace cascades also validate every search retry/predecessor reference.
-- Index the child-side key to avoid a full scoped scan for every search deleted.
CREATE INDEX "SearchRun_sessionId_predecessorId_idx" ON "SearchRun"("sessionId", "predecessorId");
