import {SearchRecovery} from '../recovery/search-recovery';
import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import type { CatalogSnapshot, Itinerary, QuoteSnapshot, SearchSnapshot, SortOrder, TransportSearchQuery } from '@torob-ticket/contracts';
import {Button, SegmentedControl,displayProviderName,MotionSurface,ProviderDelayIllustration} from '@torob-ticket/ui';
import { JourneyCard } from './journey-card';
import { ResultFilters } from './result-filters';
import { hasStagedUpdates, quoteStatus, resolveSuggestion, selectedQuote, type QuoteSelection, type ResultsState } from './results-reducer';
import { createScrollAnchor } from './scroll-anchor';
import { useResults } from './use-results';
import { localDay, minutes, number, toman, travelerCount } from './format';
import styles from './results.module.css';
export interface ResultsEvidence {state:ResultsState;select:(selection:QuoteSelection)=>void}
export interface ResultsPageProps {historical?:boolean;onFreshSearch?:()=>void;onResume?:()=>void;onSessionExpired?:()=>void;onClearFilter?:(key:keyof TransportSearchQuery['filters'])=>void;onEditDate?:()=>void; onRestoreReady?:()=>void; selectedAction?:{quoteId:string;node:ReactNode}; evidenceRef?:MutableRefObject<ResultsEvidence|undefined>;restore?:Pick<ResultsState,'frozen'|'selected'|'dismissedSuggestion'>; isCurrent: () => boolean; isSelectionCurrent?: () => boolean; generation: string; searchId: string; query: TransportSearchQuery; catalog: CatalogSnapshot; refinementDisabled: boolean; draftChanged: boolean; onRefine: (query: TransportSearchQuery) => void; onEdit: () => void; enterResults?: boolean; onPreviewItinerary?: (itinerary?: Itinerary,source?:'hover'|'focus',leavingId?:string) => void; onPinItinerary?: (itinerary: Itinerary) => void; onSelectQuote?: (quote?: QuoteSnapshot, itinerary?: Itinerary, selectionIntent?: QuoteSelection) => void }
function Coverage({ snapshot }: { snapshot: SearchSnapshot }) { const coverage = snapshot.coverage; return <div className={styles.coverage} aria-label="پوشش فروشندگان"><span>{number(coverage.successfulProviderIds.length)} از {number(coverage.expectedProviderIds.length)} فروشنده پاسخ داده‌اند{snapshot.status === 'collecting' ? ' · تا این لحظه' : ''}</span>{coverage.pendingProviderIds.length > 0 && <span>{number(coverage.pendingProviderIds.length)} در حال بررسی</span>}{coverage.failedProviderIds.length > 0 && <span className={styles.invalid}>{number(coverage.failedProviderIds.length)} پاسخ ناموفق یا در دسترس نیست</span>}<small>مقایسه بر اساس پاسخ فروشندگان همین جست‌وجو است.</small></div>; }
export function ResultsList(props: ResultsPageProps) {
 const { generation, searchId, query, catalog } = props;
 const { state, dispatch, connectionError,connectionState,error,retryRead } = useResults(generation,searchId,query,undefined,undefined,props.restore);
 const region = useRef<HTMLElement>(null); const heading = useRef<HTMLHeadingElement>(null); const entered = useRef(false);
 const snapshot = state.adopted?.snapshot; const latest = state.latest?.snapshot;
 const stateRef = useRef(state); stateRef.current = state;
 const mounted = useRef(true); const outward = useRef(props); outward.current = props;
 function ownsCurrent() { return mounted.current && outward.current.isCurrent(); }
 function canSelect() { return ownsCurrent() && !outward.current.historical && !outward.current.draftChanged && (outward.current.isSelectionCurrent?.() ?? true); }
 const [scrollAnchor] = useState(()=>createScrollAnchor({measure:id=>!ownsCurrent() ? undefined : Array.from(region.current?.querySelectorAll<HTMLElement>('[data-group-id]') ?? []).find(card=>card.dataset.groupId===id)?.getBoundingClientRect().top,adjust:delta=>{if(ownsCurrent()) window.scrollBy({top:delta,behavior:'instant'});},frame:callback=>requestAnimationFrame(callback),cancelFrame:id=>cancelAnimationFrame(id)}));
 useLayoutEffect(()=>{if(ownsCurrent()) scrollAnchor.layout();else scrollAnchor.cancel();},[state.adopted,scrollAnchor]);
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;scrollAnchor.cancel();};},[scrollAnchor]);
 useEffect(()=>{if(connectionState==='expired')outward.current.onSessionExpired?.();},[connectionState]);
 const renderedAt = Date.now();
 const selected = selectedQuote(state,renderedAt);
 useEffect(() => { if(canSelect()) outward.current.onSelectQuote?.(selected, selected ? snapshot?.groups.find(group => group.itinerary.itineraryId === selected.itineraryId)?.itinerary : undefined,state.selected); }, [selected, snapshot,state.selected]);
 useEffect(() => {
  if (!ownsCurrent() || !props.enterResults || entered.current || !snapshot) return;
  entered.current = true;
  heading.current?.focus({ preventScroll:true }); heading.current?.scrollIntoView({ block:'start', behavior:'instant' });
 }, [props.enterResults,snapshot]);
 useEffect(() => {
  const freeze = () => {
   scrollAnchor.cancel();
   if(!ownsCurrent()) return;
   const rect = region.current?.getBoundingClientRect();
   if (rect && rect.top < window.innerHeight && rect.bottom > 0) dispatch({ type:'freeze' });
  };
  const wheel = (event: WheelEvent) => { if (Math.abs(event.deltaY) > 0) freeze(); };
  const touch = () => freeze();
  const keyboard = (event: KeyboardEvent) => { scrollAnchor.cancel(); if (['PageDown','PageUp','Home','End','ArrowDown','ArrowUp',' '].includes(event.key) && event.target instanceof HTMLElement && (event.target === document.body || region.current?.contains(event.target))) freeze(); };
  window.addEventListener('wheel',wheel,{ passive:true }); window.addEventListener('touchmove',touch,{ passive:true }); window.addEventListener('keydown',keyboard);
  // Native scrollbar interaction does not generate wheel/touch events.
  const pointer = (event: PointerEvent) => { scrollAnchor.cancel(); if (event.clientX >= document.documentElement.clientWidth) freeze(); };
  window.addEventListener('pointerdown',pointer);
  return () => { window.removeEventListener('wheel',wheel); window.removeEventListener('touchmove',touch); window.removeEventListener('keydown',keyboard); window.removeEventListener('pointerdown',pointer); };
 }, []);
 function select(selection: QuoteSelection) {
  if (!canSelect() || quoteStatus(stateRef.current,selection,Date.now()) !== 'current') return;
  dispatch({ type:'select',selection,now:Date.now() });
  const matched=stateRef.current.adopted?.snapshot.groups.find(group => group.groupId === selection.groupId);const itinerary=matched?.itinerary; if (itinerary && canSelect()){outward.current.onPinItinerary?.(itinerary);outward.current.onSelectQuote?.(matched?.eligibleQuotes.find(q=>q.quoteId===selection.quoteId&&q.version===selection.version),itinerary,selection);}
 }
 function adopt() {
  if(!ownsCurrent()) {scrollAnchor.cancel();return;}
  const cards = Array.from(region.current?.querySelectorAll<HTMLElement>('[data-group-id]') ?? []);
  const anchor = cards.find(card => card.getBoundingClientRect().bottom > 0);
  scrollAnchor.capture(anchor?.dataset.groupId ? { id:anchor.dataset.groupId,top:anchor.getBoundingClientRect().top } : undefined);
  dispatch({ type:'adopt' });
 }

 if(props.evidenceRef)props.evidenceRef.current={state,select};
 const restoredLayout=useRef(false);
 useLayoutEffect(()=>{if(!restoredLayout.current&&props.restore&&snapshot&&ownsCurrent()){restoredLayout.current=true;outward.current.onRestoreReady?.();}},[snapshot,props.restore]);
 const revealedSelection=useRef(props.restore?.selected);
 useLayoutEffect(()=>{if(!state.selected||revealedSelection.current===state.selected||props.selectedAction?.quoteId!==state.selected.quoteId||!canSelect())return;const action=region.current?.querySelector<HTMLButtonElement>('[data-referral-source=transport] button');if(!action||action.disabled)return;revealedSelection.current=state.selected;action.focus({preventScroll:true});action.scrollIntoView({block:'nearest',behavior:'instant'});},[state.selected,props.selectedAction?.quoteId]);
 const resolvedSuggestion = resolveSuggestion(state,renderedAt);
 const suggestion = resolvedSuggestion?.suggestion; const suggestionTarget = resolvedSuggestion?.target;
 return <section ref={region} className={styles.results} aria-label="نتایج مقایسه سفر" data-historical={Boolean(props.historical)} data-connection-state={connectionState} data-search-id={searchId} data-generation={generation} data-status={latest?.status ?? 'loading'} data-sequence={state.latest?.sequence ?? 0} data-frozen={state.frozen}>
  <header className={styles.resultsHead}><div><span className={styles.eyebrow}>پیشنهادهای همین سفر</span><h2 ref={heading} tabIndex={-1}>مقایسه {query.mode === 'flight' ? 'پروازها' : query.mode === 'train' ? 'قطارها' : 'اتوبوس‌ها'}</h2><p>{catalog.cities.find(city => city.id === query.originCityId)?.name} به {catalog.cities.find(city => city.id === query.destinationCityId)?.name} · {localDay(query.departureDate+'T12:00:00Z','UTC')} · {number(travelerCount(query))} مسافر · {query.tripType === 'round-trip' ? 'مجموع کامل رفت‌وبرگشت' : 'یک‌طرفه'}</p></div><Button variant="quiet" onPress={() => {if(ownsCurrent()) props.onEdit();}}>ویرایش سفر</Button></header>
  {props.draftChanged && <p role="status" className={styles.notice}>فرم سفر تغییر کرده؛ این نتایج برای سفر ثبت‌شده بالاست. برای انتخاب پیشنهاد، مرتب‌سازی و فیلتر، ابتدا سفر ویرایش‌شده را جست‌وجو کنید.</p>}
  <div className={styles.toolbar}><SegmentedControl label="مرتب‌سازی پیشنهادها" value={query.sort} isDisabled={props.refinementDisabled} onChange={value => {if(ownsCurrent()) props.onRefine({ ...query,sort:value as SortOrder });}} options={[{id:'cheapest',label:'ارزان‌ترین'},{id:'fastest',label:'سریع‌ترین'},{id:'fewest-connections',label:query.mode === 'flight' ? 'کم‌توقف‌ترین' : 'کمترین تعویض'}]}/>{snapshot && <ResultFilters isCurrent={ownsCurrent} query={query} snapshot={snapshot} catalog={catalog} disabled={props.refinementDisabled} onApply={value => {if(ownsCurrent()) props.onRefine(value);}}/>}</div>
  {latest && <Coverage snapshot={latest}/>}
  {props.historical&&<p role="status" className={styles.notice}>این شواهد برای تنظیمات قبلی است؛ انتخاب و ادامه نیاز به مقایسه تازه دارد. شرایط فرم شما حفظ شده است.</p>}
  {!props.historical&&(connectionError||snapshot&&snapshot.status!=='collecting'&&snapshot.groups.length>0&&snapshot.groups.every(g=>g.eligibleQuotes.length===0)||['snapshot-only','expired','unavailable'].includes(connectionState)||latest&&['partial','interrupted','failed','cancelled'].includes(latest.status)&&Boolean(snapshot?.groups.length)||snapshot?.groups.some(g=>g.eligibleQuotes.length)&&snapshot.groups.flatMap(g=>g.eligibleQuotes).every(q=>Date.parse(q.expiresAt)<=renderedAt))&&<SearchRecovery query={query} catalog={catalog} status={latest?.status} historical={props.historical} expired={connectionState==='expired'} quoteExpired={Boolean(snapshot?.groups.some(g=>g.eligibleQuotes.length)&&snapshot.groups.flatMap(g=>g.eligibleQuotes).every(q=>Date.parse(q.expiresAt)<=renderedAt))} error={error} connection={connectionState} onFresh={props.historical||connectionState!=='expired'?props.onFreshSearch:undefined} onRead={retryRead} onEdit={props.onEdit} onDate={props.onEditDate} onResume={props.onResume} onClearFilter={props.draftChanged?undefined:props.onClearFilter}/>}
  {hasStagedUpdates(state) && <div className={styles.updates} role="status"><div><strong>نتایج به‌روز در دسترس است</strong><span>{number(Math.max(0,(latest?.groups.length ?? 0)-(snapshot?.groups.length ?? 0)))} مسیر تازه · {number(latest?.groups.reduce((sum,group) => sum+group.eligibleQuotes.length,0) ?? 0)} پیشنهاد معتبر در آخرین دریافت</span><small>ترتیب و شرایطی که بررسی می‌کنید حفظ شده است.</small></div><Button variant="secondary" onPress={adopt}>اعمال نتایج تازه</Button></div>}
  {suggestion && suggestionTarget && <aside className={styles.suggestion} aria-label="پیشنهاد جایگزین"><div><strong>{minutes(suggestion.delta.minutes)} زودتر برسید</strong><p>{suggestion.delta.amountRial > 0 ? `${toman(suggestion.delta.amountRial)} بیشتر` : suggestion.delta.amountRial < 0 ? `${toman(-suggestion.delta.amountRial)} کمتر` : 'با همان مبلغ'} نسبت به کم‌قیمت‌ترین پیشنهاد کامل همین جست‌وجو</p></div><Button variant="quiet" onPress={() => { if(!ownsCurrent() || !resolveSuggestion(stateRef.current,Date.now())) return; dispatch({type:'freeze'}); const card = Array.from(region.current?.querySelectorAll<HTMLElement>('[data-group-id]') ?? []).find(node => node.dataset.groupId === suggestionTarget.group.groupId); card?.querySelector<HTMLElement>('button')?.focus(); card?.scrollIntoView({block:'center'}); }}>نمایش مسیر پیشنهادی</Button><Button variant="quiet" aria-label="بستن پیشنهاد جایگزین" onPress={() => {if(ownsCurrent()) dispatch({type:'dismiss-suggestion'});}}>×</Button></aside>}
  {state.selected && !props.draftChanged && !props.historical && <div className={selected ? styles.selection : styles.invalid} role="status">{selected ? `پیشنهاد ${displayProviderName(catalog.providerCapabilities.find(p=>p.providerId===selected.providerId))} برای مقایسه انتخاب شد · ${toman(selected.total.amountRial)} برای همه مسافران.` : 'پیشنهاد انتخاب‌شده دیگر معتبر نیست؛ برای ادامه نتایج تازه را بررسی یا دوباره جست‌وجو کنید.'}</div>}
  {!snapshot&&error?null:!snapshot || snapshot.status === 'collecting' && snapshot.groups.length === 0 ? <div role="status" className={styles.empty}><ProviderDelayIllustration mode={query.mode} size="compact"/><h3>در حال دریافت پیشنهادهای فروشندگان…</h3><p>به محض آماده شدن، پیشنهادهای قابل مقایسه نمایش داده می‌شوند.</p></div> : snapshot.groups.length > 0 ? <MotionSurface purpose="content" motionKey={generation+'/'+searchId} className={styles.list} role="list" aria-label="مسیرها و پیشنهادهای مقایسه‌شده">{snapshot.groups.map(group => <div role="listitem" key={group.groupId}><JourneyCard selectionDisabled={!canSelect()} continuation={canSelect()&&state.selected?.groupId===group.groupId&&props.selectedAction?.quoteId===state.selected.quoteId?props.selectedAction.node:undefined} group={group} snapshot={snapshot} catalog={catalog} state={state} now={renderedAt} onFreeze={() => {if(ownsCurrent()) dispatch({type:'freeze'});}} onSelect={select} onPreviewItinerary={(itinerary,source,leavingId) => {if(canSelect()) outward.current.onPreviewItinerary?.(itinerary,source,leavingId);}}/></div>)}</MotionSurface> : props.historical?<p role="status">در شواهد قبلی پیشنهاد قابل نمایش دریافت نشده است.</p>:<SearchRecovery query={query} catalog={catalog} status={snapshot.status} onFresh={props.onFreshSearch} onEdit={props.onEdit} onDate={props.onEditDate} onClearFilter={props.draftChanged?undefined:props.onClearFilter}/>}
  {latest && ['partial','interrupted'].includes(latest.status) && snapshot?.groups.length !== 0 && <p className={styles.notice}>فقط پیشنهادهای دریافت‌شده نمایش داده شده‌اند؛ پوشش این جست‌وجو کامل و موفق نیست.</p>}
 </section>;
}
export function ResultsPage(props: ResultsPageProps) { return <ResultsList key={props.generation+'/'+props.searchId} {...props}/>; }
