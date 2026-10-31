import { fireEvent, render, screen, within } from '@testing-library/react';
import { act } from '@testing-library/react';
import { useReducer } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import {MotionPolicyProvider} from '@torob-ticket/ui';
import {createMapState,mapReducer,mapView} from '../map/map-state';
import { ResultsList, ResultsPage, type ResultsPageProps } from './results-page';
import { useResults } from './use-results';
import { createResultsState, resultsReducer, type ResultsAction, type ResultsState } from './results-reducer';
import { group, observedAt, recovery } from './results-test-data';
import { catalog, query } from '../search/search-test-data';
import { priceCardId } from './price-cards';
vi.mock('./use-results',()=>({useResults:vi.fn()}));
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('keeps edited-trip results readable but disables representative/provider choices and continuation',()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+5000);const item=group('a'),value=recovery([item]);
 let state=resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:value});
 state=resultsReducer(state,{type:'select',selection:{groupId:'a',quoteId:item.eligibleQuotes[0]!.quoteId,version:1},now:Date.now()});
 const selected=vi.fn(),pin=vi.fn(),preview=vi.fn(),dispatch=vi.fn();
 vi.mocked(useResults).mockReturnValue({state,dispatch,now:Date.now(),connectionError:false,connectionState:'settled',error:undefined,retryRead:vi.fn(),stored:value});
 render(<ResultsList isCurrent={()=>true} generation="generation" searchId="search" query={query} catalog={catalog} refinementDisabled draftChanged onRefine={()=>undefined} onEdit={()=>undefined} onSelectQuote={selected} onPinItinerary={pin} onPreviewItinerary={preview} selectedAction={{quoteId:item.eligibleQuotes[0]!.quoteId,node:<button>continue old flight</button>}}/>);
 expect(screen.getByRole('heading',{name:/مقایسه پروازها/})).toBeVisible();expect(screen.getByRole('button',{name:'انتخاب پیشنهاد'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'جزئیات سفر'}));expect(screen.queryByRole('button',{name:'پیشنهاد انتخاب‌شده'})).not.toBeInTheDocument();expect(screen.getByText('بار همراه: نامشخص')).toBeVisible();
 expect(screen.queryByRole('button',{name:'continue old flight'})).not.toBeInTheDocument();expect(screen.queryByText(/ابتدا سفر ویرایش‌شده را جست‌وجو کنید/)).not.toBeInTheDocument();
 expect(screen.getByText('اعتبار قیمت پایان یافته',{exact:false})).toBeVisible();expect(document.querySelector('[data-invalid-price]')).toHaveAttribute('data-invalid-price','changed-intent');
 fireEvent.mouseEnter(screen.getByRole('article'));expect(pin).not.toHaveBeenCalled();expect(preview).not.toHaveBeenCalled();expect(selected).not.toHaveBeenCalled();
});
it('an already-rendered result cannot select after synchronous draft invalidation before React rerenders',()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+5000);const value=recovery([group('a')]);const state=resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:value});
 let selectionCurrent=true;const selected=vi.fn(),pin=vi.fn(),preview=vi.fn(),dispatch=vi.fn();
 vi.mocked(useResults).mockReturnValue({state,dispatch,now:Date.now(),connectionError:false,connectionState:'settled',error:undefined,retryRead:vi.fn(),stored:value});
 render(<ResultsList isCurrent={()=>true} isSelectionCurrent={()=>selectionCurrent} generation="generation" searchId="search" query={query} catalog={catalog} refinementDisabled={false} draftChanged={false} onRefine={()=>undefined} onEdit={()=>undefined} onSelectQuote={selected} onPinItinerary={pin} onPreviewItinerary={preview}/>);
 selected.mockClear();selectionCurrent=false;
 fireEvent.click(screen.getByRole('button',{name:'انتخاب پیشنهاد'}));fireEvent.mouseEnter(screen.getByRole('article'));
 expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({type:'select'}));expect(pin).not.toHaveBeenCalled();expect(preview).not.toHaveBeenCalled();expect(selected).not.toHaveBeenCalled();
});
it('a newly adopted later provider observation is current on the first render, even before the expiry tick state updates',()=>{
 const initialTime=Date.parse(observedAt);vi.spyOn(Date,'now').mockReturnValue(initialTime+5000);
 const later=group('later');later.eligibleQuotes[0]!.observedAt='2026-10-25T06:00:04.000Z';const value=recovery([later]);
 const state=resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:value});
 vi.mocked(useResults).mockReturnValue({state,dispatch:vi.fn(),now:initialTime,connectionError:false,connectionState:'settled' as const,error:undefined,retryRead:vi.fn(),stored:value});
 render(<ResultsList isCurrent={()=>true} generation="generation" searchId="search" query={query} catalog={catalog} refinementDisabled={false} draftChanged={false} onRefine={()=>undefined} onEdit={()=>undefined}/>);
 expect(screen.getByRole('button',{name:'انتخاب پیشنهاد'})).toBeEnabled();expect(document.querySelector('[data-invalid-price]')).toBeNull();
});

