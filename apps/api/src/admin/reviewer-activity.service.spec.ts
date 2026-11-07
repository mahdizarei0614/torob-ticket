import 'reflect-metadata';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {RepositoryError,reviewerActivityTemplateId} from '@torob-ticket/data-access';
import {ReviewerActivityService,reviewerActivityEnabled} from './reviewer-activity.service';
import type {SessionService} from '../sessions/session.service';
import type {SessionContext} from '../sessions/session-context';
import type {ProviderTrafficService} from './provider-traffic.service';

const mocks=vi.hoisted(()=>({ensure:vi.fn(),begin:vi.fn(),pending:vi.fn(),copy:vi.fn(),finish:vi.fn(),populate:vi.fn(),ready:vi.fn(),register:vi.fn()}));
vi.mock('@torob-ticket/data-access',async()=>{const actual=await vi.importActual<typeof import('@torob-ticket/data-access')>('@torob-ticket/data-access');return {...actual,ReviewerActivityRepository:class{ensureTemplate=mocks.ensure;begin=mocks.begin;pending=mocks.pending;copy=mocks.copy;finish=mocks.finish;}};});
const identity={fixtureVersion:'showcase-v3',catalogRevision:'catalog-v3',mappingRevision:'mapping-v1'},now=new Date('2026-11-07T08:00:00Z');
const context=(id:string)=>({sessionId:id,scope:{sessionId:id},info:identity} as SessionContext);
function service(){return new ReviewerActivityService({database:{},realClock:{now:()=>now},ensureReady:mocks.ready,registerWorkspaceInitializer:mocks.register} as unknown as SessionService,{populateScope:mocks.populate} as unknown as ProviderTrafficService);}
beforeEach(()=>{
 vi.resetAllMocks();vi.stubEnv('TOROBTICKET_REVIEWER_ACTIVITY','true');vi.stubEnv('TOROBTICKET_LOCAL_REVIEW','true');vi.stubEnv('TOROBTICKET_SSO_ORIGIN','http://127.0.0.1:4300');vi.stubEnv('TOROBTICKET_ADMIN_ORIGIN','http://127.0.0.1:4301');vi.stubEnv('TOROBTICKET_EXAMPLE_PROVIDER_ORIGIN','http://localhost:4310');
 mocks.ensure.mockResolvedValue({sessionId:'activity-template-workspace-owned'});mocks.pending.mockResolvedValue(true);mocks.copy.mockResolvedValue({status:'loaded'});mocks.register.mockReturnValue(()=>undefined);
});
afterEach(()=>vi.unstubAllEnvs());
describe('automatic reviewer activity',()=>{
 it.each(['off','nonloopback'])('does no initialization when %s',async kind=>{
  if(kind==='off')vi.stubEnv('TOROBTICKET_REVIEWER_ACTIVITY','false');else vi.stubEnv('TOROBTICKET_SSO_ORIGIN','https://example.com');
  expect(reviewerActivityEnabled()).toBe(false);const instance=service();await instance.onApplicationBootstrap();await instance.initialize(context('a'),true);expect(mocks.ensure).not.toHaveBeenCalled();expect(mocks.begin).not.toHaveBeenCalled();
 });
 it('prepares the default data before startup completes and registers fresh/resume metadata',async()=>{
  const instance=service();instance.onModuleInit();await instance.onApplicationBootstrap();expect(mocks.ready).toHaveBeenCalledOnce();expect(mocks.populate).toHaveBeenCalledWith({sessionId:'activity-template-workspace-owned'},identity);
  const initialize=mocks.register.mock.calls[0]![0];await initialize(context('a'),{fresh:true});expect(mocks.begin).toHaveBeenCalledWith({sessionId:'a'});expect(mocks.copy).toHaveBeenCalledWith({sessionId:'a'},{sessionId:'activity-template-workspace-owned'});
 });
 it('leaves existing workspaces untouched unless they have an owned pending setup',async()=>{
  mocks.pending.mockResolvedValue(false);await service().initialize(context('existing'),false);expect(mocks.begin).not.toHaveBeenCalled();expect(mocks.copy).not.toHaveBeenCalled();expect(mocks.ensure).not.toHaveBeenCalled();
 });
 it('shares preparation between simultaneous fresh reviewers but clones each private scope',async()=>{
  let release!:(value:{sessionId:string})=>void;mocks.ensure.mockReturnValue(new Promise(resolve=>{release=resolve;}));
  const instance=service(),both=Promise.all([instance.initialize(context('a'),true),instance.initialize(context('b'),true)]);
  await vi.waitFor(()=>expect(mocks.ensure).toHaveBeenCalledOnce());release({sessionId:'activity-template-workspace-owned'});await both;
  expect(mocks.populate).toHaveBeenCalledOnce();expect(mocks.copy.mock.calls.map(args=>args[0])).toEqual([{sessionId:'a'},{sessionId:'b'}]);
 });
 it('surfaces a failed clone and retries the owned pending setup without claiming empty success',async()=>{
  mocks.copy.mockRejectedValueOnce(new Error('interrupted'));const instance=service();await expect(instance.initialize(context('a'),true)).rejects.toThrow('interrupted');expect(mocks.finish).not.toHaveBeenCalled();
  await instance.initialize(context('a'),false);expect(mocks.begin).toHaveBeenCalledOnce();expect(mocks.finish).toHaveBeenCalledWith({sessionId:'a'},'ready');
 });
 it('preserves intervening outbound activity or custom pricing on a pending retry',async()=>{
  mocks.copy.mockRejectedValue(new RepositoryError('TRAFFIC_HISTORY_CONFLICT'));await service().initialize(context('a'),false);expect(mocks.finish).toHaveBeenCalledWith({sessionId:'a'},'skipped-existing-data');
 });
 it('changes the template at Tehran day/month midnight and when its immutable identity changes',()=>{
  const before=new Date('2026-10-22T20:29:59Z'),after=new Date('2026-10-22T20:30:00Z');
  expect(reviewerActivityTemplateId(identity,before)).not.toBe(reviewerActivityTemplateId(identity,after));
  expect(reviewerActivityTemplateId(identity,after)).not.toBe(reviewerActivityTemplateId({...identity,mappingRevision:'mapping-two'},after));
  expect(reviewerActivityTemplateId(identity,after)).toBe(reviewerActivityTemplateId(identity,new Date(after.getTime()+1000)));
  const viewerInfo={...identity,seed:888,anchorInstant:'2026-10-25T00:00:00Z',identity:{id:'private-person'}};
  expect(reviewerActivityTemplateId(viewerInfo,after)).toBe(reviewerActivityTemplateId(identity,after));
 });
});
