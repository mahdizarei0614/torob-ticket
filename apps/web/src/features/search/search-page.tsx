import {SearchRecovery} from '../recovery/search-recovery';
import {useSessionSync,sessionRevision,type RetainedSearchLease} from './use-session-sync';
import {HotelEntry} from '../hotels/hotel-entry';
import {AccountPanel} from '../account/account-panel';
import { useState,useRef,useLayoutEffect,useEffect } from 'react';
import { GraphicsProvider, type GraphicsController } from '@torob-ticket/graphics/host';
import {useReferralController,type ReferralSource} from '../referral/referral-controller';
import {ProviderAction,ReferralDialog} from '../referral/referral-dialog';
import type {ReturnCheckpoint} from '../referral/return-checkpoint';
import type {HydratedReturn} from '../referral/return-hydration';
import {serializeSearchUrl} from './search-url';
import { ResultsPage,type ResultsEvidence } from '../results/results-page';
import { TripMap, MobileRoutePanel, useDesktopMap } from '../map/trip-map';
import { useTripMap } from '../map/use-trip-map';
import { DateExplorer } from '../dates/date-explorer';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@torob-ticket/client';
import { Button, ThemeProvider, useTheme, displayProviderName, MotionPolicyProvider } from '@torob-ticket/ui';
import type { CatalogSnapshot, SessionInfo, HotelQuoteSnapshot, ReferralReceipt, TransportSearchQuery } from '@torob-ticket/contracts';
import { DemoMenu } from '../demo/demo-menu';
import { SearchComposer } from './search-composer';
import { errorMessage, useSearchController } from './use-search-controller';
import styles from './search.module.css';
function AppearanceButton() {
  const theme = useTheme();
  return <Button variant="quiet" aria-label={theme.appearance === 'dark' ? 'نمای روشن' : 'نمای تیره'} onPress={event => theme.setPreference(theme.appearance === 'dark' ? 'light' : 'dark', event.target as HTMLElement)}>{theme.appearance === 'dark' ? '☀' : '☾'}</Button>;
}
interface ConsumerRecoveryProps {onRetainedSource?:(source:RetainedSearchLease|undefined)=>void;sessionEpoch?:number;sessionExpired?:boolean;sessionBusy?:boolean;sessionError?:unknown;onSessionCheck?:()=>void;onResume?:()=>void;onSessionExpired?:()=>void}
interface SearchPageProps {covered?:boolean;themeActive?:boolean;onHandoff?:(receipt:ReferralReceipt,checkpoint:ReturnCheckpoint)=>void;restore?:HydratedReturn;onRestoreReady?:(value:HydratedReturn,ready:boolean)=>void}
function Consumer({ catalog, session,covered:providerCovered=false,themeActive=true,onHandoff,restore,onRestoreReady,sessionEpoch=0,sessionExpired=false,sessionBusy=false,sessionError,onSessionCheck,onResume,onSessionExpired,onRetainedSource }: { catalog: CatalogSnapshot; session: SessionInfo }&SearchPageProps&ConsumerRecoveryProps) {
  const cache=useQueryClient();const [restoreSeed]=useState(()=>{if(restore)cache.setQueryData(['search',restore.recovery.snapshot.clientGeneration,restore.recovery.snapshot.searchId],restore.recovery);return restore;});
  const controller = useSearchController(catalog, session,undefined,restoreSeed?{recovery:restoreSeed.recovery,draft:restoreSeed.checkpoint.draft}:undefined);
  const { state } = controller;
  onRetainedSource?.(state.searchId&&state.generation&&state.committed&&controller.resultIsCurrent(state.generation,state.searchId)?{searchId:state.searchId,generation:state.generation,query:state.committed,isCurrent:()=>controller.resultIsCurrent(state.generation!,state.searchId!)}:undefined);const graphicsControllerRef=useRef<GraphicsController|null>(null);const reconciled=useRef(sessionEpoch);
  useLayoutEffect(()=>{if(reconciled.current!==sessionEpoch){reconciled.current=sessionEpoch;controller.reconcileAuthority();}},[sessionEpoch]);
  useEffect(()=>{if(controller.lastError&&typeof controller.lastError==='object'&&'api' in controller.lastError&&(controller.lastError.api as {code?:string}|undefined)?.code==='SESSION_EXPIRED')onSessionExpired?.();},[controller.lastError,onSessionExpired]);
  const historical=!controller.authorityCurrent;
  function editForm(){const form=document.querySelector<HTMLFormElement>('form');form?.scrollIntoView({block:'start'});form?.querySelector<HTMLElement>('input,button')?.focus({preventScroll:true});}
  function editDate(){const region=document.querySelector<HTMLElement>('[aria-label="کاوش تاریخ سفر"]');region?.scrollIntoView({block:'center'});region?.querySelector<HTMLElement>('button')?.focus({preventScroll:true});}
  function clearFilter(key:keyof TransportSearchQuery['filters']){const draft=controller.currentIntent().draft,filters={...draft.filters};delete filters[key];controller.edit({filters});void controller.submit({...draft,filters},true);}
  const map=useTripMap(controller,catalog);const desktop=useDesktopMap();const [mapMotion,setMapMotion]=useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);const [accountOpen,setAccountOpen]=useState(false);const [hotelOpen,setHotelOpen]=useState(false);const [hotelQuote,setHotelQuote]=useState<HotelQuoteSnapshot|undefined>();const covered=providerCovered||calendarOpen||accountOpen||hotelOpen;
  const [dateInteracting, setDateInteracting] = useState(false);
  const evidence=useRef<ResultsEvidence|undefined>(undefined),hotelCheckpoint=useRef<ReturnCheckpoint['hotel']>(restoreSeed?.checkpoint.hotel);const transportReceipt=useRef<string|undefined>(restoreSeed?.transportReceipt?.referralId);const hotelOriginScroll=useRef<number|undefined>(restoreSeed?.hotel?.open?restoreSeed.checkpoint.scrollY:undefined);
  const restoredOnce=useRef(false);
  useLayoutEffect(()=>{if(!restoreSeed||restoredOnce.current)return;restoredOnce.current=true;const cp=restoreSeed.checkpoint;const pin=restoreSeed.recovery.snapshot.groups.find(g=>g.itinerary.itineraryId===cp.pinItineraryId)?.itinerary;const original=restoreSeed.transportOrigin?.quote??(cp.selected?restoreSeed.recovery.snapshot.groups.find(g=>g.groupId===cp.selected?.groupId)?.eligibleQuotes.find(q=>q.quoteId===cp.selected?.quoteId&&q.version===cp.selected?.version):undefined);map.restoreUi({pin,origin:original,receipt:restoreSeed.transportReceipt,intent:cp.selected,direction:cp.direction,camera:cp.camera});},[restoreSeed]);
  const restoreSettled=useRef(false);
  function settleRestore(){if(!restoreSeed||restoreSettled.current)return;const now=controller.currentIntent();const ready=!controller.resetting&&now.intentRevision===0&&now.searchId===restoreSeed.recovery.snapshot.searchId&&now.generation===restoreSeed.recovery.snapshot.clientGeneration;restoreSettled.current=true;onRestoreReady?.(restoreSeed,ready);}
  useLayoutEffect(()=>{if(restoreSeed&&!restoreSettled.current&&(controller.resetting||state.intentRevision!==0||state.searchId!==restoreSeed.recovery.snapshot.searchId||state.generation!==restoreSeed.recovery.snapshot.clientGeneration))settleRestore();},[controller.resetting,state.intentRevision,state.searchId,state.generation]);
  const restoredResults=restoreSeed&&state.intentRevision===0&&state.searchId===restoreSeed.recovery.snapshot.searchId&&state.generation===restoreSeed.recovery.snapshot.clientGeneration?restoreSeed.checkpoint:undefined;
  function capture(receipt:ReferralReceipt):ReturnCheckpoint|undefined{
   const result=evidence.current?.state,search=controller.currentIntent(),mapState=map.readState();if(!result?.adopted||!search.searchId||!search.generation||!search.committed)return undefined;
   return {version:1,referralId:receipt.referralId,returnSearch:serializeSearchUrl(search.committed),searchId:search.searchId,generation:search.generation,draft:search.draft,adoptedSequence:result.adopted.sequence,frozen:result.frozen,dismissedSuggestion:result.dismissedSuggestion,selected:result.selected,pinItineraryId:mapState.pin?.itinerary.itineraryId,direction:mapState.direction,camera:map.readCamera(),scrollY:receipt.payload.kind==='hotel'&&hotelCheckpoint.current?.open?(hotelOriginScroll.current??window.scrollY):window.scrollY,transportReferralId:mapState.receipt?.referralId,hotel:hotelCheckpoint.current};
  }
  const flow=useReferralController({enabled:!controller.resetting&&!providerCovered&&!sessionExpired&&controller.authorityCurrent,onHandoff:(receipt)=>{const checkpoint=capture(receipt);if(!checkpoint||!onHandoff)throw Error('return-context-unavailable');onHandoff(receipt,checkpoint);}});
  function transportSource():ReferralSource|undefined{
   const lease=map.referralLease();if(!lease)return undefined;
   return {key:'transport/'+lease.key,payload:{kind:'transport',quote:lease.quote,itinerary:lease.itinerary},isCurrent:lease.isCurrent,accept:fresh=>fresh.kind==='transport'&&Boolean(lease.accept(fresh.quote,fresh.itinerary)),confirmed:receipt=>{const okay=Boolean(lease.confirmed(receipt));if(okay)transportReceipt.current=receipt.referralId;return okay;},refresh:()=>{const query=controller.currentIntent().committed;if(query)void controller.submit(query,true);},alternatives:()=>evidence.current?.state.adopted?.snapshot.groups.flatMap(g=>g.eligibleQuotes.filter(q=>q.quoteId!==lease.quote.quoteId).map(q=>({quoteId:q.quoteId,label:`${displayProviderName(catalog.providerCapabilities.find(p=>p.providerId===q.providerId))} · ${q.total.amountRial/10} تومان برای همه مسافران`,select:()=>{evidence.current?.select({groupId:g.groupId,quoteId:q.quoteId,version:q.version});return transportSource();}})))??[]};
  }
  const selectedSource=transportSource();
  const cityName = (id: string) => catalog.cities.find(c => c.id === id)?.name ?? 'انتخاب نشده';
  return <ThemeProvider onThemeApplied={()=>graphicsControllerRef.current?.flushTheme()??Promise.resolve()} active={themeActive} language="fa" mode={state.draft.mode}><GraphicsProvider controllerRef={graphicsControllerRef} covered={covered||flow.state.phase!=='idle'} motion={mapMotion}><MotionPolicyProvider covered={covered||flow.state.phase!=='idle'}><main lang="fa" dir="rtl" className={styles.shell} data-session-expired={sessionExpired} data-authority-current={controller.authorityCurrent&&!sessionExpired} data-authority-revision={controller.authorityVersion} data-pinned-itinerary={state.pinnedItineraryId} data-preview-itinerary={state.previewItineraryId} data-selected-hotel-quote={hotelQuote?.quoteId}>
    <TripMap map={map} catalog={catalog} desktop={desktop} covered={covered||flow.state.phase!=='idle'} onMotionChange={setMapMotion}/>
    <div className={styles.content}><header className={styles.header}><a className={styles.brand} href="/" aria-label="ترب تیکت، خانه">ترب<span>تیکت</span><small>مقایسه سفر</small></a><div className={styles.headerActions}><AppearanceButton /><AccountPanel controller={controller} catalog={catalog} session={session} onCovered={setAccountOpen}/></div></header>
      <section className={styles.intro}><span className={styles.eyebrow}>مسیر خودت را پیدا کن</span><h1>سفر بعدی از کجا شروع می‌شود؟</h1><p>پرواز، قطار یا اتوبوس؛ شرایط سفر را کنار هم ببینید.</p></section>
      <SearchComposer draft={state.draft} catalog={catalog} session={session} edit={controller.edit} onSubmit={() => { void controller.submit(undefined,true); }} errors={controller.validity.errors} pending={controller.pending} disabled={controller.resetting || controller.startLimitReached || dateInteracting} dateExplorer={<DateExplorer interaction={controller.dateInteractions} draft={state.draft} catalog={catalog} session={session} onCommit={controller.commitDates} onPreview={date => controller.dispatch({ type: 'preview-date', date })} onCovered={setCalendarOpen} onInteractionChange={setDateInteracting} disabled={controller.resetting||sessionExpired} waiting={controller.waitingDate} />} />
      <div aria-live="polite" className={styles.feedback}>{restoreSeed?.hotelNotice&&<p role="status">{restoreSeed.hotelNotice}</p>}{dateInteracting && <p role="status">انتخاب روز در حال تنظیم است؛ با رها کردن، همان تاریخ جست‌وجو می‌شود.</p>}{controller.capacityMessage && <p role="status">{controller.capacityMessage}</p>}{state.notice && <p role="status">{state.notice}</p>}{controller.feedback && <p role="alert" className={styles.error}>{controller.feedback}</p>}{controller.accepted && <p role="status">درخواست جست‌وجو برای {cityName(state.committed?.originCityId ?? '')} به {cityName(state.committed?.destinationCityId ?? '')} ثبت شد.</p>}</div>
      {(historical||sessionExpired||controller.lastError||sessionError||(!controller.validity.valid&&Boolean(state.notice)))&&<SearchRecovery query={state.draft} catalog={catalog} historical={historical&&!sessionExpired} expired={sessionExpired} error={controller.lastError??sessionError} onRead={onSessionCheck} connection={sessionError?'unavailable':undefined} busy={sessionBusy||controller.pending} onResume={onResume} onFresh={sessionExpired?undefined:()=>{void controller.submit(undefined,true);}} onDate={editDate} onEdit={editForm} onRoute={(originCityId,destinationCityId)=>controller.edit({originCityId,destinationCityId})} onClearFilter={sessionExpired?undefined:clearFilter}/>}
      {!desktop&&<MobileRoutePanel map={map} catalog={catalog}/>}
      <HotelEntry authorityKey={sessionRevision(session)+'/'+controller.authorityVersion} blocked={sessionExpired} onResume={onResume} onSessionExpired={onSessionExpired} onOriginScroll={value=>{hotelOriginScroll.current=value;}} flow={flow} restore={restoreSeed?.hotel} onCheckpoint={value=>{hotelCheckpoint.current=value;}} controller={controller} map={map} catalog={catalog} session={session} onCovered={setHotelOpen} onSelectHotelQuote={setHotelQuote}/>
      {state.searchId && state.committed && state.generation && <ResultsPage historical={historical||sessionExpired} onFreshSearch={()=>{void controller.submit(undefined,true);}} onResume={onResume} onSessionExpired={onSessionExpired} onClearFilter={clearFilter} onEditDate={editDate} onRestoreReady={restoredResults?settleRestore:undefined} selectedAction={selectedSource?{quoteId:selectedSource.payload.quote.quoteId,node:<ProviderAction compact source={selectedSource} flow={flow} catalog={catalog}/ >}:undefined} evidenceRef={evidence} restore={restoredResults} isCurrent={() => controller.resultIsCurrent(state.generation!,state.searchId!)} generation={state.generation} searchId={state.searchId} query={state.committed} catalog={catalog} refinementDisabled={!controller.canRefineResults || controller.pending || controller.resetting || controller.startLimitReached || dateInteracting} draftChanged={!controller.canRefineResults} enterResults={controller.enterResults} onRefine={query => controller.refineResults(query,state.generation!,controller.refinementToken)} onEdit={() => { const form = document.querySelector<HTMLFormElement>('form'); form?.scrollIntoView({block:'start'}); form?.querySelector<HTMLElement>('input,button')?.focus({preventScroll:true}); }} onPreviewItinerary={map.preview} onPinItinerary={map.pin} onSelectQuote={map.selection} />}
      <ReferralDialog flow={flow} catalog={catalog}/>
      <footer className={styles.footer}><DemoMenu catalog={catalog} session={session} onPreset={controller.preset} /></footer>
    </div>
  </main></MotionPolicyProvider></GraphicsProvider></ThemeProvider>;
}
export function SearchPage(props:SearchPageProps={}) {
  const bootstrap = useQuery({ queryKey: ['consumer-bootstrap'], queryFn: async ({ signal }) => { const session = await apiClient.session(); const catalog = await apiClient.catalog(signal); return { session: apiClient.sessionSnapshot() ?? session, catalog }; }, staleTime: Infinity, retry: false, refetchOnWindowFocus: false });
  const retainedSource=useRef<RetainedSearchLease|undefined>(undefined);
  const sync=useSessionSync(bootstrap.data?.session,!props.covered,()=>retainedSource.current);
  if (!bootstrap.data) return <ThemeProvider active={props.themeActive} mode={props.restore?.checkpoint.draft.mode} language="fa"><main lang="fa" dir="rtl" className={styles.loading}><h1>ترب تیکت</h1><p>مقایسه بلیت پرواز، قطار و اتوبوس</p><p role={bootstrap.error ? 'alert' : 'status'}>{bootstrap.error ? errorMessage(bootstrap.error) : 'در حال آماده‌سازی مسیرهای سفر…'}</p>{bootstrap.error && <Button onPress={() => { void bootstrap.refetch(); }}>تلاش دوباره</Button>}</main></ThemeProvider>;
  return <Consumer onRetainedSource={source=>{retainedSource.current=source;}} sessionEpoch={sync.revision} sessionExpired={sync.expired} sessionBusy={sync.resuming} sessionError={sync.error} onSessionCheck={sync.refresh} onResume={()=>{void sync.resume?.();}} onSessionExpired={sync.reportExpired} catalog={bootstrap.data.catalog} session={bootstrap.data.session} {...props} restore={sync.revision?undefined:props.restore} />;
}
