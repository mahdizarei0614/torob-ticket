import {expect,it,vi} from 'vitest';
import type {ProviderContextSnapshot,SearchRepository} from '@torob-ticket/data-access';
import {activeTransportSourceRevision,fixtureIdentity,fixtureSourceRevision,DIRECTIONAL_TRANSPORT_SOURCE_REVISION} from '@torob-ticket/fixtures';
import type {SessionContext} from '../sessions/session-context';
import {ProviderService} from './provider.service';
// This isolated context-selection check does not connect to or mutate a database.
vi.mock('@torob-ticket/data-access',()=>({
 SearchRepository:class {appendNormalizationEvidence(){}appendNormalizationEvidenceBatch(){}},
 RepositoryError:class extends Error {constructor(readonly code:string){super(code);}},
}));
const info={...fixtureIdentity,seed:6161,anchorInstant:'2026-10-29T00:00:00Z',scenario:'normal' as const,scenarioRevision:'scenario-v1',mappingRevision:'mapping-v1',expiresAt:'2026-10-31T00:00:00Z',identity:null};
const frozen:ProviderContextSnapshot={info,mappings:[],overrides:[]};
const owner:SessionContext={sessionId:'owner',scope:{sessionId:'owner'},info,demoClock:{now:()=>new Date(info.anchorInstant)}};
it('new searches use the active source for the same existing session; old frozen contexts retain the original source',async()=>{
 const read=vi.fn(async()=>structuredClone(frozen));
 const repository={providerContextSnapshot:read} as unknown as SearchRepository;
 const service=new ProviderService(()=>repository,{now:()=>new Date('2026-10-30T00:00:00Z')});
 const create=(snapshot?:ProviderContextSnapshot,sources?:Record<string,string>)=>service.createContext(owner,'search',new AbortController().signal,new Date('2026-10-30T00:00:05Z'),snapshot,sources);
 const active=await create();expect(Object.values(active.sourceRevisions!)).toEqual(Array(6).fill(activeTransportSourceRevision(info.fixtureVersion)));
 const old=await create(frozen);expect(Object.values(old.sourceRevisions!)).toEqual(Array(6).fill(fixtureSourceRevision('showcase-v3')));
 const dateSources=Object.fromEntries(Object.keys(active.sourceRevisions!).map(id=>[id,activeTransportSourceRevision(info.fixtureVersion)]));
 const dateContext=await create(frozen,dateSources);expect(dateContext.sourceRevisions).toEqual(active.sourceRevisions);
 const recheck=await create(frozen,{'demo-provider-01':fixtureSourceRevision('showcase-v3')});expect(recheck.sourceRevisions?.['demo-provider-01']).toBe(fixtureSourceRevision('showcase-v3'));
 const newRecheck=await create(frozen,{'demo-provider-01':DIRECTIONAL_TRANSPORT_SOURCE_REVISION});expect(newRecheck.sourceRevisions?.['demo-provider-01']).toBe(DIRECTIONAL_TRANSPORT_SOURCE_REVISION);
 const currentRecheck=await create(frozen,{'demo-provider-01':activeTransportSourceRevision(info.fixtureVersion)});expect(currentRecheck.sourceRevisions?.['demo-provider-01']).toBe(activeTransportSourceRevision(info.fixtureVersion));
 expect(Object.isFrozen(active.sourceRevisions)).toBe(true);expect(owner.info).toEqual(info);expect(read).toHaveBeenCalledTimes(1);
});
it('never applies the current source to immutable older fixture roots',async()=>{
 const infoV2={...info,fixtureVersion:'showcase-v2',catalogRevision:'catalog-v2'};
 const legacy={...owner,info:infoV2};const snapshot={info:infoV2,mappings:[],overrides:[]};
 const repository={providerContextSnapshot:async()=>snapshot} as unknown as SearchRepository;
 const c=await new ProviderService(()=>repository,{now:()=>new Date('2026-10-30T00:00:00Z')}).createContext(legacy,'old-root',new AbortController().signal,new Date('2026-10-30T00:00:05Z'));
 expect(new Set(Object.values(c.sourceRevisions!))).toEqual(new Set([fixtureSourceRevision('showcase-v2')]));
});
