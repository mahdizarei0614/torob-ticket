-- Preserve applied0004 bytes; PostgreSQL truncated its long identifier to63characters.
ALTER INDEX "OutboundReferral_sessionId_visitorKey_providerId_billable_redir"
RENAME TO "OutboundReferral_visitor_provider_billable_time_idx";
