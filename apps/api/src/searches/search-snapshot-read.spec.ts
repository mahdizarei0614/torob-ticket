import {expect,it,vi} from 'vitest';
import {SearchSnapshotSchema,type SearchSnapshot} from '@torob-ticket/contracts';
import type {SearchRepository} from '@torob-ticket/data-access';
import type {SessionService} from '../sessions/session.service';
import type {ProviderService} from '../providers/provider.service';
import type {SessionContext} from '../sessions/session-context';
import {SearchService} from './search.service';
const snapshot=SearchSnapshotSchema.parse({searchId:'search',query:{mode:'flight',scope:'domestic',originCityId:'a',destinationCityId:'b',tripType:'one-way',departureDate:'2026-11-01',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'},clientGeneration:'generation',status:'collecting',groups:[],providerStatuses:[],coverage:{expectedProviderIds:[],successfulProviderIds:[],failedProviderIds:[],pendingProviderIds:[],complete:false},observedAt:'2026-10-29T12:00:00Z'});
it('uses snapshot-only polling while the public replay method still requests bounded event history',async()=>{
 const repository={readSnapshot:vi.fn(async()=>({snapshot,sequence:23})),read:vi.fn(async()=>({snapshot,sequence:23,events:[]}))};
 class TestService extends SearchService{override get repository(){return repository as unknown as SearchRepository;}}
 const sessions={registerRecovery:()=>()=>{}}as unknown as SessionService,service=new TestService(sessions,{}as ProviderService),owner={sessionId:'reviewer',scope:{sessionId:'reviewer'}}as SessionContext;
 expect(await service.getSearch(owner,'search')).toEqual({snapshot,sequence:23});expect(repository.readSnapshot).toHaveBeenCalledWith(owner.scope,'search');expect(repository.read).not.toHaveBeenCalled();
 expect(await service.readSearch(owner,'search',17)).toEqual({snapshot,sequence:23,events:[]});expect(repository.read).toHaveBeenCalledWith(owner.scope,'search',17);await service.onModuleDestroy();
});
import {catalog,fixtureIdentity} from '@torob-ticket/fixtures';
import type {ProviderAdapter,ProviderContext} from '@torob-ticket/provider-adapters';
it('loads an adapter query through snapshot-only reads without touching replay history',async()=>{
 let current:SearchSnapshot=snapshot,done!:Promise<void>;const now=()=>new Date('2026-10-29T12:00:00Z');
 const repository={create:vi.fn(async(_scope:unknown,input:{snapshot:SearchSnapshot})=>{current=structuredClone(input.snapshot);}),freezeContext:vi.fn(async()=>{}),readSnapshot:vi.fn(async()=>({snapshot:structuredClone(current),sequence:1})),read:vi.fn(async()=>{throw new Error('history should not be read');}),project:vi.fn(async(_scope:unknown,_id:string,_now:Date,build:(state:{previous:SearchSnapshot;offers:[];quotes:[]})=>{snapshot:SearchSnapshot},provider?:{providerId:string;status:SearchSnapshot['providerStatuses'][number]['status'];offerCount:number})=>{if(provider)current={...current,providerStatuses:current.providerStatuses.map(row=>row.providerId===provider.providerId?provider:row)};current=build({previous:current,offers:[],quotes:[]}).snapshot;return current;})};
 const sessions={realClock:{now},registerRecovery:()=>()=>{},registerController:(_owner:unknown,_controller:AbortController,operation:Promise<void>)=>{done=operation;return()=>{};}}as unknown as SessionService;
 const context:ProviderContext={operationId:'operation',...fixtureIdentity,seed:5151,scenario:'normal',scenarioRevision:'scenario-v1',mappingRevision:'mapping-v1',demoClock:{now},realClock:{now},signal:new AbortController().signal,deadline:new Date(now().getTime()+5000),catalog,aliases:[],overrides:{},traceSink:async()=>{}};
 const adapter:ProviderAdapter={providerId:'demo-provider-01',search:vi.fn(async()=>({providerId:'demo-provider-01',status:'success' as const,records:[]})),recheck:async()=>({providerId:'demo-provider-01',status:'success',outcome:'unavailable'}),dateInventory:async()=>({providerId:'demo-provider-01',status:'success',dates:[]})};
 class TestService extends SearchService{override get repository(){return repository as unknown as SearchRepository;}}
 const providers={createContext:async()=>context}as unknown as ProviderService,service=new TestService(sessions,providers,[adapter]),owner={sessionId:'reviewer',scope:{sessionId:'reviewer'}}as SessionContext;
 await service.startSearch(owner,{query:{...snapshot.query,filters:{providerIds:['demo-provider-01']}},clientGeneration:'adapter-snapshot'});await done;
 expect(adapter.search).toHaveBeenCalledOnce();expect(repository.readSnapshot).toHaveBeenCalledTimes(2);expect(repository.read).not.toHaveBeenCalled();expect(current.status).toBe('empty');await service.onModuleDestroy();
});
