-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "FixtureVersion" (
    "id" TEXT NOT NULL,
    "catalogRevision" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FixtureVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Place" (
    "fixtureVersion" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("fixtureVersion","id")
);

-- CreateTable
CREATE TABLE "Hotel" (
    "fixtureVersion" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("fixtureVersion","id")
);

-- CreateTable
CREATE TABLE "RoomRate" (
    "fixtureVersion" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "RoomRate_pkey" PRIMARY KEY ("fixtureVersion","hotelId","id")
);

-- CreateTable
CREATE TABLE "DemoSession" (
    "id" TEXT NOT NULL,
    "credentialHash" TEXT NOT NULL,
    "seed" BIGINT NOT NULL,
    "anchorInstant" TIMESTAMPTZ(3) NOT NULL,
    "scenario" TEXT NOT NULL,
    "scenarioRevision" TEXT NOT NULL,
    "fixtureVersion" TEXT NOT NULL,
    "mappingRevision" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DemoSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderOverride" (
    "sessionId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "ProviderOverride_pkey" PRIMARY KEY ("sessionId","providerId")
);

-- CreateTable
CREATE TABLE "MappingRevision" (
    "sessionId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "patch" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MappingRevision_pkey" PRIMARY KEY ("sessionId","id")
);

-- CreateTable
CREATE TABLE "SearchRun" (
    "sessionId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "predecessorId" TEXT,
    "clientGeneration" TEXT NOT NULL,
    "query" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "mappingRevision" TEXT NOT NULL,
    "fixtureVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SearchRun_pkey" PRIMARY KEY ("sessionId","id")
);

-- CreateTable
CREATE TABLE "ProviderRun" (
    "sessionId" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "ProviderRun_pkey" PRIMARY KEY ("sessionId","id")
);

-- CreateTable
CREATE TABLE "RawRecord" (
    "sessionId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "providerRunId" TEXT NOT NULL,
    "sourceNamespace" TEXT NOT NULL,
    "fixtureVersion" TEXT NOT NULL,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "RawRecord_pkey" PRIMARY KEY ("sessionId","id")
);

-- CreateTable
CREATE TABLE "NormalizationDecision" (
    "sessionId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "rawRecordId" TEXT NOT NULL,
    "mappingRevision" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NormalizationDecision_pkey" PRIMARY KEY ("sessionId","id")
);

