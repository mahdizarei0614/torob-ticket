import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const storage = vi.hoisted(() => ({ interrupts: 0, initialFailures: 0, failOwned: false, resolves: 0, disconnected: false, sessions: new Map<string, {id:string;trafficVisitorSecret:string|null}>(), running: new Set<string>(), failed: [] as string[], gate: undefined as Promise<void> | undefined, entered: undefined as (() => void) | undefined }));
vi.mock('@torob-ticket/data-access', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@torob-ticket/data-access')>();
    return { ...actual, checkDatabaseReady: async () => {
        }, createPrisma: () => ({
            // The real reset now bootstraps private visitor state through the
            // same scoped row lock. Model that storage seam rather than bypassing it.
            $transaction: async (work: (tx: unknown) => Promise<unknown>) => {
                let lockedId: string | undefined;
                return work({
                    $queryRaw: async (_query: TemplateStringsArray, id: string) => {
                        lockedId = id;
                        return storage.sessions.has(id) ? [{id}] : [];
                    },
                    demoSession: {
                        findUniqueOrThrow: async ({where}: {where:{id:string}}) => {
                            if (lockedId !== where.id || !storage.sessions.has(where.id)) throw Error('Session fixture requires its scoped lock');
                            return storage.sessions.get(where.id)!;
                        },
                        update: async ({where,data}: {where:{id:string};data:{trafficVisitorSecret:string}}) => {
                            if (lockedId !== where.id || !storage.sessions.has(where.id)) throw Error('Session fixture requires its scoped lock');
                            const row = {...storage.sessions.get(where.id)!,trafficVisitorSecret:data.trafficVisitorSecret};
                            storage.sessions.set(where.id,row);
                            return row;
                        },
                    },
                });
            },
            $disconnect: async () => {
                storage.disconnected = true;
            } }), sessionInfo: () => ({ anchorInstant: '2026-10-25T00:00:00Z' }),
        SessionRepository: class {
            cleanup = async () => [];
            reset = async (scope:{sessionId:string}) => {
                storage.sessions.delete(scope.sessionId);
                const row = {id:'replacement',trafficVisitorSecret:null};
                storage.sessions.set(row.id,row);
                return row;
            };
            resolveAndTouch = async () => {
                storage.resolves++;
                const row = storage.sessions.get('test-owner');
                if (!row) throw new actual.RepositoryError('SESSION_EXPIRED');
                return row;
            };
        },
        SearchRepository: class {
            interruptUnfinished = async () => {
            };
        },
        HotelRepository: class {
            interruptUnfinished = async () => {
                storage.interrupts++;
                if (storage.gate) {
                    storage.entered?.();
                    await storage.gate;
                }
                if (storage.initialFailures > 0) {
                    storage.initialFailures--;
                    throw Error('initial hotel recovery unavailable');
                }
                storage.running.clear();
            };
            fail = async (_scope: unknown, id: string) => {
                storage.failed.push(id);
                if (storage.failOwned)
                    throw Error('owned recovery unavailable');
                storage.running.delete(id);
            };
        } };
});
import { SessionService } from '../sessions/session.service';
import { HotelWorkOwner } from './hotel-recheck';
import type { SessionContext } from '../sessions/session-context';
const clock = { now: () => new Date('2026-10-25T07:00:00Z') };
const context = { sessionId: 'test-owner', scope: { sessionId: 'test-owner' }, info: { seed: 2020, anchorInstant: '2026-10-25T00:00:00Z', scenario: 'normal' } } as SessionContext;
// Fixed-shape fabricated parser input only; no live credential, header or value is logged.
const request = { headers: { cookie: 'torob_demo=' + 'a'.repeat(43) } }, response = { setHeader: () => {
    } };
