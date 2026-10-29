export const fixtureIdentity = {fixtureVersion:'showcase-v3',catalogRevision:'catalog-v3'} as const;
export function fixtureSourceRevision(fixtureVersion:string):string {
  if(fixtureVersion==='showcase-v1'||fixtureVersion==='foundation-v1')return 'source-v1';
  if(fixtureVersion==='showcase-v2')return 'source-v2-travel-research-2026-10-29';
  if(fixtureVersion===fixtureIdentity.fixtureVersion)return 'source-v3-rich-inventory-2026-10-29';
  throw new RangeError('Unsupported source fixture version');
}
