try {
  const response = await fetch('http://127.0.0.1:4302/api/health/ready', { signal: AbortSignal.timeout(3000) });
  if (!response.ok || (await response.json()).status !== 'ready') throw new Error(`Readiness failed: HTTP ${response.status}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