it('obsolete already-rendered result callbacks emit no selection, pin, preview, adoption, edit or refinement',()=>{
 const time=Date.parse(observedAt)+5000;vi.spyOn(Date,'now').mockReturnValue(time);const value=recovery([group('a')]);let state=resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:value});state=resultsReducer(state,{type:'freeze'});state=resultsReducer(state,{type:'receive',recovery:recovery([group('b'),group('a')],2)});
 const dispatch=vi.fn(),pin=vi.fn(),preview=vi.fn(),selected=vi.fn(),edit=vi.fn(),refine=vi.fn();let current=true;vi.mocked(useResults).mockReturnValue({state,dispatch,now:time,connectionError:false,connectionState:'settled' as const,error:undefined,retryRead:vi.fn(),stored:value});
 render(<ResultsList isCurrent={()=>current} generation="generation" searchId="search" query={query} catalog={catalog} refinementDisabled={false} draftChanged={false} onRefine={refine} onEdit={edit} onPinItinerary={pin} onPreviewItinerary={preview} onSelectQuote={selected}/>);selected.mockClear();current=false;
 fireEvent.click(screen.getByRole('button',{name:'انتخاب پیشنهاد'}));fireEvent.mouseEnter(screen.getByRole('article'));fireEvent.focus(screen.getByRole('button',{name:'انتخاب پیشنهاد'}));fireEvent.click(screen.getByRole('button',{name:'اعمال نتایج تازه'}));expect(dispatch).not.toHaveBeenCalled();expect(pin).not.toHaveBeenCalled();expect(preview).not.toHaveBeenCalled();expect(selected).not.toHaveBeenCalled();expect(edit).not.toHaveBeenCalled();expect(refine).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'ویرایش سفر'})).not.toBeInTheDocument();
});

it('a delayed adoption frame relinquishes scrolling immediately when controller ownership changes before React unmount',()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+5000);let current=true,top=100,nextFrame=0;const frames=new Map<number,FrameRequestCallback>();vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{frames.set(++nextFrame,callback);return nextFrame;});vi.stubGlobal('cancelAnimationFrame',(id:number)=>frames.delete(id));
 const scroll=vi.spyOn(window,'scrollBy').mockImplementation(()=>undefined);vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){return {x:0,y:top,top,bottom:top+300,left:0,right:500,width:500,height:300,toJSON:()=>({})};});
 const value=recovery([group('a')]);let initial=resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:value});initial=resultsReducer(initial,{type:'freeze'});initial=resultsReducer(initial,{type:'receive',recovery:recovery([group('b'),group('a')],2)});
 function useControlledResults(){const[state,dispatch]=useReducer(resultsReducer,initial);return{state,dispatch:(action:Parameters<typeof resultsReducer>[1])=>{if(action.type==='adopt')top=200;dispatch(action);},now:Date.now(),connectionError:false,connectionState:'settled' as const,error:undefined,retryRead:vi.fn(),stored:value};}
 vi.mocked(useResults).mockImplementation(useControlledResults);
 const view=render(<ResultsList isCurrent={()=>current} generation="generation" searchId="search" query={query} catalog={catalog} refinementDisabled={false} draftChanged={false} onRefine={()=>undefined} onEdit={()=>undefined}/>);
 fireEvent.click(screen.getByRole('button',{name:'اعمال نتایج تازه'}));expect(scroll).toHaveBeenCalledTimes(1);const before=scroll.mock.calls.length;current=false;top=300;act(()=>{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback(0));});expect(scroll).toHaveBeenCalledTimes(before);view.unmount();
});
it('obsolete entry and outward selection effects do not focus or scroll a restored screen',()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+5000);const scroll=vi.fn();HTMLElement.prototype.scrollIntoView=scroll;const value=recovery([group('a')]);const state=resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:value});const selected=vi.fn();vi.mocked(useResults).mockReturnValue({state,dispatch:vi.fn(),now:Date.now(),connectionError:false,connectionState:'settled' as const,error:undefined,retryRead:vi.fn(),stored:value});
 render(<ResultsList isCurrent={()=>false} generation="generation" searchId="search" query={query} catalog={catalog} refinementDisabled={false} draftChanged={false} enterResults onRefine={()=>undefined} onEdit={()=>undefined} onSelectQuote={selected}/>);expect(scroll).not.toHaveBeenCalled();expect(selected).not.toHaveBeenCalled();expect(screen.getByRole('heading',{name:/مقایسه پروازها/})).not.toHaveFocus();
});

