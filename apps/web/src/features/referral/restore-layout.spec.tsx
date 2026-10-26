import {StrictMode,type ReactElement} from 'react';
import {render,screen,fireEvent,act,waitFor} from '@testing-library/react';
import {BrowserRouter} from 'react-router';
import {afterEach,it,expect,vi} from 'vitest';
import type {DialogProps} from '@torob-ticket/ui';
import {RetainedConsumerRoutes} from '../../routes';
import {query} from '../search/search-test-data';
import {serializeSearchUrl} from '../search/search-url';
import {group,recovery} from '../results/results-test-data';
import type {HydratedReturn} from './return-hydration';
const control=vi.hoisted(()=>({value:undefined as unknown as HydratedReturn,origins:[] as number[]}));
vi.mock('./provider-page',()=>({ProviderPage:({onReturn}:{onReturn:(value:HydratedReturn)=>void})=><button onClick={()=>onReturn(control.value)}>return restored</button>}));
vi.mock('../search/search-page',async()=>{
 const {useLayoutEffect,useState}=await import('react'),{Dialog}=await vi.importActual<{Dialog:(props:DialogProps)=>ReactElement}>('@torob-ticket/ui');
 function Origin(){useLayoutEffect(()=>{control.origins.push(window.scrollY);},[]);return <p>independent stay</p>;}
 return {SearchPage:({restore,onRestoreReady,covered}:{restore?:HydratedReturn;onRestoreReady?:(value:HydratedReturn,ready:boolean)=>void;covered:boolean})=>{
  const [stage,setStage]=useState('bootstrap');useLayoutEffect(()=>{if(stage==='adopted'&&restore)onRestoreReady?.(restore,true);},[stage,restore,onRestoreReady]);
  return <main><output data-testid="seed">{restore?.recovery.snapshot.searchId??'no restore seed'}</output><output>{covered?'suspended':'interactive'}</output><p>{stage}</p><button onClick={()=>setStage('adopting')}>finish bootstrap</button><button onClick={()=>setStage('adopted')}>finish adopted DOM</button><button onClick={()=>restore&&onRestoreReady?.(restore,true)}>repeat readiness</button><Dialog title="restored hotel" isOpen onOpenChange={()=>undefined} initialScrollTop={180}><Origin/></Dialog></main>;
 }};
});
function setup(){const r=recovery([group('a')],2);control.value={recovery:r,checkpoint:{version:1,referralId:'r',returnSearch:serializeSearchUrl(query),searchId:r.snapshot.searchId,generation:r.snapshot.clientGeneration,draft:query,adoptedSequence:2,frozen:true,dismissedSuggestion:false,direction:'outbound',scrollY:1635}};control.origins=[];Object.defineProperty(window,'scrollY',{configurable:true,value:0});
 const scroll=vi.spyOn(window,'scrollTo').mockImplementation((options:ScrollToOptions|number)=>{if(typeof options==='object')Object.defineProperty(window,'scrollY',{configurable:true,value:options.top??0});});window.history.replaceState({key:'provider-entry',idx:0},'','/provider-demo/r');const view=render(<StrictMode><BrowserRouter><RetainedConsumerRoutes/></BrowserRouter></StrictMode>);scroll.mockClear();return {scroll,...view};}
afterEach(()=>{vi.restoreAllMocks();Object.defineProperty(window,'scrollY',{configurable:true,value:0});window.history.replaceState({},'','/');});
it('waits for bootstrap AND adopted DOM, restores origin once, then releases the independent hotel portal',async()=>{
 const {scroll}=setup();fireEvent.click(screen.getByText('return restored'));await screen.findByText('bootstrap');expect(scroll).not.toHaveBeenCalled();expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getByText('suspended')).toBeTruthy();
 fireEvent.click(screen.getByText('finish bootstrap'));expect(screen.getByText('adopting')).toBeTruthy();expect(scroll).not.toHaveBeenCalled();expect(screen.queryByRole('dialog')).toBeNull();fireEvent.click(screen.getByText('finish adopted DOM'));await screen.findByRole('dialog',{name:'restored hotel'});expect(scroll).toHaveBeenCalledTimes(1);expect(scroll).toHaveBeenCalledWith({top:1635,behavior:'instant'});expect(control.origins.length).toBeGreaterThan(0);expect(control.origins.every(y=>y===1635)).toBe(true);fireEvent.click(screen.getByText('repeat readiness'));expect(scroll).toHaveBeenCalledTimes(1);
});
it('different real history fences a delayed adopted callback and releases the pending visual cover',async()=>{
 const {scroll}=setup();fireEvent.click(screen.getByText('return restored'));await screen.findByText('bootstrap');fireEvent.click(screen.getByText('finish bootstrap'));
 act(()=>{window.history.replaceState({key:'different',idx:0},'','/'+serializeSearchUrl({...query,sort:'fastest'}));window.dispatchEvent(new PopStateEvent('popstate'));});await waitFor(()=>expect(screen.getByText('interactive')).toBeTruthy());expect(screen.getByTestId('seed').textContent).toBe('no restore seed');fireEvent.click(screen.getByText('finish adopted DOM'));expect(scroll).not.toHaveBeenCalledWith({top:1635,behavior:'instant'});
});

it('a different entry with the same query revokes the seed before delayed bootstrap finishes',async()=>{
 const {scroll}=setup();fireEvent.click(screen.getByText('return restored'));await screen.findByText('bootstrap');
 act(()=>{window.history.replaceState({key:'different-same-query',idx:0},'','/'+serializeSearchUrl(query));window.dispatchEvent(new PopStateEvent('popstate'));});await waitFor(()=>expect(screen.getByTestId('seed').textContent).toBe('no restore seed'));fireEvent.click(screen.getByText('finish adopted DOM'));expect(scroll).not.toHaveBeenCalledWith({top:1635,behavior:'instant'});
});
