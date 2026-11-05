// Compose ownership checks avoid broad orphan deletion or custom-volume cleanup.
function rows(value) {
  return value.trim().startsWith('[') ? JSON.parse(value) : value.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}
function labelsOf(row) {
  return typeof row.Labels === 'string' ? Object.fromEntries(row.Labels.split(',').map(pair => {
    const boundary = pair.indexOf('=');
    return [pair.slice(0, boundary), pair.slice(boundary + 1)];
  })) : row.Labels ?? {};
}
export function knownDevelopmentVolumeNames(value, project) {
  return rows(value).flatMap(row => {
    const labels = labelsOf(row);
    return typeof project === 'string' && project.length > 0
      && row.Name === `${project}_dev_prisma`
      && labels['com.docker.compose.project'] === project
      && labels['com.docker.compose.volume'] === 'dev_prisma'
      && labels['org.torobticket.role'] === 'generated-client'
      ? [row.Name] : [];
  });
}

// Only the removed, Compose-owned combined gateway may be retired for migration.
export function knownLegacyGatewayIds(value, project) {
  return rows(value).flatMap(row => {
    const labels = labelsOf(row);
    return typeof project === 'string' && project.length > 0 && row.Project === project
      && row.Service === 'gateway' && labels['com.docker.compose.project'] === project
      && labels['com.docker.compose.service'] === 'gateway'
      && typeof row.ID === 'string' && /^[a-f0-9]{12,64}$/.test(row.ID) ? [row.ID] : [];
  });
}