it('the actual list forwards hover/focus ownership and restores focused A after leaving B',()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+1000);const owner={generation:'generation',searchId:'search'};const value=recovery([group('a'),group('b')]);const state=resultsReducer(createResultsState(owner.generation,owner.searchId),{type:'receive',recovery:value});vi.mocked(useResults).mockReturnValue({state,dispatch:vi.fn(),now:Date.now(),connectionError:false,connectionState:'settled' as const,error:undefined,retryRead:vi.fn(),stored:value});let map=createMapState({draft:query,committed:query,...owner,current:true,revision:1,cause:'search'});
 const view=render(<><button>outside</button><ResultsList isCurrent={()=>true} {...owner} query={query} catalog={catalog} refinementDisabled={false} draftChanged={false} onRefine={()=>undefined} onEdit={()=>undefined} onPreviewItinerary={(itinerary,source,leavingId)=>{map=mapReducer(map,{type:'preview',owner,source,leavingId,inspection:itinerary?{itinerary,query,owner}:undefined});}}/></>);
 const cards=view.container.querySelectorAll('article');const first=cards[0]!.querySelector<HTMLButtonElement>('button[aria-pressed]')!;act(()=>first.focus());fireEvent.mouseEnter(cards[1]!);expect(mapView(map,Date.now()).itinerary?.itineraryId).toBe('b');fireEvent.mouseLeave(cards[1]!);expect(mapView(map,Date.now()).itinerary?.itineraryId).toBe('a');fireEvent.mouseEnter(cards[0]!);act(()=>screen.getByRole('button',{name:'outside'}).focus());expect(mapView(map,Date.now()).itinerary?.itineraryId).toBe('a');fireEvent.mouseLeave(cards[0]!);expect(mapView(map,Date.now()).itinerary).toBeUndefined();
});

it('signals restored layout only after actual adopted cards exist, once and only for the current owner',()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+1000);let state=createResultsState('generation','search'),current=true;
 const value=recovery([group('restored')]),dispatch=vi.fn();const ready=vi.fn(()=>expect(document.querySelector('[data-group-id="restored"]')).toBeTruthy());
 vi.mocked(useResults).mockImplementation(()=>({state,dispatch,now:Date.now(),connectionError:false,connectionState:'settled' as const,error:undefined,retryRead:vi.fn(),stored:undefined}));
 const props={isCurrent:()=>current,generation:'generation',searchId:'search',query,catalog,refinementDisabled:false,draftChanged:false,onRefine:()=>undefined,onEdit:()=>undefined,restore:{frozen:true,dismissedSuggestion:false},onRestoreReady:ready};
 const view=render(<ResultsList {...props}/>);expect(ready).not.toHaveBeenCalled();state=resultsReducer(state,{type:'receive',recovery:value});view.rerender(<ResultsList {...props}/>);expect(ready).toHaveBeenCalledTimes(1);view.rerender(<ResultsList {...props}/>);expect(ready).toHaveBeenCalledTimes(1);view.unmount();
 current=false;ready.mockClear();render(<ResultsList {...props}/>);expect(ready).not.toHaveBeenCalled();
});

