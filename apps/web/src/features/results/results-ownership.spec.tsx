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
vi.mock('@torob-ticket/client',async original=>{const actual=await original<typeof import('@torob-ticket/client')>();return{...actual,apiClient:{session:async()=>session,sessionSnapshot:()=>session,catalog:async()=>catalog,startSearch:async(input:SearchRequest)=>{const value=recovery(input.query.filters.refundableOnly?[]:[group('old-itinerary')]);value.snapshot.clientGeneration=input.clientGeneration;value.snapshot.query=input.query;value.snapshot.status=value.snapshot.groups.length?'complete':'empty';value.snapshot.coverage={expectedProviderIds:['p'],successfulProviderIds:['p'],failedProviderIds:[],pendingProviderIds:[],complete:true};return value;},cancelSearch:async()=>undefined}};});
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
it('actual consumer form choices remove the old result list and generic recovery while a valid edited form can search again',async()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+1000);HTMLElement.prototype.scrollIntoView=vi.fn();
 render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/?'+new URLSearchParams({q:JSON.stringify(query)})]}><SearchPage/></MemoryRouter></QueryClientProvider>);
 const search=await screen.findByRole('button',{name:'جست‌وجوی سفر'});await act(async()=>{fireEvent.click(search);});
 const oldCard=await screen.findByRole('article');expect(holder.current!.state.searchId).toBeTruthy();
 fireEvent.click(screen.getByRole('radio',{name:'قطار'}));
 expect(oldCard).not.toBeInTheDocument();expect(screen.queryByRole('region',{name:'نتایج مقایسه سفر'})).not.toBeInTheDocument();
 expect(screen.queryByText('دریافت پیشنهاد کامل نشد')).not.toBeInTheDocument();expect(screen.queryByRole('region',{name:'بازیابی مقایسه سفر'})).not.toBeInTheDocument();
 expect(holder.current!.state.pinnedItineraryId).toBeUndefined();
 act(()=>holder.current!.edit({destinationCityId:'c'}));expect(screen.getByRole('button',{name:'جست‌وجوی سفر'})).toBeEnabled();
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'جست‌وجوی سفر'}));});
 expect(holder.current!.state.committed?.mode).toBe('train');expect(await screen.findByRole('region',{name:'نتایج مقایسه سفر'})).toBeInTheDocument();
});
it('actual empty-filter removal preserves the displayed ranking in the fresh comparison',async()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+1000);HTMLElement.prototype.scrollIntoView=vi.fn();
 const filtered={...query,filters:{refundableOnly:true}};
 render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/?'+new URLSearchParams({q:JSON.stringify(filtered)})]}><SearchPage/></MemoryRouter></QueryClientProvider>);
 const search=await screen.findByRole('button',{name:'جست‌وجوی سفر'});await act(async()=>{fireEvent.click(search);});
 const original=holder.current!.state.committed!;expect(await screen.findByRole('heading',{name:'پیشنهادی با این فیلترها پیدا نشد'})).toBeVisible();
 fireEvent.click(screen.getByRole('radio',{name:'سریع‌ترین'}));expect(holder.current!.state.resultSort).toBe('fastest');expect(original.sort).toBe('cheapest');
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'حذف استرداد'}));});
 expect(await screen.findByRole('article')).toBeInTheDocument();expect(holder.current!.state.committed).toMatchObject({filters:{},sort:'fastest'});
 expect(holder.current!.state.resultSort).toBe('fastest');expect(original).toMatchObject({filters:{refundableOnly:true},sort:'cheapest'});
});
