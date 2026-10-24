import type { DemoScenario } from '@torob-ticket/contracts';
export interface ScenarioSettings { delaysMs: readonly number[]; timeoutMs:number; searchDeadlineMs:number; maxConcurrentProviders:number; recheck:'unchanged'|'price-change'|'sold-out'; }
const normal: ScenarioSettings = {delaysMs:[150,350,550,800,1000,1200],timeoutMs:3500,searchDeadlineMs:5000,maxConcurrentProviders:2,recheck:'unchanged'};
export const scenarios: Record<DemoScenario,ScenarioSettings> = {
  normal, 'slow-provider':{...normal,delaysMs:[150,350,550,2400,1000,1200]},
  'provider-timeout':{...normal,delaysMs:[150,350,550,4000,1000,1200]},
  'price-change':{...normal,recheck:'price-change'}, 'sold-out':{...normal,recheck:'sold-out'},
  'conflicting-data':normal,'no-eligible-results':normal,
};
