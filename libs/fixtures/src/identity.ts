export const fixtureIdentity = {fixtureVersion:'showcase-v2',catalogRevision:'catalog-v2'} as const;
export function fixtureSourceRevision(fixtureVersion:string):string {
  if(fixtureVersion==='showcase-v1'||fixtureVersion==='foundation-v1')return'source-v1';
  if(fixtureVersion===fixtureIdentity.fixtureVersion)return'source-v2-travel-research-2026-10-29';
  throw new RangeError('Unsupported source fixture version');
}
