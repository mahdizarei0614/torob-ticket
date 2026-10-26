// Actual consumer regression adapted from independently reproduced R1.
import{act,render,screen,fireEvent,cleanup}from'@testing-library/react';
import{QueryClient,QueryClientProvider}from'@tanstack/react-query';
import{MemoryRouter}from'react-router';
import{afterEach,expect,it,vi}from'vitest';
import type{SearchRequest}from'@torob-ticket/contracts';
import{catalog,query,session}from'../search/search-test-data';
import{group,recovery,observedAt}from'./results-test-data';
import{SearchPage}from'../search/search-page';
import type{useSearchController}from'../search/use-search-controller';
const holder=vi.hoisted(()=>({current:undefined as ReturnType<typeof useSearchController>|undefined}));
vi.mock('../search/use-search-controller',async original=>{const actual=await original<typeof import('../search/use-search-controller')>();return{...actual,useSearchController:(...args:Parameters<typeof actual.useSearchController>)=>{const controller=actual.useSearchController(...args);holder.current=controller;return controller;}};});
vi.mock('@torob-ticket/graphics/host',async original=>({...await original<typeof import('@torob-ticket/graphics/host')>(),GraphicsProvider:({children}:{children:unknown})=>children}));
vi.mock('../dates/date-explorer',()=>({DateExplorer:()=>null}));
vi.mock('@torob-ticket/client',async original=>{const actual=await original<typeof import('@torob-ticket/client')>();return{...actual,apiClient:{session:async()=>session,sessionSnapshot:()=>session,catalog:async()=>catalog,startSearch:async(input:SearchRequest)=>{const value=recovery([group('old-itinerary')]);value.snapshot.clientGeneration=input.clientGeneration;value.snapshot.query=input.query;value.snapshot.status='complete';return value;},cancelSearch:async()=>undefined}};});
afterEach(()=>{cleanup();vi.restoreAllMocks();window.history.replaceState({},'','/');});
it('actual consumer native Pop fences old quote selection, pin and preview before React removes old result DOM',async()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+1000);HTMLElement.prototype.scrollIntoView=vi.fn();
 render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/?'+new URLSearchParams({q:JSON.stringify(query)})]}><SearchPage/></MemoryRouter></QueryClientProvider>);
 const search=await screen.findByRole('button',{name:'جست‌وجوی سفر'});await act(async()=>{fireEvent.click(search);});
 const select=await screen.findByRole('button',{name:'انتخاب پیشنهاد'});const card=screen.getByRole('article');
 act(()=>{window.history.replaceState({},'','/?'+new URLSearchParams({q:JSON.stringify({...query,departureDate:'2026-10-26'})}));window.dispatchEvent(new PopStateEvent('popstate'));fireEvent.click(select);fireEvent.mouseEnter(card);});
 const state=holder.current!.state;
 expect(state.committed?.departureDate).toBe('2026-10-26');expect(state.pinnedItineraryId).toBeUndefined();expect(state.previewItineraryId).toBeUndefined();
});