-- CreateTable
CREATE TABLE "OfferSnapshot" (
    "sessionId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OfferSnapshot_pkey" PRIMARY KEY ("sessionId","id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "sessionId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "offerId" TEXT,
    "hotelSearchId" TEXT,
    "payload" JSONB NOT NULL,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("sessionId","id","version")
);

-- CreateTable
CREATE TABLE "SearchEventRecord" (
    "sessionId" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SearchEventRecord_pkey" PRIMARY KEY ("sessionId","searchId","sequence")
);

-- CreateTable
CREATE TABLE "DatePriceRun" (
    "sessionId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "queryKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DatePriceRun_pkey" PRIMARY KEY ("sessionId","id")
);

-- CreateTable
CREATE TABLE "HotelSearchRun" (
    "sessionId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "queryKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "HotelSearchRun_pkey" PRIMARY KEY ("sessionId","id")
);

-- CreateTable
CREATE TABLE "ReferralIntent" (
    "sessionId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "quoteVersion" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReferralIntent_pkey" PRIMARY KEY ("sessionId","id")
);

-- CreateTable
CREATE TABLE "ReferralEvent" (
    "sessionId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReferralEvent_pkey" PRIMARY KEY ("sessionId","id")
);

-- CreateTable
CREATE TABLE "DemoIdentity" (
    "sessionId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "DemoIdentity_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "sessionId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("sessionId","id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "sessionId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("sessionId","id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DemoSession_credentialHash_key" ON "DemoSession"("credentialHash");

-- CreateIndex
CREATE INDEX "DemoSession_expiresAt_idx" ON "DemoSession"("expiresAt");

-- CreateIndex
CREATE INDEX "SearchRun_sessionId_status_createdAt_idx" ON "SearchRun"("sessionId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderRun_sessionId_searchId_providerId_key" ON "ProviderRun"("sessionId", "searchId", "providerId");

-- CreateIndex
CREATE INDEX "RawRecord_sessionId_providerRunId_idx" ON "RawRecord"("sessionId", "providerRunId");

-- CreateIndex
CREATE INDEX "NormalizationDecision_sessionId_rawRecordId_idx" ON "NormalizationDecision"("sessionId", "rawRecordId");

-- CreateIndex
CREATE INDEX "OfferSnapshot_sessionId_searchId_idx" ON "OfferSnapshot"("sessionId", "searchId");

-- CreateIndex
CREATE INDEX "Quote_sessionId_expiresAt_idx" ON "Quote"("sessionId", "expiresAt");

-- CreateIndex
CREATE INDEX "DatePriceRun_sessionId_queryKey_idx" ON "DatePriceRun"("sessionId", "queryKey");

-- CreateIndex
CREATE INDEX "HotelSearchRun_sessionId_queryKey_idx" ON "HotelSearchRun"("sessionId", "queryKey");

-- CreateIndex
CREATE INDEX "ReferralIntent_sessionId_expiresAt_idx" ON "ReferralIntent"("sessionId", "expiresAt");

-- CreateIndex
CREATE INDEX "ReferralEvent_sessionId_createdAt_idx" ON "ReferralEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralEvent_sessionId_idempotencyKey_key" ON "ReferralEvent"("sessionId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "DemoIdentity_sessionId_id_key" ON "DemoIdentity"("sessionId", "id");

-- CreateIndex
CREATE INDEX "SavedSearch_sessionId_identityId_idx" ON "SavedSearch"("sessionId", "identityId");

-- CreateIndex
CREATE INDEX "AuditEvent_sessionId_createdAt_idx" ON "AuditEvent"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_fixtureVersion_fkey" FOREIGN KEY ("fixtureVersion") REFERENCES "FixtureVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hotel" ADD CONSTRAINT "Hotel_fixtureVersion_fkey" FOREIGN KEY ("fixtureVersion") REFERENCES "FixtureVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomRate" ADD CONSTRAINT "RoomRate_fixtureVersion_hotelId_fkey" FOREIGN KEY ("fixtureVersion", "hotelId") REFERENCES "Hotel"("fixtureVersion", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoSession" ADD CONSTRAINT "DemoSession_fixtureVersion_fkey" FOREIGN KEY ("fixtureVersion") REFERENCES "FixtureVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOverride" ADD CONSTRAINT "ProviderOverride_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MappingRevision" ADD CONSTRAINT "MappingRevision_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchRun" ADD CONSTRAINT "SearchRun_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchRun" ADD CONSTRAINT "SearchRun_sessionId_mappingRevision_fkey" FOREIGN KEY ("sessionId", "mappingRevision") REFERENCES "MappingRevision"("sessionId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchRun" ADD CONSTRAINT "SearchRun_sessionId_predecessorId_fkey" FOREIGN KEY ("sessionId", "predecessorId") REFERENCES "SearchRun"("sessionId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRun" ADD CONSTRAINT "ProviderRun_sessionId_searchId_fkey" FOREIGN KEY ("sessionId", "searchId") REFERENCES "SearchRun"("sessionId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawRecord" ADD CONSTRAINT "RawRecord_sessionId_providerRunId_fkey" FOREIGN KEY ("sessionId", "providerRunId") REFERENCES "ProviderRun"("sessionId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NormalizationDecision" ADD CONSTRAINT "NormalizationDecision_sessionId_rawRecordId_fkey" FOREIGN KEY ("sessionId", "rawRecordId") REFERENCES "RawRecord"("sessionId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferSnapshot" ADD CONSTRAINT "OfferSnapshot_sessionId_searchId_fkey" FOREIGN KEY ("sessionId", "searchId") REFERENCES "SearchRun"("sessionId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_sessionId_offerId_fkey" FOREIGN KEY ("sessionId", "offerId") REFERENCES "OfferSnapshot"("sessionId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_sessionId_hotelSearchId_fkey" FOREIGN KEY ("sessionId", "hotelSearchId") REFERENCES "HotelSearchRun"("sessionId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchEventRecord" ADD CONSTRAINT "SearchEventRecord_sessionId_searchId_fkey" FOREIGN KEY ("sessionId", "searchId") REFERENCES "SearchRun"("sessionId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatePriceRun" ADD CONSTRAINT "DatePriceRun_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelSearchRun" ADD CONSTRAINT "HotelSearchRun_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralIntent" ADD CONSTRAINT "ReferralIntent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralIntent" ADD CONSTRAINT "ReferralIntent_sessionId_quoteId_quoteVersion_fkey" FOREIGN KEY ("sessionId", "quoteId", "quoteVersion") REFERENCES "Quote"("sessionId", "id", "version") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralEvent" ADD CONSTRAINT "ReferralEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralEvent" ADD CONSTRAINT "ReferralEvent_sessionId_intentId_fkey" FOREIGN KEY ("sessionId", "intentId") REFERENCES "ReferralIntent"("sessionId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoIdentity" ADD CONSTRAINT "DemoIdentity_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_sessionId_identityId_fkey" FOREIGN KEY ("sessionId", "identityId") REFERENCES "DemoIdentity"("sessionId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Enforce provenance and valid lifecycle states independently of application code.
ALTER TABLE "SearchRun" ADD CONSTRAINT "SearchRun_status_check" CHECK (status IN ('collecting','complete','partial','empty','failed','cancelled','interrupted'));
ALTER TABLE "SearchRun" ADD CONSTRAINT "SearchRun_fixtureVersion_fkey" FOREIGN KEY ("fixtureVersion") REFERENCES "FixtureVersion"(id);
ALTER TABLE "RawRecord" ADD CONSTRAINT "RawRecord_fixtureVersion_fkey" FOREIGN KEY ("fixtureVersion") REFERENCES "FixtureVersion"(id);
ALTER TABLE "NormalizationDecision" ADD CONSTRAINT "NormalizationDecision_mapping_fkey" FOREIGN KEY ("sessionId", "mappingRevision") REFERENCES "MappingRevision"("sessionId", id);
ALTER TABLE "MappingRevision" ADD CONSTRAINT "MappingRevision_parent_fkey" FOREIGN KEY ("sessionId", "parentId") REFERENCES "MappingRevision"("sessionId", id);
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_source_check" CHECK (("offerId" IS NOT NULL)::integer + ("hotelSearchId" IS NOT NULL)::integer = 1);
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_version_check" CHECK (version > 0);
ALTER TABLE "DemoSession" ADD CONSTRAINT "DemoSession_seed_check" CHECK (seed >= 0 AND seed <= 9007199254740991);
ALTER TABLE "SearchEventRecord" ADD CONSTRAINT "SearchEventRecord_sequence_check" CHECK (sequence > 0);

CREATE FUNCTION immutable_fixture() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'immutable fixture: %', TG_TABLE_NAME; END $$;
CREATE TRIGGER immutable_fixture BEFORE UPDATE OR DELETE ON "FixtureVersion" FOR EACH ROW EXECUTE FUNCTION immutable_fixture();
CREATE TRIGGER immutable_place BEFORE UPDATE OR DELETE ON "Place" FOR EACH ROW EXECUTE FUNCTION immutable_fixture();
CREATE TRIGGER immutable_hotel BEFORE UPDATE OR DELETE ON "Hotel" FOR EACH ROW EXECUTE FUNCTION immutable_fixture();
CREATE TRIGGER immutable_rate BEFORE UPDATE OR DELETE ON "RoomRate" FOR EACH ROW EXECUTE FUNCTION immutable_fixture();

-- Versioned evidence may only be deleted by deleting its entire session.
CREATE FUNCTION immutable_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM "DemoSession" WHERE id = OLD."sessionId") THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'append-only evidence: %', TG_TABLE_NAME;
END $$;
CREATE TRIGGER immutable_evidence BEFORE UPDATE OR DELETE ON "MappingRevision" FOR EACH ROW EXECUTE FUNCTION immutable_evidence();
CREATE TRIGGER immutable_evidence BEFORE UPDATE OR DELETE ON "RawRecord" FOR EACH ROW EXECUTE FUNCTION immutable_evidence();
CREATE TRIGGER immutable_evidence BEFORE UPDATE OR DELETE ON "NormalizationDecision" FOR EACH ROW EXECUTE FUNCTION immutable_evidence();
CREATE TRIGGER immutable_evidence BEFORE UPDATE OR DELETE ON "OfferSnapshot" FOR EACH ROW EXECUTE FUNCTION immutable_evidence();
CREATE TRIGGER immutable_evidence BEFORE UPDATE OR DELETE ON "Quote" FOR EACH ROW EXECUTE FUNCTION immutable_evidence();
CREATE TRIGGER immutable_evidence BEFORE UPDATE OR DELETE ON "SearchEventRecord" FOR EACH ROW EXECUTE FUNCTION immutable_evidence();
CREATE TRIGGER immutable_evidence BEFORE UPDATE OR DELETE ON "ReferralIntent" FOR EACH ROW EXECUTE FUNCTION immutable_evidence();
CREATE TRIGGER immutable_evidence BEFORE UPDATE OR DELETE ON "ReferralEvent" FOR EACH ROW EXECUTE FUNCTION immutable_evidence();
CREATE TRIGGER immutable_evidence BEFORE UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION immutable_evidence();

CREATE FUNCTION immutable_search_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM "DemoSession" WHERE id = OLD."sessionId") THEN RETURN OLD; END IF;
  ELSIF OLD.status = 'collecting' AND NEW."sessionId" = OLD."sessionId" AND NEW.id = OLD.id
    AND NEW.query = OLD.query AND NEW."mappingRevision" = OLD."mappingRevision"
    AND NEW."fixtureVersion" = OLD."fixtureVersion" AND NEW."clientGeneration" = OLD."clientGeneration"
    AND NEW."predecessorId" IS NOT DISTINCT FROM OLD."predecessorId" AND NEW."createdAt" = OLD."createdAt" THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'immutable search evidence';
END $$;
CREATE TRIGGER immutable_search_evidence BEFORE UPDATE OR DELETE ON "SearchRun" FOR EACH ROW EXECUTE FUNCTION immutable_search_evidence();
