import type { ProviderFarePolicy } from '@torob-ticket/domain';
import type { ClassChoice, Mode, ProviderCapabilities } from '@torob-ticket/contracts';
import { fixtureIdentity } from '../identity';
import { mockFarePolicies as legacyFarePolicies } from '../legacy-v1/catalog/providers';
import { mockFarePolicies as previousFarePolicies } from '../legacy-v2/catalog/providers';
export const classChoices: ClassChoice[] = [
  {code:'economy',mode:'flight',name:'اقتصادی'}, {code:'business',mode:'flight',name:'تجاری'},
  {code:'sleeper-4',mode:'train',name:'کوپه چهار تخته'}, {code:'seat',mode:'train',name:'صندلی (سالنی)'}, {code:'sleeper-6',mode:'train',name:'کوپه شش تخته'},
  {code:'vip',mode:'bus',name:'ویژه'}, {code:'standard',mode:'bus',name:'معمولی'},
];
const modes: Mode[][] = [['flight'],['flight','train'],['flight','bus'],['flight','train','bus'],['train','bus'],['train','bus']];
export const providers: ProviderCapabilities[] = modes.map((supported,index)=>({providerId:`demo-provider-0${index+1}`,name:`فروشنده نمونه ${index+1} (خیالی)`,fictional:true,modes:supported,scopes:['domestic','international'],classCodes:classChoices.filter(c=>supported.includes(c.mode)).map(c=>c.code),requiresChildAges:true,requiresInfantAges:true}));


/** Authored fictional category/stock rules, not claims about real carriers. Gross prices already cover these categories. */
export const mockFarePolicies: Record<string, ProviderFarePolicy> = Object.fromEntries(providers.map(provider => [provider.providerId, {
  revision: 'mock-fares-v3',
  modes: provider.modes,
  scopes: provider.scopes,
  classCodes: provider.classCodes,
  requiresChildAges: true,
  requiresInfantAges: true,
  childAgeRangeYears: { min: 2, max: 11 },
  infantAgeRangeMonths: { min: 0, max: 23 },
  sourceAgeBasis: 'category-counts',
  seatUnits: { adult: 1, child: 1, infant: 0 },
}]));

/** Historical sessions retain their exact original source applicability policy. */
export function farePoliciesForFixture(fixtureVersion:string):Record<string,ProviderFarePolicy> {
  if(fixtureVersion==='showcase-v1'||fixtureVersion==='foundation-v1')return structuredClone(legacyFarePolicies);
  if(fixtureVersion==='showcase-v2')return structuredClone(previousFarePolicies);
  if(fixtureVersion===fixtureIdentity.fixtureVersion)return structuredClone(mockFarePolicies);
  throw new RangeError('Unsupported fare-policy fixture version');
}
