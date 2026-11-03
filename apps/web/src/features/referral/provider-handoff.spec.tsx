import {StrictMode} from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {ApiClient} from '@torob-ticket/client';
import type {ConfirmReferralInput,ReferralIntent,ReferralReceipt,ReferralSelection,RecheckResult} from '@torob-ticket/contracts';
import {App} from '../../app';
import {group} from '../results/results-test-data';
import {catalog} from '../search/search-test-data';
import {hotelQuote} from '../hotels/hotel-test-data';
import {useReferralController,type ReferralPayload,type ReferralSource} from './referral-controller';
import {ReferralDialog} from './referral-dialog';

vi.mock('../../routes',()=>({ConsumerRoutes:()=> <ComparisonProbe/>}));
let active:ReturnType<typeof useReferralController>;
let scenario:ReturnType<typeof setup>;
function ComparisonProbe(){
 active=useReferralController({client:scenario.client,onHandoff:scenario.legacyHandoff});
 return <><button onClick={()=>void active.start(scenario.source,'فروشنده سفر')}>ادامه مقایسه</button><output data-testid="phase">{active.state.phase}</output><ReferralDialog flow={active} catalog={catalog}/></>;
}
function setup(kind:'transport'|'hotel'='transport',changed=false){
 const now=Date.now(),g=group('new-tab');
 g.eligibleQuotes[0]!.observedAt=new Date(now-1000).toISOString();g.eligibleQuotes[0]!.expiresAt=new Date(now+600000).toISOString();
 const payload:ReferralPayload=kind==='transport'?{kind,itinerary:g.itinerary,quote:g.eligibleQuotes[0]!}:{kind,quote:hotelQuote(now)};
 let current=true;
 const source:ReferralSource={key:'comparison-owner',payload,isCurrent:()=>current,accept:vi.fn(()=>true),confirmed:vi.fn(()=>true),refresh:vi.fn()};
 const fresh=structuredClone(payload);fresh.quote.version++;fresh.quote.observedAt=new Date(now).toISOString();
 if(changed){fresh.quote.total.amountRial+=1000;fresh.quote.breakdown[0]!.amount.amountRial+=1000;}
 const intent:ReferralIntent={intentId:'verified-intent',selection:{kind:fresh.kind,quoteId:fresh.quote.quoteId,quoteVersion:fresh.quote.version},quote:fresh,createdAt:new Date(now).toISOString(),expiresAt:new Date(now+120000).toISOString()};
 const receipt:ReferralReceipt={referralId:'confirmed-referral',intentId:intent.intentId,selection:intent.selection,payload:intent.quote,confirmedAt:new Date(now).toISOString(),handoffPath:'/provider-demo/confirmed-referral'};
 const prepared:RecheckResult=changed?{status:'changed',intent,previousQuoteVersion:payload.quote.version,previousQuote:payload,materialChanges:['total','breakdown']}:{status:'ready',intent};
 const prepareReferral=vi.fn(async(input:ReferralSelection,signal?:AbortSignal):Promise<RecheckResult>=>{void input;void signal;return prepared;});
 const confirmReferral=vi.fn(async(input:ConfirmReferralInput,signal?:AbortSignal)=>{void input;void signal;return receipt;});
 return {source,prepared,receipt,prepareReferral,confirmReferral,legacyHandoff:vi.fn(),replace:()=>{current=false;},client:{prepareReferral,confirmReferral} as unknown as ApiClient};
}
function tab(){return {closed:false,opener:window,location:{replace:vi.fn()},close:vi.fn()} as unknown as Window;}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}
async function start(){await act(async()=>{void active.start(scenario.source,'فروشنده سفر');});}
async function advance(ms:number){await act(async()=>{await vi.advanceTimersByTimeAsync(ms);});}
beforeEach(()=>{
 vi.useFakeTimers();
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));
 vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
 scenario=setup();
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});

