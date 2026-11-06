import {mintTrafficVisitor,trafficVisitorCookieName} from './traffic-visitor';
import { describe, expect, it, vi } from 'vitest';
import { RepositoryError, type SessionRecord, type SessionRepository,type PrismaClient } from '@torob-ticket/data-access';
import { SystemRealClock } from '../common/clocks';
import { SessionService } from './session.service';
const token = 'a'.repeat(43),secret='v'.repeat(43);
const visitor=mintTrafficVisitor('owner',secret),browserCookie='torob_demo='+token+'; '+trafficVisitorCookieName('owner')+'='+visitor.value;
const row = { id: 'owner', trafficVisitorSecret:secret, seed: 28n, anchorInstant: new Date('2026-10-26T06:00:00Z'), scenario: 'normal', scenarioRevision: 'scenario-v1', fixtureVersion: 'showcase-v1', mappingRevision: 'mapping-v1', expiresAt: new Date('2026-10-27T06:00:00Z'), fixture: { catalogRevision: 'catalog-v1' }, identity: null } as unknown as SessionRecord;
function setup(expired = false) {
  const service = new SessionService(new SystemRealClock());
  vi.spyOn(service, 'ensureReady').mockResolvedValue(undefined);
  const repository = { resolveAndTouch: expired ? vi.fn().mockRejectedValue(new RepositoryError('SESSION_EXPIRED')) : vi.fn().mockResolvedValue(row), create: vi.fn().mockResolvedValue({ ...row, id: 'replacement' }) };
  vi.spyOn(service, 'repository', 'get').mockReturnValue(repository as unknown as SessionRepository);
  const tx={$queryRaw:vi.fn().mockResolvedValue([{id:'owner'}]),demoSession:{findUniqueOrThrow:vi.fn().mockImplementation(({where}:{where:{id:string}})=>Promise.resolve({...row,id:where.id}))}};
  vi.spyOn(service,'database','get').mockReturnValue({$transaction:(work:(value:typeof tx)=>unknown)=>work(tx)} as unknown as PrismaClient);
  const response = { setHeader: vi.fn() };
  return { service, repository, response };
}
describe('credential response ownership', () => {
  it('never reissues a captured token on an ordinary authenticated response', async () => {
    const { service, response } = setup();
    const value = await service.authenticate({ headers: { cookie: 'torob_demo=' + token } }, response);
    expect(value.sessionId).toBe('owner'); expect(response.setHeader.mock.calls.length).toBe(0);
  });
  it('does not clear a potentially newer browser cookie on an expired or malformed ordinary request', async () => {
    const { service, response } = setup(true);
    for (const cookie of ['torob_demo=' + token, 'torob_demo=bad', 'torob_demo=' + token + '; torob_demo=' + token]) await expect(service.authenticate({ headers: { cookie } }, response)).rejects.toMatchObject({ status: 401 });
    expect(response.setHeader.mock.calls.length).toBe(0);
  });
  it('does not reissue an existing credential when an explicit bootstrap resumes it', async () => {
    const { service, response, repository } = setup();
    expect(await service.createOrResume({}, { headers: { cookie: browserCookie } }, response)).toMatchObject({ seed: 28 });
    expect(repository.create).not.toHaveBeenCalled(); expect(response.setHeader.mock.calls.length).toBe(0);
  });
  it.each(['torob_demo=bad','torob_demo='+token+'; torob_demo='+token])('allows deliberate bootstrap to replace invalid credential syntax',async cookie=>{
    const {service,response,repository}=setup();await service.createOrResume({},{headers:{cookie}},response);
    expect(repository.resolveAndTouch).not.toHaveBeenCalled();expect(repository.create).toHaveBeenCalledTimes(1);expect(response.setHeader.mock.calls.length).toBe(1);
  });
  it('replaces an expired credential only when bootstrap is deliberately requested', async () => {
    const { service, response, repository } = setup(true);
    expect(await service.createOrResume({}, { headers: { cookie: browserCookie } }, response)).toMatchObject({ seed: 28 });
    expect(repository.create).toHaveBeenCalledTimes(1); expect(response.setHeader.mock.calls.length).toBe(1);
    const value = String(response.setHeader.mock.calls[0]![1]);
    expect(value.includes('HttpOnly')).toBe(true); expect(value.includes('SameSite=Strict')).toBe(true); expect(value.includes('Max-Age=')).toBe(false);
  });
  it('runs registered workspace initialization only on explicit bootstrap, after resolving the session', async () => {
    const {service,response,repository}=setup();
    const initialize=vi.fn(async(context:{sessionId:string})=>{expect(repository.resolveAndTouch).toHaveBeenCalled();expect(context.sessionId).toBe('owner');});
    const remove=service.registerWorkspaceInitializer(initialize);
    await service.authenticate({headers:{cookie:browserCookie}},response);expect(initialize).not.toHaveBeenCalled();
    await service.createOrResume({},{headers:{cookie:browserCookie}},response);expect(initialize).toHaveBeenCalledTimes(1);expect(response.setHeader).not.toHaveBeenCalled();
    remove();await service.createOrResume({},{headers:{cookie:browserCookie}},response);expect(initialize).toHaveBeenCalledTimes(1);
  });

});
