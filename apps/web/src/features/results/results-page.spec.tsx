import { fireEvent, render, screen } from '@testing-library/react';
import { act } from '@testing-library/react';
import { useReducer } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { ResultsList } from './results-page';
import { useResults } from './use-results';
import { createResultsState, resultsReducer } from './results-reducer';
import { group, observedAt, recovery } from './results-test-data';
import { catalog, query } from '../search/search-test-data';
vi.mock('./use-results',()=>({useResults:vi.fn()}));
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
it('a newly adopted later provider observation is current on the first render, even before the expiry tick state updates',()=>{
 const initialTime=Date.parse(observedAt);vi.spyOn(Date,'now').mockReturnValue(initialTime+5000);
 const later=group('later');later.eligibleQuotes[0]!.observedAt='2026-10-25T06:00:04.000Z';const value=recovery([later]);
 const state=resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:value});
 vi.mocked(useResults).mockReturnValue({state,dispatch:vi.fn(),now:initialTime,connectionError:false,stored:value});
 render(<ResultsList isCurrent={()=>true} generation="generation" searchId="search" query={query} catalog={catalog} refinementDisabled={false} draftChanged={false} onRefine={()=>undefined} onEdit={()=>undefined}/>);
 expect(screen.getByRole('button',{name:'انتخاب پیشنهاد'})).toBeEnabled();expect(screen.queryByText('اعتبار قیمت پایان یافته است؛ برای انتخاب دوباره جست‌وجو کنید.')).not.toBeInTheDocument();
});

it('obsolete already-rendered result callbacks emit no selection, pin, preview, adoption, edit or refinement',()=>{
 const time=Date.parse(observedAt)+5000;vi.spyOn(Date,'now').mockReturnValue(time);const value=recovery([group('a')]);let state=resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:value});state=resultsReducer(state,{type:'freeze'});state=resultsReducer(state,{type:'receive',recovery:recovery([group('b'),group('a')],2)});
 const dispatch=vi.fn(),pin=vi.fn(),preview=vi.fn(),selected=vi.fn(),edit=vi.fn(),refine=vi.fn();let current=true;vi.mocked(useResults).mockReturnValue({state,dispatch,now:time,connectionError:false,stored:value});
 render(<ResultsList isCurrent={()=>current} generation="generation" searchId="search" query={query} catalog={catalog} refinementDisabled={false} draftChanged={false} onRefine={refine} onEdit={edit} onPinItinerary={pin} onPreviewItinerary={preview} onSelectQuote={selected}/>);selected.mockClear();current=false;
 fireEvent.click(screen.getByRole('button',{name:'انتخاب پیشنهاد'}));fireEvent.mouseEnter(screen.getByRole('article'));fireEvent.focus(screen.getByRole('button',{name:'انتخاب پیشنهاد'}));fireEvent.click(screen.getByRole('button',{name:'اعمال نتایج تازه'}));fireEvent.click(screen.getByRole('button',{name:'ویرایش سفر'}));expect(dispatch).not.toHaveBeenCalled();expect(pin).not.toHaveBeenCalled();expect(preview).not.toHaveBeenCalled();expect(selected).not.toHaveBeenCalled();expect(edit).not.toHaveBeenCalled();expect(refine).not.toHaveBeenCalled();
});

it('a delayed adoption frame relinquishes scrolling immediately when controller ownership changes before React unmount',()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+5000);let current=true,top=100,nextFrame=0;const frames=new Map<number,FrameRequestCallback>();vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{frames.set(++nextFrame,callback);return nextFrame;});vi.stubGlobal('cancelAnimationFrame',(id:number)=>frames.delete(id));
 const scroll=vi.spyOn(window,'scrollBy').mockImplementation(()=>undefined);vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){return {x:0,y:top,top,bottom:top+300,left:0,right:500,width:500,height:300,toJSON:()=>({})};});
 const value=recovery([group('a')]);let initial=resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:value});initial=resultsReducer(initial,{type:'freeze'});initial=resultsReducer(initial,{type:'receive',recovery:recovery([group('b'),group('a')],2)});
 function useControlledResults(){const[state,dispatch]=useReducer(resultsReducer,initial);return{state,dispatch:(action:Parameters<typeof resultsReducer>[1])=>{if(action.type==='adopt')top=200;dispatch(action);},now:Date.now(),connectionError:false,stored:value};}
 vi.mocked(useResults).mockImplementation(useControlledResults);
 const view=render(<ResultsList isCurrent={()=>current} generation="generation" searchId="search" query={query} catalog={catalog} refinementDisabled={false} draftChanged={false} onRefine={()=>undefined} onEdit={()=>undefined}/>);
 fireEvent.click(screen.getByRole('button',{name:'اعمال نتایج تازه'}));expect(scroll).toHaveBeenCalledTimes(1);const before=scroll.mock.calls.length;current=false;top=300;act(()=>{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback(0));});expect(scroll).toHaveBeenCalledTimes(before);view.unmount();
});
it('obsolete entry and outward selection effects do not focus or scroll a restored screen',()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+5000);const scroll=vi.fn();HTMLElement.prototype.scrollIntoView=scroll;const value=recovery([group('a')]);const state=resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:value});const selected=vi.fn();vi.mocked(useResults).mockReturnValue({state,dispatch:vi.fn(),now:Date.now(),connectionError:false,stored:value});
 render(<ResultsList isCurrent={()=>false} generation="generation" searchId="search" query={query} catalog={catalog} refinementDisabled={false} draftChanged={false} enterResults onRefine={()=>undefined} onEdit={()=>undefined} onSelectQuote={selected}/>);expect(scroll).not.toHaveBeenCalled();expect(selected).not.toHaveBeenCalled();expect(screen.getByRole('heading',{name:'مقایسه پروازها'})).not.toHaveFocus();
});
