import { execFileSync } from 'node:child_process';
import { requireTestDatabaseUrl } from './test-database.cjs';
/** No defaults: match the exact declared owned test resource to its URL before restarting. */
export function restartOwnedTestDatabase() {
  const connection = new URL(requireTestDatabaseUrl(process.env.TEST_DATABASE_URL));
  const name = process.env.TEST_DATABASE_CONTAINER;
  const owner = process.env.TEST_DATABASE_OWNER;
  if (!name || !owner || !/^torobticket-t\d+-test$/.test(name) || name !== `torobticket-${owner}-test`) throw new Error('Explicit owned test container and matching owner required');
  const rows = JSON.parse(execFileSync('docker', ['inspect', name], { encoding: 'utf8' })) as { Id: string; Config: { Labels: Record<string, string>; Env: string[] }; NetworkSettings: { Ports: Record<string, { HostIp: string; HostPort: string }[]> } }[];
  const row = rows[0];
  if (!row || row.Config.Labels['torobticket.owner'] !== owner || !row.Config.Env.includes(`POSTGRES_DB=${connection.pathname.slice(1)}`) || !row.NetworkSettings.Ports['5432/tcp']?.some(port => port.HostIp === connection.hostname && port.HostPort === connection.port)) throw new Error('Test database ownership or URL does not match container');
  execFileSync('docker', ['restart', row.Id], { stdio: 'pipe' });
}
