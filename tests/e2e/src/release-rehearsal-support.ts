import type { BrowserContext, Request, TestInfo } from '@playwright/test';
import { existsSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { expect } from '../fixtures';

export function rehearsalOrigin(baseURL: string | undefined): string {
  if (!baseURL) throw new Error('T33 requires an explicitly configured loopback base URL');
  const url = new URL(baseURL);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash
    || !url.port || Number(url.port) < 1024 || Number(url.port) > 65535) {
    throw new Error('T33 target must be an explicit nonprivileged loopback HTTP origin');
  }
  if (process.env.T33_REHEARSAL_ORIGIN && process.env.T33_REHEARSAL_ORIGIN !== url.origin) {
    throw new Error('T33_REHEARSAL_ORIGIN must exactly match the configured browser origin');
  }
  return url.origin;
}

export function rehearsalEvidence(info: TestInfo, name: string, value: unknown): void {
  writeFileSync(info.outputPath(name + '.json'), JSON.stringify({ capturedAt: new Date().toISOString(), value }, null, 2) + '\n');
}

interface NetworkRequest {
  origin: string;
  pathname: string;
  method: string;
  resourceType: string;
}

/** Real HTTP requests are aborted, including requests from the external map. */
export async function blockExternalNetwork(context: BrowserContext, origin: string) {
  const local: NetworkRequest[] = [], blocked: NetworkRequest[] = [], externalResponses: NetworkRequest[] = [];
  const localAssetFailures: (NetworkRequest & { status: number })[] = [];
  const record = (request: Request): NetworkRequest => {
    const url = new URL(request.url());
    return { origin: url.origin, pathname: url.pathname, method: request.method(), resourceType: request.resourceType() };
  };
  context.on('response', response => {
    const row = record(response.request());
    if (new URL(response.url()).origin !== origin) externalResponses.push(row);
    else if (response.status() >= 400 && ['script', 'stylesheet', 'font', 'image'].includes(row.resourceType)) {
      localAssetFailures.push({ ...row, status: response.status() });
    }
  });
  await context.route('**/*', async route => {
    const request = route.request(), row = record(request);
    if (row.origin === origin) { local.push(row); await route.continue(); }
    else { blocked.push(row); await route.abort('internetdisconnected'); }
  });
  return { local, blocked, externalResponses, localAssetFailures };
}

export type LifecycleAction = 'api-stop' | 'api-start' | 'stack-down' | 'stack-up-no-build';
const protocol = 'torobticket-t33-lifecycle-v1';

interface LifecycleAck {
  protocol: string;
  nonce: string;
  requestId: string;
  project: string;
  origin: string;
  action: LifecycleAction;
  status: 'completed' | 'failed';
  exitCode: number;
  completedAt: string;
  commandLog?: string;
  containerIds?: string[];
}

/** This is an external operator handshake, never an application control hook. */
export function lifecycleCoordinator(origin: string, info: TestInfo) {
  const project = process.env.T33_REHEARSAL_PROJECT, directory = process.env.T33_COORDINATION_DIR;
  const nonce = process.env.T33_COORDINATION_NONCE, evidenceRoot = process.env.E2E_EVIDENCE_DIR;
  if (!project || !/^torobticket-t33-[a-z0-9][a-z0-9-]{2,100}$/.test(project)
    || ['4300', '4301', '4302'].includes(new URL(origin).port)) {
    throw new Error('T33 lifecycle requires a separately owned torobticket-t33 project and nondefault port');
  }
  if (!directory || !isAbsolute(directory) || !existsSync(directory) || !statSync(directory).isDirectory()
    || !evidenceRoot || !nonce || !/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) {
    throw new Error('T33 lifecycle requires an existing owned coordination directory and unique nonce');
  }
  const owned = realpathSync(directory), root = realpathSync(resolve(evidenceRoot));
  const within = relative(root, owned);
  if (!within || within.startsWith('..' + sep) || within === '..' || isAbsolute(within)) {
    throw new Error('T33 coordination directory must be inside the selected evidence root');
  }
  let sequence = 0;
  return {
    project, origin, directory: owned,
    async request(action: LifecycleAction, facts: Record<string, unknown>) {
      const requestId = randomUUID();
      const request = { protocol, nonce, requestId, project, origin, action, sequence: ++sequence,
        requestedAt: new Date().toISOString(), facts };
      const destination = resolve(owned, 'request-' + requestId + '.json');
      const temporary = destination + '.tmp';
      writeFileSync(temporary, JSON.stringify(request, null, 2) + '\n', { flag: 'wx' });
      renameSync(temporary, destination);
      const acknowledgment = resolve(owned, 'ack-' + requestId + '.json');
      let ack: LifecycleAck | undefined;
      await expect.poll(() => {
        if (!existsSync(acknowledgment)) return false;
        const raw = JSON.parse(readFileSync(acknowledgment, 'utf8')) as Partial<LifecycleAck>;
        if (raw.protocol !== protocol || raw.nonce !== nonce || raw.requestId !== requestId
          || raw.project !== project || raw.origin !== origin || raw.action !== action
          || !['completed', 'failed'].includes(raw.status ?? '') || !Number.isInteger(raw.exitCode)
          || typeof raw.completedAt !== 'string' || !Number.isFinite(Date.parse(raw.completedAt))) {
          throw new Error('T33 coordinator acknowledgment does not match this exact requested operation');
        }
        // Select public metadata only; command environments/cookies are never retained.
        ack = { protocol, nonce, requestId, project, origin, action, status: raw.status!, exitCode: raw.exitCode!,
          completedAt: raw.completedAt, ...(typeof raw.commandLog === 'string' ? { commandLog: raw.commandLog } : {}),
          ...(Array.isArray(raw.containerIds) && raw.containerIds.every(id => typeof id === 'string') ? { containerIds: raw.containerIds } : {}) };
        return true;
      }, { timeout: 90_000, intervals: [25, 50, 100, 250], message: 'Root must complete the real owned Docker operation' }).toBe(true);
      if (!ack) throw new Error('T33 coordinator did not acknowledge the operation');
      rehearsalEvidence(info, 'coordination-' + sequence + '-' + action, { request, ack });
      if (ack.status !== 'completed' || ack.exitCode !== 0) throw new Error('The real owned T33 Docker operation failed; inspect its command log');
      return ack;
    },
  };
}

export function lifecycleExplicitlySelected(info: TestInfo): boolean {
  const patterns = Array.isArray(info.config.grep) ? info.config.grep : [info.config.grep];
  return patterns.some(pattern => /release-(?:rehearsal|lifecycle)/.test(pattern.source));
}