function completed(groups: ReturnType<typeof group>[],sequence=1) {
 const value=recovery(groups,sequence);value.snapshot.status='complete';value.snapshot.coverage={expectedProviderIds:['p'],successfulProviderIds:['p'],pendingProviderIds:[],failedProviderIds:[],complete:true};return value;
}
const resultProps: ResultsPageProps={isCurrent:()=>true,generation:'generation',searchId:'search',query,catalog,refinementDisabled:false,draftChanged:false,onRefine:()=>undefined,onEdit:()=>undefined};
it('renders a compact completed filter-empty result and keeps its adjustment callbacks owned by the current comparison',()=>{
 const value=completed([]);value.snapshot.query={...query,filters:{refundableOnly:true}};
 const state=resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:value});
 vi.mocked(useResults).mockReturnValue({state,dispatch:vi.fn(),now:Date.now(),connectionError:false,connectionState:'settled',error:undefined,retryRead:vi.fn(),stored:value});
 let current=true;const clear=vi.fn(),edit=vi.fn();
 const view=render(<ResultsList {...resultProps} query={value.snapshot.query} isCurrent={()=>current} onClearFilter={clear} onEdit={edit}/>);
 expect(view.container.querySelector('[data-results-empty]')).toHaveAttribute('data-results-empty','filter-empty');
 expect(screen.queryByRole('region',{name:'بازیابی مقایسه سفر'})).not.toBeInTheDocument();
 const remove=screen.getByRole('button',{name:'حذف استرداد'});fireEvent.click(remove);expect(clear).toHaveBeenCalledExactlyOnceWith('refundableOnly');
 current=false;fireEvent.click(remove);fireEvent.click(screen.getByRole('button',{name:'تغییر شرایط سفر'}));expect(clear).toHaveBeenCalledTimes(1);expect(edit).not.toHaveBeenCalled();
});
it('does not turn a failed result read into an empty-inventory claim or duplicate the compact recovery',()=>{
 const value=completed([]),state=resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:value});
 vi.mocked(useResults).mockReturnValue({state,dispatch:vi.fn(),now:Date.now(),connectionError:true,connectionState:'unavailable',error:Error('read failed'),retryRead:vi.fn(),stored:value});
 const fresh=vi.fn();const view=render(<ResultsList {...resultProps} onFreshSearch={fresh}/>);
 expect(view.container.querySelector('[data-results-empty]')).toHaveAttribute('data-results-empty','unavailable');
 expect(screen.getByRole('heading',{name:'پاسخ فروشندگان کامل دریافت نشد'})).toBeVisible();
 expect(screen.queryByText('برای این سفر پیشنهادی پیدا نشد')).not.toBeInTheDocument();expect(screen.queryByRole('region',{name:'بازیابی مقایسه سفر'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'تلاش دوباره'}));expect(fresh).toHaveBeenCalledOnce();
});
it('a historical empty comparison offers inspection without exposing a fresh mutation through the result panel',()=>{
 const value=completed([]),state=resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:value});
 vi.mocked(useResults).mockReturnValue({state,dispatch:vi.fn(),now:Date.now(),connectionError:false,connectionState:'expired',error:undefined,retryRead:vi.fn(),stored:value});
 const fresh=vi.fn();const view=render(<ResultsList {...resultProps} historical onFreshSearch={fresh}/>);
 expect(view.container.querySelector('[data-results-empty]')).toHaveAttribute('data-results-empty','historical');
 expect(screen.queryByRole('button',{name:'تلاش دوباره'})).not.toBeInTheDocument();expect(fresh).not.toHaveBeenCalled();
});
function controlledResults(initial: ResultsState | ((generation:string,searchId:string)=>ResultsState)) {
 let current!:ResultsState,send!:(action:ResultsAction)=>void;
 function useControlledResults(generation:string,searchId:string) {
  const [state,dispatch]=useReducer(resultsReducer,undefined,()=>typeof initial==='function'?initial(generation,searchId):initial);
  current=state;send=dispatch;
  return {state,dispatch,now:Date.now(),connectionError:false,connectionState:'settled' as const,error:undefined,retryRead:vi.fn(),stored:state.latest};
 }
 vi.mocked(useResults).mockImplementation(useControlledResults);
 return {state:()=>current,send:(action:ResultsAction)=>act(()=>send(action))};
}
it('counts unique successful sellers in the title and keeps only compact pending/failure information',()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+1000);const value=recovery([group('a')]);
 value.snapshot.coverage={expectedProviderIds:['p','q','r','s'],successfulProviderIds:['p','p','q'],pendingProviderIds:['r'],failedProviderIds:['s'],complete:false};
 controlledResults(resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:value}));
 render(<ResultsList {...resultProps}/>);
 expect(screen.getByRole('heading',{name:'مقایسه پروازها (۲ فروشنده)'})).toBeVisible();
 expect(screen.getByText('۱ فروشنده در حال بررسی · ۱ فروشنده در دسترس نیست')).toBeVisible();
 expect(screen.queryByText(/فروشنده پاسخ داده‌اند/)).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'ویرایش سفر'})).not.toBeInTheDocument();
});
it('defaults to the cheapest quote under fastest sorting, pins its route, and leaves focus and scroll untouched',()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+1000);const scroll=vi.fn();HTMLElement.prototype.scrollIntoView=scroll;
 const value=completed([group('fast',20000000),group('cheap',1000000)]);value.snapshot.groups[0]!.durationMinutes=60;value.snapshot.query={...query,sort:'fastest'};
 const control=controlledResults(resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:value}));const pin=vi.fn(),select=vi.fn(),handoff=vi.fn();
 render(<><input aria-label="search field" autoFocus/><ResultsList {...resultProps} query={value.snapshot.query} onPinItinerary={pin} onSelectQuote={select} selectedAction={{quoteId:'cheap-quote',node:<div data-referral-source="transport"><button onClick={handoff}>provider action</button></div>}}/></>);
 expect(control.state().selected?.quoteId).toBe('cheap-quote');expect(control.state().selectionSource).toBe('automatic');
 expect([...document.querySelectorAll<HTMLElement>('[data-group-id]')].map(node=>node.dataset.groupId)).toEqual(['fast','cheap']);
 expect(pin).toHaveBeenCalledOnce();expect(pin).toHaveBeenCalledWith(value.snapshot.groups[1]!.itinerary);expect(select).toHaveBeenLastCalledWith(value.snapshot.groups[1]!.eligibleQuotes[0],value.snapshot.groups[1]!.itinerary,{groupId:'cheap',quoteId:'cheap-quote',version:1});
 expect(screen.getByRole('textbox',{name:'search field'})).toHaveFocus();expect(screen.getByRole('button',{name:'provider action'})).toBeVisible();expect(scroll).not.toHaveBeenCalled();expect(handoff).not.toHaveBeenCalled();
 expect(screen.queryByText(/برای مقایسه انتخاب شد/)).not.toBeInTheDocument();
});
it('waits for a late cheapest quote, adopts final evidence through the existing anchor and selects only once',()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+1000);const scroll=vi.spyOn(window,'scrollBy').mockImplementation(()=>undefined),frame=vi.fn(()=>1);
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){return {x:0,y:100,top:100,bottom:300,left:0,right:500,width:500,height:200,toJSON:()=>({})};});
 vi.stubGlobal('requestAnimationFrame',frame);vi.stubGlobal('cancelAnimationFrame',vi.fn());
 const control=controlledResults(resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:recovery([group('early')])}));const pin=vi.fn();
 const view=render(<ResultsList {...resultProps} onPinItinerary={pin}/>);expect(control.state().selected).toBeUndefined();
 fireEvent.wheel(window,{deltaY:10});expect(control.state().frozen).toBe(true);
 const later=completed([group('late',1000000),group('early')],2);control.send({type:'receive',recovery:later});
 expect(control.state().adopted?.sequence).toBe(2);expect(control.state().selected?.quoteId).toBe('late-quote');expect(pin).toHaveBeenCalledOnce();
 expect(frame).toHaveBeenCalledOnce();expect(scroll).not.toHaveBeenCalled();
 control.send({type:'receive',recovery:completed([group('even-cheaper',1),group('late',1000000),group('early')],3)});
 expect(control.state().selected?.quoteId).toBe('late-quote');expect(control.state().adopted?.sequence).toBe(2);expect(pin).toHaveBeenCalledOnce();expect(screen.getByRole('button',{name:'اعمال نتایج تازه'})).toBeVisible();
 expect(screen.queryByText('نتایج به‌روز در دسترس است')).not.toBeInTheDocument();view.unmount();
});
it('a manual choice during collection wins over the terminal cheapest and still reveals its action',()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+1000);const scroll=vi.fn();HTMLElement.prototype.scrollIntoView=scroll;
 const control=controlledResults(resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:recovery([group('manual')])}));const pin=vi.fn();
 render(<ResultsList {...resultProps} onPinItinerary={pin} selectedAction={{quoteId:'manual-quote',node:<div data-referral-source="transport"><button>provider action</button></div>}}/>);
 fireEvent.click(screen.getByRole('button',{name:'انتخاب پیشنهاد'}));expect(screen.getByRole('button',{name:'provider action'})).toHaveFocus();expect(scroll).toHaveBeenCalledOnce();
 control.send({type:'receive',recovery:completed([group('cheap',1),group('manual')],2)});
 expect(control.state().selected?.quoteId).toBe('manual-quote');expect(control.state().selectionSource).toBe('manual');expect(control.state().adopted?.sequence).toBe(1);expect(pin).toHaveBeenCalledOnce();
});
it.each([
 {name:'historical',props:{historical:true}},
 {name:'changed draft',props:{draftChanged:true}},
 {name:'stale owner',props:{isCurrent:()=>false}},
 {name:'invalid synchronous selection authority',props:{isSelectionCurrent:()=>false}},
 {name:'refinement',props:{allowDefaultSelection:false}},
 {name:'restored checkpoint',props:{restore:{frozen:true,dismissedSuggestion:false}}},
])('does not automatically select or pin $name evidence',({props})=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+1000);const control=controlledResults(resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:completed([group('a')])}));const pin=vi.fn();
 render(<ResultsList {...resultProps} {...props} onPinItinerary={pin}/>);expect(control.state().selected).toBeUndefined();expect(pin).not.toHaveBeenCalled();
});
it('keeps restored manual selection and its focus instead of replacing it with the cheapest quote',()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+1000);const selection={groupId:'manual',quoteId:'manual-quote',version:1};
 const initial=resultsReducer(resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:completed([group('cheap',1),group('manual')])}),{type:'select',selection,now:Date.now()});
 const control=controlledResults(initial);const pin=vi.fn();HTMLElement.prototype.scrollIntoView=vi.fn();
 render(<><input aria-label="restored focus" autoFocus/><ResultsList {...resultProps} restore={{frozen:true,selected:selection,dismissedSuggestion:false}} onPinItinerary={pin} selectedAction={{quoteId:'manual-quote',node:<div data-referral-source="transport"><button>provider action</button></div>}}/></>);
 expect(control.state().selected).toEqual(selection);expect(pin).not.toHaveBeenCalled();expect(screen.getByRole('textbox',{name:'restored focus'})).toHaveFocus();expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
});
it('does not retry an expired default in the same generation, but a new search may select once',()=>{
 const now=vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+600000);
 const control=controlledResults((generation,searchId)=>{const value=completed([group('a')]);value.snapshot.clientGeneration=generation;value.snapshot.searchId=searchId;return resultsReducer(createResultsState(generation,searchId),{type:'receive',recovery:value});});const pin=vi.fn();
 const view=render(<ResultsPage {...resultProps} onPinItinerary={pin}/>);expect(control.state().selected).toBeUndefined();
 now.mockReturnValue(Date.parse(observedAt)+1000);view.rerender(<ResultsPage {...resultProps} onPinItinerary={pin}/>);expect(control.state().selected).toBeUndefined();
 view.rerender(<ResultsPage {...resultProps} generation="next-generation" searchId="next-search" onPinItinerary={pin}/>);expect(control.state().selected?.quoteId).toBe('a-quote');expect(pin).toHaveBeenCalledOnce();
});

