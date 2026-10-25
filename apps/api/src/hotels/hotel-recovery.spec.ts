import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const storage = vi.hoisted(() => ({ interrupts: 0, initialFailures: 0, failOwned: false, resolves: 0, disconnected: false, running: new Set<string>(), failed: [] as string[], gate: undefined as Promise<void> | undefined, entered: undefined as (() => void) | undefined }));
vi.mock('@torob-ticket/data-access', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@torob-ticket/data-access')>();
    return { ...actual, checkDatabaseReady: async () => {
        }, createPrisma: () => ({ $disconnect: async () => {
                storage.disconnected = true;
            } }), sessionInfo: () => ({ anchorInstant: '2026-10-25T00:00:00Z' }),
        SessionRepository: class {
            cleanup = async () => [];
            reset = async () => ({ id: 'replacement' });
            resolveAndTouch = async () => {
                storage.resolves++;
                return { id: 'test-owner' };
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
