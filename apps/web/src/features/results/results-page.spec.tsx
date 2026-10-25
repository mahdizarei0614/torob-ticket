import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ResultsList } from './results-page';
import { useResults } from './use-results';
import { createResultsState, resultsReducer } from './results-reducer';
import { group, observedAt, recovery } from './results-test-data';
import { catalog, query } from '../search/search-test-data';
vi.mock('./use-results',()=>({useResults:vi.fn()}));
afterEach(()=>vi.restoreAllMocks());
it('a newly adopted later provider observation is current on the first render, even before the expiry tick state updates',()=>{
 const initialTime=Date.parse(observedAt);vi.spyOn(Date,'now').mockReturnValue(initialTime+5000);
 const later=group('later');later.eligibleQuotes[0]!.observedAt='2026-10-25T06:00:04.000Z';const value=recovery([later]);
 const state=resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:value});
 vi.mocked(useResults).mockReturnValue({state,dispatch:vi.fn(),now:initialTime,connectionError:false,stored:value});
 render(<ResultsList generation="generation" searchId="search" query={query} catalog={catalog} refinementDisabled={false} draftChanged={false} onRefine={()=>undefined} onEdit={()=>undefined}/>);
 expect(screen.getByRole('button',{name:'انتخاب پیشنهاد'})).toBeEnabled();expect(screen.queryByText('اعتبار قیمت پایان یافته است؛ برای انتخاب دوباره جست‌وجو کنید.')).not.toBeInTheDocument();
});
