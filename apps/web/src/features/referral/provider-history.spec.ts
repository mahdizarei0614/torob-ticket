import {afterEach,it,expect} from 'vitest';
import {retainComparisonHistory,clearComparisonHistory,skipProviderPop} from './provider-history';
afterEach(clearComparisonHistory);
it('skips only provider transitions and the exact retained comparison entry',()=>{
 retainComparisonHistory('comparison-key','?q=retained');expect(skipProviderPop('/provider-demo/r','','provider-key')).toBe(true);expect(skipProviderPop('/','?q=retained','comparison-key')).toBe(true);
 expect(skipProviderPop('/','?q=retained','another-entry')).toBe(false);expect(skipProviderPop('/','?q=other','comparison-key')).toBe(false);
});
it('different real comparison history still restores and cannot inherit a former provider guard',()=>{
 retainComparisonHistory('old','?q=old');expect(skipProviderPop('/','?q=new','new')).toBe(false);expect(skipProviderPop('/','?q=old','old')).toBe(false);
});
