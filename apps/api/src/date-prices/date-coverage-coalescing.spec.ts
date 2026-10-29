import {afterEach,expect,it,vi} from 'vitest';
import {catalog,fixtureIdentity} from '@torob-ticket/fixtures';
import type {DatePriceQuery} from '@torob-ticket/contracts';
import type {DatePricePayload,DatePriceProjectionInput,DatePriceProjectionResult,DatePriceRepository} from '@torob-ticket/data-access';
import type {ProviderAdapter,ProviderContext,ProviderDateBatch} from '@torob-ticket/provider-adapters';
import type {SessionService} from '../sessions/session.service';
import type {SessionContext} from '../sessions/session-context';
import type {ProviderService} from '../providers/provider.service';
import {DatePriceService} from './date-price.service';
const query:DatePriceQuery={query:{mode:'flight',scope:'domestic',tripType:'one-way',originCityId:'tehran',destinationCityId:'mashhad',departureDate:'2026-11-01',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'},leg:'outbound',dates:['2026-11-01','2026-11-02'],clientGeneration:'thin-calendar'};
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return{promise,resolve};}
function harness(failedProvider?:string){
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
 const now=()=>new Date(),demoClock={now:()=>new Date('2026-10-29T00:00:00Z')};let done!:Promise<void>,controller!:AbortController;
 const owner:SessionContext={sessionId:'reviewer',scope:{sessionId:'reviewer'},demoClock,info:{...fixtureIdentity,seed:5151,anchorInstant:demoClock.now().toISOString(),scenario:'normal',scenarioRevision:'scenario-v1',mappingRevision:'mapping-v1',expiresAt:'2026-10-30T12:00:00Z',identity:null}};
 let payload:DatePricePayload;
 const repository={
  reconcileInterrupted:vi.fn(async()=>{}),
  admit:vi.fn(async()=>{payload={kind:'date-price-evidence',evidenceSearchId:'calendar',snapshot:{datePriceId:'calendar',clientGeneration:query.clientGeneration,query:structuredClone(query),cells:query.dates.map(date=>({date,status:'checking'})),status:'checking',pollCursor:'0',observedAt:now().toISOString()},frozen:{info:owner.info,mappings:[],overrides:[]},identity:{},coverageByDate:{},sequence:0};return{id:'calendar',created:true,payload:structuredClone(payload)};}),
  read:vi.fn(async()=>structuredClone(payload)),
  recordCoverage:vi.fn(async(_scope:unknown,_id:string,_now:Date,update:(value:DatePricePayload)=>void)=>{update(payload);payload.sequence++;payload.snapshot={...payload.snapshot,pollCursor:String(payload.sequence)};return structuredClone(payload);}),
  project:vi.fn(async(_scope:unknown,_id:string,_now:Date,update:(value:DatePricePayload)=>void,build:(value:DatePriceProjectionInput)=>DatePriceProjectionResult)=>{update(payload);const result=build({payload,offers:[],quotes:[]});payload.sequence++;payload.snapshot={...result.snapshot,pollCursor:String(payload.sequence)};return structuredClone(payload);}),
 };
 const sessions={realClock:{now},database:{},registerRecovery:()=>()=>{},registerController:(_owner:SessionContext,next:AbortController,nextDone:Promise<void>)=>{controller=next;done=nextDone;return()=>{};}} as unknown as SessionService;
 const providers={createContext:async(_owner:SessionContext,_id:string,signal:AbortSignal,deadline:Date):Promise<ProviderContext>=>({operationId:'op',...fixtureIdentity,seed:5151,scenario:'normal',scenarioRevision:'scenario-v1',mappingRevision:'mapping-v1',demoClock,realClock:{now},signal,deadline,catalog,aliases:[],overrides:{},traceSink:async()=>{}})} as unknown as ProviderService;
 const gates=new Map(['demo-provider-01','demo-provider-02','demo-provider-03','demo-provider-04'].map(id=>[id,deferred()]));
 const started:string[]=[];let active=0,maximumActive=0;
 const registry:ProviderAdapter[]=[...gates].map(([providerId,gate])=>({providerId,search:async()=>({providerId,status:'success',records:[]}),recheck:async()=>({providerId,status:'success',outcome:'unavailable'}),dateInventory:async(request):Promise<ProviderDateBatch>=>{started.push(providerId);active++;maximumActive=Math.max(maximumActive,active);await gate.promise;active--;return failedProvider===providerId?{providerId,status:'timeout',errorCode:'PROVIDER_TIMEOUT',dates:[]}:{providerId,status:'success',dates:request.dates.map(date=>({date,batch:{providerId,status:'success',records:[]}}))};}}));
 class TestService extends DatePriceService{override get repository(){return repository as unknown as DatePriceRepository;}}
 const service=new TestService(sessions,providers,registry);
 return{owner,repository,gates,started,service,get payload(){return payload;},get done(){return done;},get controller(){return controller;},get maximumActive(){return maximumActive;}};
}
afterEach(()=>{vi.useRealTimers();});
it('records thin progress, starts both later providers, and performs exactly one terminal pricing pass',async()=>{
 const f=harness();const initial=await f.service.startDatePrices(f.owner,query);await vi.advanceTimersByTimeAsync(0);
 expect(initial.cells.every(cell=>cell.status==='checking')).toBe(true);expect(f.started).toEqual(['demo-provider-01','demo-provider-02']);expect(f.repository.project).not.toHaveBeenCalled();
 f.gates.get('demo-provider-01')!.resolve();await vi.advanceTimersByTimeAsync(0);expect(f.started).toHaveLength(3);expect(f.repository.project).not.toHaveBeenCalled();expect(f.payload.snapshot.cells.every(cell=>cell.status==='checking')).toBe(true);expect(f.payload.coverageByDate['2026-11-01']!.successfulProviderIds).toEqual(['demo-provider-01']);
 f.gates.get('demo-provider-02')!.resolve();await vi.advanceTimersByTimeAsync(0);expect(f.started).toHaveLength(4);expect(f.repository.project).not.toHaveBeenCalled();
 f.gates.get('demo-provider-03')!.resolve();f.gates.get('demo-provider-04')!.resolve();await f.done;
 expect(f.repository.recordCoverage).toHaveBeenCalledTimes(5);expect(f.repository.project).toHaveBeenCalledOnce();expect(f.maximumActive).toBe(2);expect(f.payload.snapshot.status).toBe('complete');expect(f.payload.snapshot.cells.every(cell=>cell.status==='no-match')).toBe(true);expect(f.payload.providerEvidence&&Object.keys(f.payload.providerEvidence)).toHaveLength(4);expect(vi.getTimerCount()).toBe(0);await f.service.onModuleDestroy();
});
it('keeps terminal collection failures unavailable instead of turning empty incomplete coverage into no-match',async()=>{
 const f=harness('demo-provider-02');await f.service.startDatePrices(f.owner,query);for(const gate of f.gates.values())gate.resolve();await f.done;
 expect(f.repository.project).toHaveBeenCalledOnce();expect(f.payload.snapshot.cells.every(cell=>cell.status==='unavailable'&&cell.reason==='retrieval-failed')).toBe(true);expect(f.payload.coverageByDate['2026-11-01']!.failedProviderIds).toEqual(['demo-provider-02']);expect(vi.getTimerCount()).toBe(0);await f.service.onModuleDestroy();
});
it('never promotes late adapter success after abort or starts a later provider wave',async()=>{
 const f=harness();await f.service.startDatePrices(f.owner,query);await vi.advanceTimersByTimeAsync(0);f.controller.abort('deadline');for(const gate of f.gates.values())gate.resolve();await f.done;
 expect(f.started).toHaveLength(2);expect(f.repository.project).toHaveBeenCalledOnce();expect(f.payload.coverageByDate['2026-11-01']!.successfulProviderIds).toEqual([]);expect(f.payload.coverageByDate['2026-11-01']!.failedProviderIds.sort()).toEqual([...f.gates.keys()].sort());expect(f.payload.snapshot.cells.every(cell=>cell.status==='unavailable')).toBe(true);expect(vi.getTimerCount()).toBe(0);await f.service.onModuleDestroy();
});