beforeEach(() => {
    storage.disconnected = false;
    storage.interrupts = 0;
    storage.initialFailures = 0;
    storage.failOwned = false;
    storage.resolves = 0;
    storage.sessions.clear();
    storage.sessions.set('test-owner',{id:'test-owner',trafficVisitorSecret:null});
    storage.running.clear();
    storage.failed.length = 0;
    storage.gate = undefined;
    storage.entered = undefined;
});
describe('hotel recovery admission and owner isolation', () => {
    it('retries the full recovery barrier before authenticating an existing sandbox after transient bootstrap failure', async () => {
        const sessions = new SessionService(clock), owner = new HotelWorkOwner(sessions);
        storage.initialFailures = 2;
        try {
            await expect(sessions.ensureReady()).rejects.toThrow('initial hotel recovery unavailable');
            await expect(sessions.authenticate(request, response)).rejects.toThrow('initial hotel recovery unavailable');
            expect(storage.resolves).toBe(0);
            expect(storage.interrupts).toBe(2);
            await sessions.authenticate(request, response);
            expect(storage.resolves).toBe(1);
            expect(storage.interrupts).toBe(3);
        }
        finally {
            await owner.destroy();
        }
    });
    it('reconciles startup before direct hotel admission and never globally interrupts a live peer after one job fails', async () => {
        const sessions = new SessionService(clock), owner = new HotelWorkOwner(sessions);
        storage.initialFailures = 1;
        await expect(sessions.ensureReady()).rejects.toThrow('initial hotel recovery unavailable');
        let release!: () => void;
        const peer = owner.run(context, async (item) => {
            item.id = 'peer';
            storage.running.add(item.id);
            await new Promise<void>(resolve => {
                release = resolve;
            });
        });
        try {
            await expect(owner.run(context, async (item) => {
                item.id = 'failed';
                storage.running.add(item.id);
                throw Error('operation failed');
            })).rejects.toThrow('operation failed');
            expect(storage.running.has('peer')).toBe(true);
            expect(storage.running.has('failed')).toBe(false);
            expect(storage.failed).toEqual(['failed']);
            expect(storage.interrupts).toBe(2);
        }
        finally {
            release();
            await peer;
            await owner.destroy();
        }
    });
    it('retains failed owned cleanup for readiness retry without interrupting a healthy live peer', async () => {
        const sessions = new SessionService(clock), owner = new HotelWorkOwner(sessions);
        await sessions.ensureReady();
        let release!: () => void;
        const peer = owner.run(context, async (item) => {
            item.id = 'peer';
            storage.running.add(item.id);
            await new Promise<void>(resolve => {
                release = resolve;
            });
        });
        storage.failOwned = true;
        try {
            await expect(owner.run(context, async (item) => {
                item.id = 'failed';
                storage.running.add(item.id);
                throw Error('operation failed');
            })).rejects.toThrow('operation failed');
            await expect(sessions.ensureReady()).rejects.toThrow('owned recovery unavailable');
            expect(storage.running.has('peer')).toBe(true);
            storage.failOwned = false;
            await sessions.authenticate(request, response);
            expect(storage.running.has('failed')).toBe(false);
            expect(storage.running.has('peer')).toBe(true);
            expect(storage.interrupts).toBe(1);
        }
        finally {
            release();
            await peer;
            await owner.destroy();
        }
    });
});
it('registers startup waiters so owner teardown fences admission and later calls', async () => {
    const sessions = new SessionService(clock), owner = new HotelWorkOwner(sessions);
    let release!: () => void, entered!: () => void;
    storage.gate = new Promise<void>(resolve => {
        release = resolve;
    });
    const reached = new Promise<void>(resolve => {
        entered = resolve;
    });
    storage.entered = entered;
    let called = false;
    const pending = owner.run(context, async () => {
        called = true;
    });
    await reached;
    const teardown = owner.destroy();
    release();
    await expect(pending).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    await teardown;
    expect(called).toBe(false);
    await expect(owner.run(context, async () => {
        called = true;
    })).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    expect(called).toBe(false);
});
it('registers startup waiters before reset cancels the old sandbox', async () => {
    const sessions = new SessionService(clock), owner = new HotelWorkOwner(sessions);
    let release!: () => void, entered!: () => void;
    storage.gate = new Promise<void>(resolve => {
        release = resolve;
    });
    const reached = new Promise<void>(resolve => {
        entered = resolve;
    });
    storage.entered = entered;
    let called = false;
    const pending = owner.run(context, async () => {
        called = true;
    });
    await reached;
    await sessions.reset(context, {}, { headers: {} }, response);
    expect(storage.sessions.has('test-owner')).toBe(false);
    expect(Boolean(storage.sessions.get('replacement')?.trafficVisitorSecret)).toBe(true);
    release();
    try {
        await expect(pending).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
        expect(called).toBe(false);
    }
    finally {
        await owner.destroy();
    }
});
it('session shutdown waits for a registered startup waiter to cancel before disconnecting storage', async () => {
    const sessions = new SessionService(clock), owner = new HotelWorkOwner(sessions);
    let release!: () => void, entered!: () => void;
    storage.gate = new Promise<void>(resolve => {
        release = resolve;
    });
    const reached = new Promise<void>(resolve => {
        entered = resolve;
    });
    storage.entered = entered;
    let called = false;
    const pending = owner.run(context, async () => {
        called = true;
    });
    await reached;
    const closing = sessions.onModuleDestroy();
    expect(storage.disconnected).toBe(false);
    release();
    await expect(pending).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    await closing;
    expect(called).toBe(false);
    expect(storage.disconnected).toBe(true);
    await owner.destroy();
});
