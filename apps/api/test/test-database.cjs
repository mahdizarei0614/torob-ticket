/** Reject ambiguous connection targets before migrations, seed, cleanup or tests. */
function requireTestDatabaseUrl(value) {
  const invalid = () => new Error('TEST_DATABASE_URL must be an explicit PostgreSQL URL with a host and a simple database name ending in _test, without query parameters or fragments.');
  let url;
  try { url = new URL(value); } catch { throw invalid(); }
  if (typeof value !== 'string' || value !== value.trim() ||
      !['postgresql:', 'postgres:'].includes(url.protocol) || !url.hostname ||
      !/^\/[A-Za-z0-9_]+_test$/.test(url.pathname) || url.search || url.hash) throw invalid();
  return value;
}
module.exports = { requireTestDatabaseUrl };