it('renders exact-price cards in global price order with only the selected price sellers and stable price colors',()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+1000);HTMLElement.prototype.scrollIntoView=vi.fn();
 const a=group('a',1000000),b=group('b',1500000);const original=a.eligibleQuotes[0]!;
 a.eligibleQuotes.push({...structuredClone(original),quoteId:'peer',providerId:'q'}, {...structuredClone(original),quoteId:'higher',total:{currency:'IRR',amountRial:2000000}});
 const value=completed([a,b]);const control=controlledResults(resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:value}));
 const outbound=vi.fn();const renderProviderAction=vi.fn((quote:typeof original,source:typeof a)=><button type="button" role="link" data-referral-source="transport" onClick={()=>outbound(quote,source)}>{quote.providerId}</button>);
 render(<ResultsList {...resultProps} renderProviderAction={renderProviderAction}/>);
 const cards=screen.getAllByRole('article');expect(cards.map(card=>card.getAttribute('data-amount-rial'))).toEqual(['1000000','1500000','2000000']);
 expect(cards.map(card=>card.querySelector('[data-price-band]')?.getAttribute('data-price-band'))).toEqual(['low','mid','high']);
 expect(cards.filter(card=>card.hasAttribute('data-selected'))).toEqual([cards[0]]);
 expect(within(cards[0]!).getAllByRole('link')).toHaveLength(2);expect(within(cards[2]!).queryByRole('link')).not.toBeInTheDocument();
 expect([...cards[0]!.querySelectorAll<HTMLElement>('[data-seller-amount-rial]')].map(node=>node.dataset.sellerAmountRial)).toEqual(['1000000','1000000']);
 fireEvent.click(within(cards[0]!).getByRole('link',{name:'q'}));expect(outbound).toHaveBeenLastCalledWith(a.eligibleQuotes[1],a);
 fireEvent.click(within(cards[2]!).getByRole('button',{name:'انتخاب پیشنهاد'}));
 expect(control.state().selected).toEqual({groupId:'a',quoteId:'higher',version:1});expect(cards[0]).not.toHaveAttribute('data-selected');expect(cards[2]).toHaveAttribute('data-selected','true');
 expect(within(cards[0]!).queryByRole('link')).not.toBeInTheDocument();expect(within(cards[2]!).getAllByRole('link')).toHaveLength(1);expect(within(cards[2]!).getByRole('link')).toHaveFocus();
 expect(cards[2]).toHaveAttribute('data-price-card-id',priceCardId('a',a.eligibleQuotes[2]));
 expect(screen.queryByRole('button',{name:/جزئیات و.*پیشنهاد/})).not.toBeInTheDocument();
});

