import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { IdentityClaims, LoginTransaction } from '@torob-ticket/provider-sdk';
export interface Registration { revision: number; clientId: string; clientSecret: string; issuer: string; callbackUrl: string; providerId: string; providerName: string; providerOrigin: string }
export interface ProviderState {
  version: 1;
  registrations: Registration[];
  accounts: { id: string; clientId: string; subject: string; createdAt: string }[];
  sessions: { hash: string; clientId: string; accountId: string; expires: number; claims: IdentityClaims; accountStatus: 'created' | 'existing' }[];
  transactions: { hash: string; clientId: string; transaction: LoginTransaction; status: 'pending' | 'redeeming' | 'complete' | 'interrupted'; callbackHash?: string; sessionToken?: string }[];
  outbox: { id: string; clientId: string; referralId: string; subject: string; accountId: string; delivered: boolean }[];
}
const initial = (): ProviderState => ({ version: 1, registrations: [], accounts: [], sessions: [], transactions: [], outbox: [] });
/** A single-process local provider store, independent of the issuer database. */
export class ProviderStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly file: string) {}
  async update<T>(work: (state: ProviderState) => T | Promise<T>): Promise<T> {
    const result = this.queue.then(async () => {
      let state: ProviderState;
      try { state = JSON.parse(await readFile(this.file, 'utf8')) as ProviderState; }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; state = initial(); }
      if (state.version !== 1) throw new Error('Unsupported provider store');
      state.sessions = state.sessions.filter(s => s.expires > Date.now());
      state.transactions = state.transactions.filter(t => t.transaction.createdAt + 600000 > Date.now());
      const value = await work(state);
      await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
      const temporary = `${this.file}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
      await rename(temporary, this.file);
      return value;
    });
    this.queue = result.catch(() => undefined);
    return result;
  }
}
