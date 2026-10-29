import {expect,it,vi} from 'vitest';
import type {SearchSnapshot} from '@torob-ticket/contracts';
import type {Prisma,PrismaClient} from './generated/client';
import {SearchRepository} from './search-repository';
const snapshot:SearchSnapshot={searchId:'search',query:{mode:'flight',scope:'domestic',originCityId:'a',destinationCityId:'b',tripType:'one-way',departureDate:'2026-11-01',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'},clientGeneration:'generation',status:'collecting',groups:[],providerStatuses:[],coverage:{expectedProviderIds:[],successfulProviderIds:[],failedProviderIds:[],pendingProviderIds:[],complete:false},observedAt:'2026-10-29T12:00:00Z'};
function harness(){
 const tx={$queryRaw:vi.fn(async()=>[{id:'reviewer'}]),datePriceRun:{findUnique:vi.fn(async()=>null as unknown)},searchRun:{findUnique:vi.fn(async()=>({snapshot}as unknown))},searchEventRecord:{aggregate:vi.fn(async()=>({_max:{sequence:23 as number|null}})),findMany:vi.fn(async()=>[{payload:{corruptHistory:true}}])}};
 const transaction=vi.fn(async(work:(tx:Prisma.TransactionClient)=>Promise<unknown>)=>work(tx as unknown as Prisma.TransactionClient));
 return{tx,transaction,repository:new SearchRepository({$transaction:transaction}as unknown as PrismaClient)};
}
it('reads the validated current snapshot and atomic cursor without fetching or parsing discarded history',async()=>{
 const f=harness(),result=await f.repository.readSnapshot({sessionId:'reviewer'},'search');expect(result).toEqual({snapshot,sequence:23});expect(Object.keys(result).sort()).toEqual(['sequence','snapshot']);expect(f.tx.searchEventRecord.findMany).not.toHaveBeenCalled();expect(f.tx.$queryRaw).toHaveBeenCalledOnce();expect(f.tx.searchEventRecord.aggregate).toHaveBeenCalledWith({where:{sessionId:'reviewer',searchId:'search'},_max:{sequence:true}});expect(f.transaction).toHaveBeenCalledOnce();
 await expect(f.repository.read({sessionId:'reviewer'},'search')).rejects.toThrow();expect(f.tx.searchEventRecord.findMany).toHaveBeenCalledOnce();
});
it('retains the existing bounded ordered after-cursor replay path and event validation',async()=>{
 const f=harness(),event={searchId:'search',clientGeneration:'generation',sequence:18,type:'snapshot' as const,payload:{...snapshot,observedAt:'2026-10-29T11:00:00Z'}};f.tx.searchEventRecord.findMany.mockResolvedValue([{payload:event}] as never);
 const result=await f.repository.read({sessionId:'reviewer'},'search',17);expect(result).toEqual({snapshot,sequence:23,events:[event]});expect(f.tx.searchEventRecord.findMany).toHaveBeenCalledWith({where:{sessionId:'reviewer',searchId:'search',sequence:{gt:17}},orderBy:{sequence:'asc'},take:50});
});
it.each(['internal-date','internal-referral','missing-search','missing-session'] as const)('preserves the same scoped comparison-run guard for %s',async cause=>{
 const f=harness();if(cause==='internal-date')f.tx.datePriceRun.findUnique.mockResolvedValue({id:'search'});
 if(cause==='internal-referral')f.tx.searchRun.findUnique.mockResolvedValue({snapshot:{kind:'referral-recheck'}});
 if(cause==='missing-search')f.tx.searchRun.findUnique.mockResolvedValue(null);
 if(cause==='missing-session')f.tx.$queryRaw.mockResolvedValue([]);
 for(const read of [()=>f.repository.readSnapshot({sessionId:'reviewer'},'search'),()=>f.repository.read({sessionId:'reviewer'},'search')])await expect(read()).rejects.toMatchObject({code:cause==='missing-session'?'SESSION_EXPIRED':'NOT_FOUND'});
 expect(f.tx.searchEventRecord.findMany).not.toHaveBeenCalled();expect(f.tx.searchEventRecord.aggregate).not.toHaveBeenCalled();
});
it('returns cursorzero for an empty ledger without weakening snapshot validation',async()=>{
 const f=harness();f.tx.searchEventRecord.aggregate.mockResolvedValue({_max:{sequence:null}});expect((await f.repository.readSnapshot({sessionId:'reviewer'},'search')).sequence).toBe(0);
 f.tx.searchRun.findUnique.mockResolvedValue({snapshot:{invalid:true}});await expect(f.repository.readSnapshot({sessionId:'reviewer'},'search')).rejects.toThrow();expect(f.tx.searchEventRecord.findMany).not.toHaveBeenCalled();
});