it('keeps same-price fare variants distinguishable and excludes revoked sellers from the selected row',()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+1000);
 const a=group('variants',100),first=a.eligibleQuotes[0]!;
 a.eligibleQuotes.push({...structuredClone(first),quoteId:'variant-two',fareId:'second-fare',conditions:{outbound:{...first.conditions.outbound,refundable:{status:'known',value:true}}}}, {...structuredClone(first),quoteId:'revoked',providerId:'r'});
 let initial=resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:completed([a])});
 initial=resultsReducer(initial,{type:'select',selection:{groupId:'variants',quoteId:first.quoteId,version:1},now:Date.now()});
 const latest=structuredClone(a);latest.eligibleQuotes=latest.eligibleQuotes.filter(quote=>quote.quoteId!=='revoked');initial=resultsReducer(initial,{type:'receive',recovery:completed([latest],2)});
 controlledResults(initial);render(<ResultsList {...resultProps} renderProviderAction={quote=><a href={'#'+quote.quoteId}>{quote.quoteId}</a>}/>);
 expect(screen.getAllByRole('link')).toHaveLength(2);expect(screen.queryByRole('link',{name:'revoked'})).not.toBeInTheDocument();
 expect(screen.getByText('گزینه ۱')).toBeVisible();expect(screen.getByText('گزینه ۲')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'جزئیات سفر'}));
 const fares=document.querySelectorAll('[data-offer-quote-id]');expect(fares).toHaveLength(3);
 expect(document.querySelector('[data-offer-quote-id="variant-two"]')).toHaveTextContent('قابل استرداد طبق شرایط فروشنده');
 expect(document.querySelector('[data-offer-quote-id="revoked"]')).toHaveTextContent('این نسخه دیگر معتبر نیست');
});

