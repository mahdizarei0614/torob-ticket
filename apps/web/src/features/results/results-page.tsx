import {SearchRecovery} from '../recovery/search-recovery';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import type { CatalogSnapshot, ComparisonGroup, Itinerary, QuoteSnapshot, SearchSnapshot, SortOrder, TransportSearchQuery } from '@torob-ticket/contracts';
import {Button, CloseButton, MotionText, SegmentedControl,priceBand,priceRange,useMotionPolicy} from '@torob-ticket/ui';
import { ResultPresence, ResultsPresence, ResultsSkeleton } from './result-motion';
import { ResultRow } from './result-row';
import { priceCardId, priceCards } from './price-cards';
import { ResultFilters } from './result-filters';
import { ResultEmptyState } from './result-empty-state';
import { hasStagedUpdates, quoteStatus, resolveSuggestion, selectedQuote, type QuoteSelection, type ResultsState } from './results-reducer';
import { createScrollAnchor } from './scroll-anchor';
import { useResults } from './use-results';
import { minutes, number, toman } from './format';
import styles from './results.module.css';
export interface ResultsEvidence {state:ResultsState;select:(selection:QuoteSelection)=>void}
export interface ResultsPageProps {renderProviderAction?:(quote:QuoteSnapshot,group:ComparisonGroup)=>ReactNode;allowDefaultSelection?:boolean;historical?:boolean;onFreshSearch?:()=>void;onResume?:()=>void;onSessionExpired?:()=>void;onClearFilter?:(key:keyof TransportSearchQuery['filters'])=>void;onEditDate?:()=>void; onRestoreReady?:()=>void; selectedAction?:{quoteId:string;node:ReactNode}; evidenceRef?:MutableRefObject<ResultsEvidence|undefined>;restore?:Pick<ResultsState,'frozen'|'selected'|'dismissedSuggestion'>; isCurrent: () => boolean; isSelectionCurrent?: () => boolean; generation: string; searchId: string; query: TransportSearchQuery; sort?: SortOrder; catalog: CatalogSnapshot; refinementDisabled: boolean; draftChanged: boolean; onRefine: (query: TransportSearchQuery) => void; onEdit: () => void; enterResults?: boolean; onPreviewItinerary?: (itinerary?: Itinerary,source?:'hover'|'focus',leavingId?:string) => void; onPinItinerary?: (itinerary: Itinerary) => void; onSelectQuote?: (quote?: QuoteSnapshot, itinerary?: Itinerary, selectionIntent?: QuoteSelection) => void }
function Coverage({ snapshot }: { snapshot: SearchSnapshot }) {
 const pending = snapshot.status === 'collecting' ? new Set(snapshot.coverage.pendingProviderIds).size : 0;
 const failed = new Set(snapshot.coverage.failedProviderIds).size;
 if (!pending && !failed) return null;
 const label=[pending > 0 ? `${number(pending)} فروشنده در حال بررسی` : '',failed > 0 ? `${number(failed)} فروشنده در دسترس نیست` : ''].filter(Boolean).join(' · ');
 return <span className={styles.coveragePending} role="status"><MotionText value={label}/></span>;
}
export function ResultsList(props: ResultsPageProps) {
 const { generation, searchId, query, catalog } = props;
 const { state, dispatch, connectionError,connectionState,error,retryRead } = useResults(generation,searchId,query,undefined,undefined,props.restore);
 const region = useRef<HTMLElement>(null); const heading = useRef<HTMLHeadingElement>(null); const entered = useRef(false);
 const motion=useMotionPolicy();
 const [suggestionHighlight,setSuggestionHighlight]=useState<{cardId:string;epoch:number}>();
 const suggestionHighlightTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),suggestionHighlightEpoch=useRef(0);
 const snapshot = state.adopted?.snapshot; const latest = state.latest?.snapshot;
 const sort=props.sort ?? query.sort;
 const cards = useMemo(() => snapshot ? priceCards(snapshot.groups,sort) : [], [snapshot,sort]);
 const ordering=useMemo(() => JSON.stringify(cards.map(card=>card.id)), [cards]);
 const range = useMemo(() => priceRange(snapshot?.groups.flatMap(group=>group.eligibleQuotes.map(quote=>quote.total.amountRial)) ?? []), [snapshot]);
 const deferRows = cards.length > 24;
 const stateRef = useRef(state); stateRef.current = state;
 const mounted = useRef(true); const outward = useRef(props); outward.current = props;
 function ownsCurrent() { return mounted.current && outward.current.isCurrent(); }
 function canSelect() { return ownsCurrent() && !outward.current.historical && !outward.current.draftChanged && (outward.current.isSelectionCurrent?.() ?? true); }
 // Snapshot only for this render; every event/effect still checks live ownership.
 const selectionAllowed = canSelect();
 const [scrollAnchor] = useState(()=>createScrollAnchor({measure:id=>!ownsCurrent() ? undefined : Array.from(region.current?.querySelectorAll<HTMLElement>('[data-price-card-id]') ?? []).find(card=>card.dataset.priceCardId===id)?.getBoundingClientRect().top,adjust:delta=>{if(ownsCurrent()) window.scrollBy({top:delta,behavior:'instant'});},frame:callback=>requestAnimationFrame(callback),cancelFrame:id=>cancelAnimationFrame(id)}));
 useLayoutEffect(()=>{if(ownsCurrent()) scrollAnchor.layout();else scrollAnchor.cancel();},[state.adopted,scrollAnchor]);
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;scrollAnchor.cancel();};},[scrollAnchor]);
 useEffect(()=>{if(ownsCurrent()&&connectionState==='expired')outward.current.onSessionExpired?.();},[connectionState]);
 const renderedAt = Date.now();
 const selected = selectedQuote(state,renderedAt);
 const defaultSelectionDone = useRef(Boolean(props.restore) || props.allowDefaultSelection === false);
 const pinnedDefaultSelection = useRef<QuoteSelection | undefined>(undefined);
 useEffect(() => {
  if (!canSelect()) return;
  const itinerary = selected ? snapshot?.groups.find(group => group.itinerary.itineraryId === selected.itineraryId)?.itinerary : undefined;
  if (selected && itinerary && state.selectionSource === 'automatic' && pinnedDefaultSelection.current !== state.selected) {
   pinnedDefaultSelection.current = state.selected;
   outward.current.onPinItinerary?.(itinerary);
  }
  outward.current.onSelectQuote?.(selected,itinerary,state.selected);
 }, [selected,snapshot,state.selected,state.selectionSource]);
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
 const select = useCallback((selection: QuoteSelection) => {
  if (!canSelect() || quoteStatus(stateRef.current,selection,Date.now()) !== 'current') return;
  defaultSelectionDone.current = true;
  dispatch({ type:'select',selection,now:Date.now() });
  const matched=stateRef.current.adopted?.snapshot.groups.find(group => group.groupId === selection.groupId);const itinerary=matched?.itinerary; if (itinerary && canSelect()){outward.current.onPinItinerary?.(itinerary);outward.current.onSelectQuote?.(matched?.eligibleQuotes.find(q=>q.quoteId===selection.quoteId&&q.version===selection.version),itinerary,selection);}
 }, [dispatch]);
 function adopt() {
  if(!ownsCurrent()) {scrollAnchor.cancel();return;}
  const cards = Array.from(region.current?.querySelectorAll<HTMLElement>('[data-price-card-id]') ?? []);
  const anchor = cards.find(card => card.getBoundingClientRect().bottom > 0);
  scrollAnchor.capture(anchor?.dataset.priceCardId ? { id:anchor.dataset.priceCardId,top:anchor.getBoundingClientRect().top } : undefined);
  dispatch({ type:'adopt' });
 }

 useEffect(() => {
  if (defaultSelectionDone.current) return;
  if (!canSelect() || props.restore || props.allowDefaultSelection === false || state.selected) {defaultSelectionDone.current=true;return;}
  if (!state.latest || state.latest.snapshot.status === 'collecting') return;
  if (!['complete','partial','interrupted'].includes(state.latest.snapshot.status) || !state.latest.snapshot.groups.length) {defaultSelectionDone.current=true;return;}
  // A frozen list must adopt the final evidence through the same anchor as explicit updates.
  if (state.adopted?.sequence !== state.latest.sequence) {adopt();return;}
  defaultSelectionDone.current=true;
  dispatch({type:'select-default',sequence:state.latest.sequence,now:Date.now()});
 },[state.adopted,state.latest,state.selected,props.allowDefaultSelection,props.restore,props.historical,props.draftChanged]);

 if(props.evidenceRef&&ownsCurrent())props.evidenceRef.current={state,select};
 const restoredLayout=useRef(false);
 useLayoutEffect(()=>{if(!restoredLayout.current&&props.restore&&snapshot&&ownsCurrent()){restoredLayout.current=true;outward.current.onRestoreReady?.();}},[snapshot,props.restore]);
 const revealedSelection=useRef(props.restore?.selected);
 useLayoutEffect(()=>{if(!state.selected||revealedSelection.current===state.selected||(!props.renderProviderAction&&props.selectedAction?.quoteId!==state.selected.quoteId)||!canSelect())return;if(state.selectionSource==='automatic'){revealedSelection.current=state.selected;return;}const seller=Array.from(region.current?.querySelectorAll<HTMLElement>('[data-seller-quote-id]')??[]).find(node=>node.dataset.sellerQuoteId===state.selected!.quoteId);const action=(seller??region.current)?.querySelector<HTMLElement>(':is(a,button)[data-referral-source=transport], [data-referral-source=transport] :is(a,button)');if(!action||action.hasAttribute('disabled')||action.getAttribute('aria-disabled')==='true')return;revealedSelection.current=state.selected;action.focus({preventScroll:true});action.scrollIntoView({block:'nearest',behavior:'instant'});},[state.selected,state.selectionSource,props.selectedAction?.quoteId,props.renderProviderAction]);
 // Dismissing the banner does not remove a still-valid card's gold identity.
 const qualifiedSuggestion = resolveSuggestion({...state,dismissedSuggestion:false},renderedAt);
 const resolvedSuggestion = state.dismissedSuggestion ? undefined : qualifiedSuggestion;
 const suggestion = resolvedSuggestion?.suggestion; const suggestionTarget = resolvedSuggestion?.target;
 const suggestedCardId=selectionAllowed&&qualifiedSuggestion ? priceCardId(qualifiedSuggestion.target.group.groupId,qualifiedSuggestion.target.quote) : undefined;
 useLayoutEffect(()=>{
  if(!suggestionHighlight||motion.enabled&&suggestionHighlight.cardId===suggestedCardId&&ownsCurrent())return;
  clearTimeout(suggestionHighlightTimer.current);suggestionHighlightTimer.current=undefined;setSuggestionHighlight(undefined);
 },[motion.enabled,suggestedCardId,suggestionHighlight]);
 useLayoutEffect(()=>()=>clearTimeout(suggestionHighlightTimer.current),[]);
 function revealSuggestion(){
  if(!canSelect())return;
  const current=resolveSuggestion(stateRef.current,Date.now());if(!current)return;
  const id=priceCardId(current.target.group.groupId,current.target.quote);
  const card=Array.from(region.current?.querySelectorAll<HTMLElement>('[data-price-card-id]')??[]).find(node=>node.dataset.priceCardId===id&&!node.closest('[inert],[data-result-presence="exiting"]'));
  const select=card?.querySelector<HTMLButtonElement>('[data-card-select]');
  if(!card||!select||select.disabled)return;
  dispatch({type:'freeze'});clearTimeout(suggestionHighlightTimer.current);
  if(motion.enabled){
   const epoch=++suggestionHighlightEpoch.current;setSuggestionHighlight({cardId:id,epoch});
   suggestionHighlightTimer.current=setTimeout(()=>{suggestionHighlightTimer.current=undefined;if(mounted.current)setSuggestionHighlight(value=>value?.epoch===epoch?undefined:value);},3000);
  }else setSuggestionHighlight(undefined);
  select.focus({preventScroll:true});card.scrollIntoView({block:'center',behavior:motion.enabled?'smooth':'instant'});
 }
 const incompletePrice=Boolean(snapshot && snapshot.status !== 'collecting' && snapshot.groups.length && snapshot.groups.every(group=>!group.eligibleQuotes.length));
 const collectionUnavailable=connectionError || ['snapshot-only','recovering','expired','unavailable'].includes(connectionState) || Boolean(latest && ['partial','interrupted','failed','cancelled'].includes(latest.status));
 const needsRecovery=!props.historical && (connectionState === 'expired' || !snapshot && Boolean(error) || Boolean(snapshot?.groups.length) && (collectionUnavailable || incompletePrice));
 const ownedAction=(action:(()=>void)|undefined)=>action ? ()=>{if(ownsCurrent())action();} : undefined;
 const freezeResults=useCallback(()=>{scrollAnchor.cancel();if(ownsCurrent())dispatch({type:'freeze'});},[dispatch,scrollAnchor]);
 const previewItinerary=useCallback((itinerary?: Itinerary,source?:'hover'|'focus',leavingId?:string)=>{if(canSelect())outward.current.onPreviewItinerary?.(itinerary,source,leavingId);},[]);
 return <section ref={region} className={styles.results} aria-label="نتایج مقایسه سفر" data-promotion-motion={motion.enabled?'active':'static'} data-historical={Boolean(props.historical)} data-connection-state={connectionState} data-search-id={searchId} data-generation={generation} data-status={latest?.status ?? 'loading'} data-sequence={state.latest?.sequence ?? 0} data-frozen={state.frozen}>
  <header className={styles.resultsHead}><h2 ref={heading} tabIndex={-1}><MotionText value={`مقایسه ${query.mode === 'flight' ? 'پروازها' : query.mode === 'train' ? 'قطارها' : 'اتوبوس‌ها'}`}/>{latest && <> <MotionText className={styles.providerCount} value={`(${number(new Set(latest.coverage.successfulProviderIds).size)} فروشنده)`}/></>}</h2>{latest && <Coverage snapshot={latest}/>}</header>
  <div className={styles.toolbar}><SegmentedControl hideLabel label="مرتب‌سازی پیشنهادها" value={sort} isDisabled={props.refinementDisabled} onChange={value => {if(ownsCurrent()){freezeResults();props.onRefine({ ...query,sort:value as SortOrder });}}} options={[{id:'cheapest',label:'ارزان‌ترین'},{id:'fastest',label:'سریع‌ترین'},{id:'fewest-connections',label:query.mode === 'flight' ? 'کم‌توقف‌ترین' : 'کمترین تعویض'}]}/>{snapshot && <ResultFilters isCurrent={ownsCurrent} query={{...query,sort}} snapshot={snapshot} catalog={catalog} disabled={props.refinementDisabled} onApply={value => {if(ownsCurrent()) props.onRefine(value);}}/>}{hasStagedUpdates(state) && <span className={styles.refreshUpdates}><Button variant="quiet" aria-label="اعمال نتایج تازه" onPress={adopt}><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M20 7v5h-5M4 17v-5h5M5.3 8a7.5 7.5 0 0 1 12.4-2L20 9M4 15l2.3 3A7.5 7.5 0 0 0 18.7 16"/></svg>به‌روزرسانی</Button></span>}</div>
  {props.historical&&<p role="status" className={styles.notice}>این شواهد برای تنظیمات قبلی است؛ انتخاب و ادامه نیاز به مقایسه تازه دارد. شرایط فرم شما حفظ شده است.</p>}
  {needsRecovery&&<SearchRecovery query={query} catalog={catalog} status={latest?.status} historical={props.historical} expired={connectionState==='expired'} incompletePrice={incompletePrice} error={error} connection={connectionState} onFresh={connectionState!=='expired'?ownedAction(props.onFreshSearch):undefined} onRead={ownedAction(retryRead)} onEdit={ownedAction(props.onEdit)!} onDate={ownedAction(props.onEditDate)} onResume={ownedAction(props.onResume)} onClearFilter={props.draftChanged||!props.onClearFilter?undefined:key=>{if(ownsCurrent())props.onClearFilter?.(key);}}/>}
  {suggestion && suggestionTarget && <aside className={styles.suggestion} data-faster-suggestion aria-label="پیشنهاد جایگزین"><div><strong>{minutes(suggestion.delta.minutes)} زودتر برسید</strong><p>{suggestion.delta.amountRial > 0 ? `${toman(suggestion.delta.amountRial)} بیشتر` : suggestion.delta.amountRial < 0 ? `${toman(-suggestion.delta.amountRial)} کمتر` : 'با همان مبلغ'} نسبت به کم‌قیمت‌ترین پیشنهاد کامل همین جست‌وجو</p></div><Button variant="quiet" isDisabled={!selectionAllowed} onPress={revealSuggestion}>نمایش مسیر پیشنهادی</Button><CloseButton aria-label="بستن پیشنهاد جایگزین" onPress={() => {if(ownsCurrent()) dispatch({type:'dismiss-suggestion'});}}/></aside>}
  {state.selected && !selected && !props.draftChanged && !props.historical && <div className={styles.invalid} role="status">پیشنهاد انتخاب‌شده دیگر معتبر نیست؛ برای ادامه نتایج تازه را بررسی یا دوباره جست‌وجو کنید.</div>}
  <ResultsPresence pop>
   {!snapshot&&error ? null : !snapshot || snapshot.status === 'collecting' && snapshot.groups.length === 0 ? <ResultPresence key="loading"><ResultsSkeleton/></ResultPresence> : snapshot.groups.length > 0 ? <ResultPresence key="cards" refreshKey={deferRows ? ordering : undefined}><div className={styles.list} role="list" aria-label="مسیرها و پیشنهادهای مقایسه‌شده" data-result-rendering={deferRows ? 'deferred' : 'full'}><ResultsPresence pop presenceAffectsLayout={!deferRows}>{cards.map(({id,group,source}) => <ResultRow key={id} deferred={deferRows} roundTrip={query.tripType === 'round-trip'} ordering={ordering} cardId={id} suggested={id===suggestedCardId} suggestionHighlight={motion.enabled&&id===suggestedCardId&&suggestionHighlight?.cardId===id?suggestionHighlight.epoch:undefined} priceBand={priceBand(group.eligibleQuotes[0]?.total.amountRial,range)} selectionDisabled={!selectionAllowed} draftChanged={props.draftChanged} renderProviderAction={selectionAllowed&&props.renderProviderAction?quote=>props.renderProviderAction!(quote,source):undefined} continuation={selectionAllowed&&state.selected?.groupId===group.groupId&&props.selectedAction?.quoteId===state.selected.quoteId?props.selectedAction.node:undefined} group={group} snapshot={snapshot} catalog={catalog} state={state} now={renderedAt} onFreeze={freezeResults} onSelect={select} onPreviewItinerary={previewItinerary}/>)}</ResultsPresence></div></ResultPresence> : connectionState === 'expired' && !props.historical ? null : <ResultPresence key="empty"><ResultEmptyState snapshot={snapshot} query={query} historical={props.historical} unavailable={collectionUnavailable} onFresh={props.historical?undefined:ownedAction(props.onFreshSearch)} onEdit={ownedAction(props.onEdit)!} onDate={ownedAction(props.onEditDate)} onClearFilter={props.draftChanged||!props.onClearFilter?undefined:key=>{if(ownsCurrent())props.onClearFilter?.(key);}}/></ResultPresence>}
  </ResultsPresence>
  {latest && ['partial','interrupted'].includes(latest.status) && snapshot?.groups.length !== 0 && <p className={styles.notice}>فقط پیشنهادهای دریافت‌شده نمایش داده شده‌اند؛ پوشش این جست‌وجو کامل و موفق نیست.</p>}
 </section>;
}
export function ResultsPage(props: ResultsPageProps) { return <ResultsList key={props.generation+'/'+props.searchId} {...props}/>; }
