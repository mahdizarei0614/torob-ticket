// Compose's broad --remove-orphans could remove unrelated custom services.
// Only these two explicitly marked services belong to our dev override.
function rows(value) {
  return value.trim().startsWith('[') ? JSON.parse(value) : value.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}
function labelsOf(row) {
  return typeof row.Labels === 'string' ? Object.fromEntries(row.Labels.split(',').map(pair => {
    const boundary = pair.indexOf('=');
    return [pair.slice(0, boundary), pair.slice(boundary + 1)];
  })) : row.Labels ?? {};
}
export function knownDevelopmentFrontendIds(value, project) {
  return rows(value).flatMap(row => {
    const labels = labelsOf(row);
    return typeof project === 'string' && project.length > 0 && row.Project === project
      && ['web', 'admin'].includes(row.Service)
      && labels['com.docker.compose.project'] === project
      && labels['com.docker.compose.service'] === row.Service
      && labels['org.torobticket.runtime'] === 'development'
      && typeof row.ID === 'string' && /^[a-f0-9]{12,64}$/.test(row.ID)
      ? [row.ID] : [];
  });
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