it('suggestion focus targets its exact price card when the itinerary has a cheaper bucket',()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+1000);HTMLElement.prototype.scrollIntoView=vi.fn();
 const baseline=group('baseline',10000000),alternative=group('alternative',10200000);baseline.durationMinutes=250;alternative.durationMinutes=100;
 const higher={...structuredClone(alternative.eligibleQuotes[0]!),quoteId:'higher-target',total:{currency:'IRR' as const,amountRial:10500000}};alternative.eligibleQuotes.push(higher);
 const value=completed([baseline,alternative]);value.snapshot.suggestion={kind:'faster-journey',alternativeId:higher.quoteId,baselineId:baseline.eligibleQuotes[0]!.quoteId,delta:{amountRial:500000,minutes:150,priceRatio:1.05},coverage:value.snapshot.coverage,dismissalScope:{searchId:'search'}};
 controlledResults(resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:value}));render(<ResultsList {...resultProps}/>);
 fireEvent.click(screen.getByRole('button',{name:'نمایش مسیر پیشنهادی'}));
 const target=screen.getAllByRole('article').find(card=>card.getAttribute('data-price-card-id')===priceCardId(alternative.groupId,higher))!;
 expect(within(target).getByRole('button',{name:'انتخاب پیشنهاد'})).toHaveFocus();
 expect(target).toHaveAttribute('data-quote-id','higher-target');
});

