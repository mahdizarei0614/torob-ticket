import {expect,it,vi} from 'vitest';
import type {Prisma,PrismaClient} from './generated/client';
import {SessionRepository} from './session-repository';
const now=new Date('2026-10-29T08:00:00Z');
function fixture(){
 const order:string[]=[];
 const tx={
  $executeRaw:vi.fn<(strings:TemplateStringsArray,...values:unknown[])=>Promise<number>>(async()=>{order.push('deadline');return 0;}),
  $queryRaw:vi.fn<(strings:TemplateStringsArray,...values:unknown[])=>Promise<{id:string}[]>>(async()=>{order.push('collection');return [{id:'expired-reviewer'}];}),
 };
 const transaction=vi.fn<(work:(value:Prisma.TransactionClient)=>Promise<string[]>,options?:unknown)=>Promise<string[]>>(async work=>work(tx as unknown as Prisma.TransactionClient));
 const db={$transaction:transaction} as unknown as PrismaClient;
 return{repository:new SessionRepository(db),tx,transaction,order};
}
it('sets bounded database and transaction deadlines before collecting one lock-skipping expired reviewer',async()=>{
 const f=fixture();expect(await f.repository.cleanup(now)).toEqual(['expired-reviewer']);
 expect(f.order).toEqual(['deadline','collection']);expect(f.transaction).toHaveBeenCalledWith(expect.any(Function),{maxWait:2000,timeout:30000});
 const deadline=vi.mocked(f.tx.$executeRaw).mock.calls[0]![0] as unknown as TemplateStringsArray;
 const query=vi.mocked(f.tx.$queryRaw).mock.calls[0] as unknown as [TemplateStringsArray,Date,Date];
 expect(deadline.join('')).toContain("SET LOCAL statement_timeout = '25000ms'");
 expect(query[0].join('')).toMatch(/ORDER BY "expiresAt", id\s+LIMIT 1 FOR UPDATE SKIP LOCKED/);
 expect(query[0].join('')).toContain('DELETE FROM "DemoSession" AS session');expect(query[0].join('')).toContain('RETURNING session.id');expect(query.slice(1)).toEqual([now,now]);
});
it('returns an empty batch without extending expiry or retrying a currently locked backlog in the same call',async()=>{
 const f=fixture();f.tx.$queryRaw.mockResolvedValue([]);expect(await f.repository.cleanup(now)).toEqual([]);expect(f.tx.$queryRaw).toHaveBeenCalledOnce();
});
it('propagates a bounded cascade failure so transaction rollback is preserved and no deleted IDs are published',async()=>{
 const f=fixture(),failure=new Error('canceling statement due to statement timeout');f.tx.$queryRaw.mockRejectedValue(failure);
 await expect(f.repository.cleanup(now)).rejects.toBe(failure);expect(f.transaction).toHaveBeenCalledOnce();expect(f.tx.$executeRaw).toHaveBeenCalledOnce();
});