describe('actual App provider handoff policy',()=>{
 it.each(['transport','hotel'] as const)('shows the fullscreen transfer first, confirms once, and opens %s externally without replacing comparison',async kind=>{
  scenario=setup(kind);const target=tab(),open=vi.spyOn(window,'open').mockReturnValue(target),location=window.location.href;
  render(<App/>);
  await act(async()=>{void active.start(scenario.source,'فروشنده سفر');void active.start(scenario.source,'فروشنده سفر');});
  expect(screen.getByRole('dialog',{name:'انتقال به فروشنده'})).toBeInTheDocument();
  expect(screen.getByRole('heading',{name:'در حال انتقال به فروشنده سفر'})).toBeInTheDocument();
  expect(screen.queryByText('در حال ثبت ارجاع و دریافت نتیجه…')).not.toBeInTheDocument();
  expect(open).not.toHaveBeenCalled();expect(scenario.confirmReferral).toHaveBeenCalledTimes(1);
  await advance(719);expect(open).not.toHaveBeenCalled();
  await advance(1);expect(open).toHaveBeenCalledTimes(1);expect(target.location.replace).toHaveBeenCalledWith(new URL('/api/v1/referrals/confirmed-referral/outbound',window.location.origin).href);expect(target.opener).toBeNull();
  expect(scenario.prepareReferral).toHaveBeenCalledTimes(1);expect(scenario.source.confirmed).toHaveBeenCalledWith(scenario.receipt);
  await advance(181);expect(screen.getByTestId('phase')).toHaveTextContent('idle');expect(screen.getByRole('button',{name:'ادامه مقایسه'})).toBeEnabled();
  expect(scenario.legacyHandoff).not.toHaveBeenCalled();expect(window.location.href).toBe(location);
 });
 it('keeps the loading backdrop through pending prepare and confirm, but requires explicit changed-version consent',async()=>{
  scenario=setup('transport',true);const prepared=deferred<RecheckResult>(),confirmed=deferred<ReferralReceipt>();
  scenario.prepareReferral.mockReturnValueOnce(prepared.promise);scenario.confirmReferral.mockReturnValueOnce(confirmed.promise);
  const open=vi.spyOn(window,'open').mockReturnValue(tab());render(<App/>);await start();
  expect(screen.getByRole('dialog',{name:'انتقال به فروشنده'})).toBeInTheDocument();
  await act(async()=>prepared.resolve(scenario.prepared));
  expect(screen.getByRole('dialog',{name:'شرایط تازه پیشنهاد'})).toBeInTheDocument();expect(scenario.confirmReferral).not.toHaveBeenCalled();
  await advance(1000);expect(open).not.toHaveBeenCalled();
  await act(async()=>{void active.accept();});expect(screen.getByRole('dialog',{name:'انتقال به فروشنده'})).toBeInTheDocument();
  expect(open).not.toHaveBeenCalled();await act(async()=>confirmed.resolve(scenario.receipt));await advance(720);
  expect(open).toHaveBeenCalledTimes(1);expect(scenario.confirmReferral).toHaveBeenCalledTimes(1);await advance(180);
 });
 it('retries a popup synchronously in a fresh gesture with the same receipt and no second confirmation',async()=>{
  const target=tab(),open=vi.spyOn(window,'open').mockReturnValueOnce(null).mockReturnValueOnce(target);render(<App/>);await start();await advance(720);
  expect(screen.getByTestId('phase')).toHaveTextContent('handoff-error');expect(scenario.confirmReferral).toHaveBeenCalledTimes(1);
  const retry=screen.getByRole('button',{name:'باز کردن صفحه فروشنده'});
  fireEvent.click(retry);expect(open).toHaveBeenCalledTimes(2);expect(target.location.replace).toHaveBeenCalledWith(new URL('/api/v1/referrals/confirmed-referral/outbound',window.location.origin).href);
  expect(scenario.prepareReferral).toHaveBeenCalledTimes(1);expect(scenario.confirmReferral).toHaveBeenCalledTimes(1);expect(scenario.source.confirmed).toHaveBeenCalledTimes(1);
  await advance(181);expect(screen.getByTestId('phase')).toHaveTextContent('idle');expect(scenario.legacyHandoff).not.toHaveBeenCalled();
 });
 it.each(['cancel','replace','unmount'] as const)('fences a confirmed receipt during the visible delay after %s and releases its timer',async action=>{
  const open=vi.spyOn(window,'open').mockReturnValue(tab()),view=render(<StrictMode><App/></StrictMode>);await start();
  expect(scenario.confirmReferral).toHaveBeenCalledTimes(1);
  if(action==='cancel')act(()=>active.cancel());
  else if(action==='replace')scenario.replace();
  else view.unmount();
  await advance(1500);expect(open).not.toHaveBeenCalled();expect(scenario.legacyHandoff).not.toHaveBeenCalled();
  if(action!=='unmount')expect(screen.getByTestId('phase')).toHaveTextContent('idle');
 });
 it('cancels a pending check from the overlay, ignores its late result, and restores original focus',async()=>{
  const prepared=deferred<RecheckResult>();scenario.prepareReferral.mockReturnValueOnce(prepared.promise);
  const open=vi.spyOn(window,'open').mockReturnValue(tab());render(<App/>);const trigger=screen.getByRole('button',{name:'ادامه مقایسه'});trigger.focus();
  fireEvent.click(trigger);await advance(50);expect(screen.getByRole('dialog',{name:'انتقال به فروشنده'})).toContainElement(document.activeElement as HTMLElement);
  fireEvent.click(screen.getByRole('button',{name:'بازگشت به مقایسه'}));await act(async()=>prepared.resolve(scenario.prepared));await advance(1000);
  expect(open).not.toHaveBeenCalled();expect(scenario.confirmReferral).not.toHaveBeenCalled();expect(screen.getByTestId('phase')).toHaveTextContent('idle');expect(trigger).toHaveFocus();
 });
 it('clears its request deadline on unmount even when the client never settles after abort',async()=>{
  scenario.prepareReferral.mockImplementationOnce(()=>new Promise(()=>{}));
  const set=vi.spyOn(globalThis,'setTimeout'),clear=vi.spyOn(globalThis,'clearTimeout'),open=vi.spyOn(window,'open').mockReturnValue(tab());
  const view=render(<App/>);await start();const deadline=set.mock.calls.findIndex(call=>call[1]===8000);expect(deadline).toBeGreaterThanOrEqual(0);
  const timer=set.mock.results[deadline]!.value,signal=scenario.prepareReferral.mock.calls[0]?.[1];view.unmount();await act(async()=>{});
  expect(signal?.aborted).toBe(true);expect(clear).toHaveBeenCalledWith(timer);await advance(9000);expect(open).not.toHaveBeenCalled();expect(scenario.confirmReferral).not.toHaveBeenCalled();
 });
 it.each(['unavailable','failed','wrong-receipt'] as const)('never opens a tab after %s evidence',async failure=>{
  if(failure==='unavailable')scenario.prepareReferral.mockResolvedValueOnce({status:'unavailable',reason:'OFFER_UNAVAILABLE',retryable:false,alternativeQuoteIds:[]});
  if(failure==='failed')scenario.prepareReferral.mockRejectedValueOnce(Error('offline'));
  if(failure==='wrong-receipt')scenario.confirmReferral.mockResolvedValueOnce({...scenario.receipt,intentId:'other-intent'});
  const open=vi.spyOn(window,'open').mockReturnValue(tab());render(<App/>);await start();await advance(1500);
  expect(open).not.toHaveBeenCalled();expect(scenario.legacyHandoff).not.toHaveBeenCalled();expect(screen.queryByRole('dialog',{name:'انتقال به فروشنده'})).not.toBeInTheDocument();
 });
 it('recovers uncertain confirmation using its original idempotency input before allowing one external handoff',async()=>{
  scenario.confirmReferral.mockRejectedValueOnce(Error('response lost'));const open=vi.spyOn(window,'open').mockReturnValue(tab());render(<App/>);await start();
  const input=scenario.confirmReferral.mock.calls[0]?.[0];expect(screen.getByTestId('phase')).toHaveTextContent('retry-confirm');expect(open).not.toHaveBeenCalled();
  await act(async()=>{void active.retryConfirm();});await advance(720);expect(scenario.confirmReferral.mock.calls[1]?.[0]).toEqual(input);expect(scenario.prepareReferral).toHaveBeenCalledTimes(1);expect(open).toHaveBeenCalledTimes(1);await advance(180);
 });
 it('uses static motion when reduced and refuses hidden-document navigation until a visible retry gesture',async()=>{
  vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}));
  const hidden=vi.spyOn(document,'visibilityState','get').mockReturnValue('visible'),open=vi.spyOn(window,'open').mockReturnValue(tab());render(<App/>);await start();
  expect(document.querySelector('[data-handoff-motion="static"]')).toBeInTheDocument();hidden.mockReturnValue('hidden');act(()=>document.dispatchEvent(new Event('visibilitychange')));await advance(720);
  expect(open).not.toHaveBeenCalled();expect(screen.getByTestId('phase')).toHaveTextContent('handoff-error');
  hidden.mockReturnValue('visible');act(()=>document.dispatchEvent(new Event('visibilitychange')));fireEvent.click(screen.getByRole('button',{name:'باز کردن صفحه فروشنده'}));expect(open).toHaveBeenCalledTimes(1);await act(async()=>{});expect(screen.getByTestId('phase')).toHaveTextContent('idle');
 });
});