function fasterSuggestion() {
 const baseline=group('baseline',10000000),alternative=group('alternative',10200000);baseline.durationMinutes=250;alternative.durationMinutes=100;
 const higher={...structuredClone(alternative.eligibleQuotes[0]!),quoteId:'higher-target',total:{currency:'IRR' as const,amountRial:10500000}};alternative.eligibleQuotes.push(higher);
 const value=completed([baseline,alternative]);value.snapshot.suggestion={kind:'faster-journey',alternativeId:higher.quoteId,baselineId:baseline.eligibleQuotes[0]!.quoteId,delta:{amountRial:500000,minutes:150,priceRatio:1.05},coverage:value.snapshot.coverage,dismissalScope:{searchId:'search'}};
 return {value,alternative,higher};
}
function allowSuggestionMotion(reduced=false) {
 vi.stubGlobal('matchMedia',(media:string)=>({media,matches:reduced&&media==='(prefers-reduced-motion: reduce)',addEventListener:vi.fn(),removeEventListener:vi.fn(),addListener:vi.fn(),removeListener:vi.fn(),dispatchEvent:()=>true,onchange:null}));
 vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
 vi.spyOn(window,'scrollTo').mockImplementation(()=>undefined);
}
it('keeps only the exact suggested price card gold and restarts its three-second navigation cue without choosing an offer',()=>{
 vi.useFakeTimers();vi.setSystemTime(Date.parse(observedAt)+1000);allowSuggestionMotion();HTMLElement.prototype.scrollIntoView=vi.fn();
 const {value,alternative,higher}=fasterSuggestion();const control=controlledResults(resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:value}));render(<ResultsList {...resultProps}/>);
 const target=screen.getAllByRole('article').find(card=>card.getAttribute('data-price-card-id')===priceCardId(alternative.groupId,higher))!;
 expect(document.querySelectorAll('[data-suggested-route]')).toHaveLength(1);expect(target).toHaveAttribute('data-suggested-route','true');
 const initialOrder=screen.getAllByRole('article').map(card=>card.getAttribute('data-price-card-id'));const initialSelection=control.state().selected;
 fireEvent.click(screen.getByRole('button',{name:'نمایش مسیر پیشنهادی'}));expect(target).toHaveAttribute('data-suggestion-highlight','true');
 const first=target.querySelector('[data-suggestion-highlight-epoch]');
 act(()=>vi.advanceTimersByTime(2000));fireEvent.click(screen.getByRole('button',{name:'نمایش مسیر پیشنهادی'}));expect(target.querySelector('[data-suggestion-highlight-epoch]')).not.toBe(first);
 act(()=>vi.advanceTimersByTime(2999));expect(target).toHaveAttribute('data-suggestion-highlight','true');act(()=>vi.advanceTimersByTime(1));expect(target).not.toHaveAttribute('data-suggestion-highlight');
 expect(target).toHaveAttribute('data-suggested-route','true');expect(within(target).getByRole('button',{name:'انتخاب پیشنهاد'})).toHaveFocus();expect(control.state().selected).toEqual(initialSelection);expect(screen.getAllByRole('article').map(card=>card.getAttribute('data-price-card-id'))).toEqual(initialOrder);
 fireEvent.click(screen.getByRole('button',{name:'بستن پیشنهاد جایگزین'}));expect(screen.queryByRole('button',{name:'نمایش مسیر پیشنهادی'})).not.toBeInTheDocument();expect(target).toHaveAttribute('data-suggested-route','true');
});
it('revokes a suggested highlight and gold identity when its current price expires or the draft is replaced',()=>{
 vi.useFakeTimers();const instant=Date.parse(observedAt)+1000;vi.setSystemTime(instant);allowSuggestionMotion();HTMLElement.prototype.scrollIntoView=vi.fn();
 const {value}=fasterSuggestion();controlledResults(resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:value}));const view=render(<ResultsList {...resultProps}/>);
 fireEvent.click(screen.getByRole('button',{name:'نمایش مسیر پیشنهادی'}));expect(document.querySelector('[data-suggestion-highlight]')).toBeTruthy();
 view.rerender(<ResultsList {...resultProps} draftChanged/>);expect(document.querySelector('[data-suggestion-highlight]')).toBeNull();expect(document.querySelector('[data-suggested-route]')).toBeNull();
 view.rerender(<ResultsList {...resultProps}/>);expect(document.querySelector('[data-suggested-route]')).toBeTruthy();expect(document.querySelector('[data-suggestion-highlight]')).toBeNull();
 const expiresAt=Math.min(...value.snapshot.groups.flatMap(item=>item.eligibleQuotes.map(quote=>Date.parse(quote.expiresAt))));vi.setSystemTime(expiresAt);view.rerender(<ResultsList {...resultProps}/>);expect(document.querySelector('[data-suggested-route]')).toBeNull();expect(screen.queryByRole('button',{name:'نمایش مسیر پیشنهادی'})).not.toBeInTheDocument();
});
it('blocks retained suggestion callbacks after owner invalidation and never targets an exiting price-card cohort',()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+1000);allowSuggestionMotion();HTMLElement.prototype.scrollIntoView=vi.fn();
 const {value}=fasterSuggestion();controlledResults(resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:value}));let current=true;
 const view=render(<ResultsList {...resultProps} isCurrent={()=>current}/>);const action=screen.getByRole('button',{name:'نمایش مسیر پیشنهادی'}),target=view.container.querySelector<HTMLElement>('[data-suggested-route]')!;
 const exiting=document.createElement('div');exiting.inert=true;exiting.dataset.resultPresence='exiting';const old=target.cloneNode(true) as HTMLElement;exiting.append(old);target.parentElement!.before(exiting);
 fireEvent.click(action);expect(within(target).getByRole('button',{name:'انتخاب پیشنهاد'})).toHaveFocus();expect(old).not.toHaveAttribute('data-suggestion-highlight');
 current=false;HTMLElement.prototype.scrollIntoView=vi.fn();fireEvent.click(action);expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
});
it('reduced motion reveals the exact gold suggestion immediately without a transient animated cue',()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+1000);allowSuggestionMotion(true);HTMLElement.prototype.scrollIntoView=vi.fn();
 const {value}=fasterSuggestion();controlledResults(resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:value}));render(<ResultsList {...resultProps}/>);
 fireEvent.click(screen.getByRole('button',{name:'نمایش مسیر پیشنهادی'}));const target=document.querySelector<HTMLElement>('[data-suggested-route]')!;
 expect(within(target).getByRole('button',{name:'انتخاب پیشنهاد'})).toHaveFocus();expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({block:'center',behavior:'instant'});expect(target).not.toHaveAttribute('data-suggestion-highlight');
});
it('settles a covered or hidden navigation cue without replaying it when the result list resumes',()=>{
 vi.useFakeTimers();vi.setSystemTime(Date.parse(observedAt)+1000);allowSuggestionMotion();HTMLElement.prototype.scrollIntoView=vi.fn();
 const {value}=fasterSuggestion();controlledResults(resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:value}));
 const view=render(<MotionPolicyProvider><ResultsList {...resultProps}/></MotionPolicyProvider>);
 fireEvent.click(screen.getByRole('button',{name:'نمایش مسیر پیشنهادی'}));expect(document.querySelector('[data-suggestion-highlight]')).toBeTruthy();
 view.rerender(<MotionPolicyProvider covered><ResultsList {...resultProps}/></MotionPolicyProvider>);expect(document.querySelector('[data-suggestion-highlight]')).toBeNull();
 view.rerender(<MotionPolicyProvider><ResultsList {...resultProps}/></MotionPolicyProvider>);expect(document.querySelector('[data-suggestion-highlight]')).toBeNull();expect(document.querySelector('[data-suggested-route]')).toBeTruthy();
 let visibility:DocumentVisibilityState='visible';vi.spyOn(document,'visibilityState','get').mockImplementation(()=>visibility);
 fireEvent.click(screen.getByRole('button',{name:'نمایش مسیر پیشنهادی'}));expect(document.querySelector('[data-suggestion-highlight]')).toBeTruthy();
 visibility='hidden';fireEvent(document,new Event('visibilitychange'));expect(document.querySelector('[data-suggestion-highlight]')).toBeNull();
 visibility='visible';fireEvent(document,new Event('visibilitychange'));expect(document.querySelector('[data-suggestion-highlight]')).toBeNull();expect(document.querySelector('[data-suggested-route]')).toBeTruthy();
});
