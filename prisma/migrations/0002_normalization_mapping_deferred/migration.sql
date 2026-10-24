-- Session deletion cascades through SearchRun -> ProviderRun -> RawRecord ->
-- NormalizationDecision and directly to MappingRevision. Check their composite
-- relationship at transaction completion so cascade order cannot block reset.
-- NO ACTION and the session-scoped foreign key remain intact.
ALTER TABLE "NormalizationDecision"
  ALTER CONSTRAINT "NormalizationDecision_mapping_fkey"
  DEFERRABLE INITIALLY DEFERRED;
