import { useId, useState, useRef, type ReactNode } from 'react';
import type { CatalogSnapshot, ComparisonGroup, Itinerary, JourneyLeg, QuoteSnapshot, SearchSnapshot } from '@torob-ticket/contracts';
import {Button, Price, Tooltip,ProviderMark,displayProviderName,displayPlaceName,type PriceBand} from '@torob-ticket/ui';
import { ProviderOffers } from './provider-offers';
import { Explanation } from './explanation';
import { priceCardId } from './price-cards';
import { ResultPresence, ResultsPresence } from './result-motion';
import { localDay, localTime, minutes, number, operatorLabel, placeName, routePlaces, selectionFor, travelerCount } from './format';
import { quoteStatus, type QuoteSelection, type ResultsState } from './results-reducer';
import styles from './results.module.css';
function RouteCodes({ leg, catalog }: { leg: JourneyLeg; catalog: CatalogSnapshot }) { return <div className={styles.routeCodes} dir="ltr" aria-label="کدهای مسیر به ترتیب حرکت">{routePlaces(leg).map((id,index) => { const place = catalog.places.find(p => p.id === id); return <span key={id+index}>{index > 0 && <i aria-hidden="true">→</i>}<Tooltip content={displayPlaceName(place)}><Button variant="quiet" aria-label={displayPlaceName(place)}><bdi dir={place?.code?'ltr':'auto'}>{place?.code ?? displayPlaceName(place)}</bdi></Button></Tooltip></span>; })}</div>; }
/** Stops are canonical ordered occurrences, not a set of Place IDs. Unknown joins stay explicit. */
function timelineEvents(leg:JourneyLeg) {
 type Event={kind:'segment';index:number}|{kind:'stop';index:number;segmentIndex?:number};
 const events:Event[]=[];let cursor=0;
 leg.stops.forEach((stop,index)=>{const match=leg.segments.findIndex((segment,i)=>i>=cursor&&segment.destinationPlaceId===stop.placeId&&(!stop.arrivalAt||Date.parse(stop.arrivalAt)===Date.parse(segment.arrivalAt))&&(!stop.departureAt||leg.segments[i+1]?.originPlaceId===stop.placeId&&Date.parse(stop.departureAt)===Date.parse(leg.segments[i+1]!.departureAt)));
  if(match>=cursor){for(;cursor<=match;cursor++)events.push({kind:'segment',index:cursor});events.push({kind:'stop',index,segmentIndex:match});}
  else events.push({kind:'stop',index});
 });
 for(;cursor<leg.segments.length;cursor++)events.push({kind:'segment',index:cursor});return events;
}
export function RouteTimeline({leg,catalog,label,transportMode=leg.segments[0]?.mode}:{leg:JourneyLeg;catalog:CatalogSnapshot;label:string;transportMode?:Itinerary['mode']}) {
 return <section className={styles.timeline} aria-label={`جزئیات مسیر ${label}`}><h4>{label}</h4><ol>{timelineEvents(leg).map(event=>{
  if(event.kind==='segment'){const segment=leg.segments[event.index]!;return <li key={'segment:'+segment.segmentId} data-segment-id={segment.segmentId} data-transfer={segment.mode!==transportMode}><div><strong>{placeName(catalog.places,segment.originPlaceId)}</strong><time dateTime={segment.departureAt}>{localTime(segment.departureAt,segment.departureTimeZone)} · {localDay(segment.departureAt,segment.departureTimeZone)}</time><small dir="ltr">{segment.departureTimeZone}</small></div><span className={styles.segmentLine} aria-hidden="true">↓</span><div><strong>{placeName(catalog.places,segment.destinationPlaceId)}</strong><time dateTime={segment.arrivalAt}>{localTime(segment.arrivalAt,segment.arrivalTimeZone)} · {localDay(segment.arrivalAt,segment.arrivalTimeZone)}</time><small dir="ltr">{segment.arrivalTimeZone}</small></div><p className={styles.muted}>{operatorLabel(segment.operatorId,segment.mode)}{segment.mode!==transportMode?' · انتقال زمینی':''}</p></li>;}
  const stop=leg.stops[event.index]!;const segment=event.segmentIndex===undefined?undefined:leg.segments[event.segmentIndex];
  const zone=catalog.places.find(place=>place.id===stop.placeId)?.timeZone;const arrivalZone=segment?.arrivalTimeZone??zone;const departureZone=event.segmentIndex===undefined?zone:leg.segments[event.segmentIndex+1]?.departureTimeZone??arrivalZone;
  const time=(at:string|undefined,timeZone:string|undefined)=>!at?'نامعلوم':timeZone?<time dateTime={at}>{localTime(at,timeZone)}</time>:<time dateTime={at}>زمان محلی نامعلوم؛ منطقه زمانی اعلام نشده</time>;
  return <li className={styles.stop} key={'stop:'+event.index} data-stop-place={stop.placeId} data-stop-occurrence={event.index} data-stop-unmatched={!segment||undefined}>{({connection:'اتصال',dwell:'توقف میانی','technical-stop':'توقف فنی','ground-transfer':'انتقال زمینی'} as const)[stop.kind]} در {placeName(catalog.places,stop.placeId)} · {minutes(stop.waitMinutes)} انتظار · {stop.vehicleChange?'تعویض وسیله':'بدون تعویض وسیله'} · ورود {time(stop.arrivalAt,arrivalZone)} · حرکت {time(stop.departureAt,departureZone)}{!segment&&<small> · جایگاه این توقف در بخش‌های مسیر مشخص نیست؛ ترتیب اعلام‌شده حفظ شده است.</small>}</li>;
 })}</ol></section>;
}
export interface JourneyCardProps { cardId?:string; priceBand?:PriceBand; renderProviderAction?:(quote:QuoteSnapshot)=>ReactNode; selectionDisabled?:boolean; draftChanged?:boolean; continuation?:ReactNode; group: ComparisonGroup; snapshot: SearchSnapshot; catalog: CatalogSnapshot; state: ResultsState; now: number; onFreeze: () => void; onSelect: (selection: QuoteSelection) => void; onPreviewItinerary?: (itinerary?: Itinerary,source?:'hover'|'focus',leavingId?:string) => void; onPinItinerary?: (itinerary: Itinerary) => void }
export function JourneyCard({ group, snapshot, catalog, state, now, onFreeze, onSelect, onPreviewItinerary, onPinItinerary,continuation,selectionDisabled=false,draftChanged=false,cardId,priceBand,renderProviderAction }: JourneyCardProps) {
 const hovered=useRef(false);
 const [expanded,setExpanded] = useState(false); const detailsId = useId(); const summaryId = useId();
 const ownSelection = state.selected?.groupId === group.groupId && group.eligibleQuotes.some(quote => quote.quoteId === state.selected?.quoteId && quote.version === state.selected.version) ? state.selected : undefined;
 const quote = group.eligibleQuotes.find(q => ownSelection ? q.quoteId === ownSelection.quoteId && q.version === ownSelection.version : q.quoteId === group.representativeQuoteId);
 const first = group.itinerary.outbound.segments[0]!; const last = group.itinerary.outbound.segments.at(-1)!;
 const status = quote ? quoteStatus(state,selectionFor(group.groupId,quote),now) : 'unavailable';
 const selectionBlocked=selectionDisabled||draftChanged;
 const invalidPrice=quote&&(status!=='current'||draftChanged);
 const invalidState=status!=='current'?status:draftChanged?'changed-intent':undefined;
 const invalidReason=invalidState==='expired'?'مهلت زمانی این قیمت پایان یافته است.':invalidState==='changed-intent'?'این قیمت برای شرایط قبلی سفر است.':'این نسخه از پیشنهاد دیگر معتبر نیست.';
 const title = `${placeName(catalog.places,group.itinerary.originPlaceId)} به ${placeName(catalog.places,group.itinerary.destinationPlaceId)}`;
 const departureDay = localDay(first.departureAt,first.departureTimeZone);
 const arrivalDay = localDay(last.arrivalAt,last.arrivalTimeZone);
 const returnFirst = group.itinerary.return?.segments[0];
 const returnLast = group.itinerary.return?.segments.at(-1);
 const providerName = quote ? displayProviderName(catalog.providerCapabilities.find(provider=>provider.providerId===quote.providerId)) : '';
 return <article className={styles.card} data-group-id={group.groupId} data-price-card-id={cardId ?? priceCardId(group.groupId,quote)} data-quote-id={quote?.quoteId} data-quote-version={quote?.version} data-amount-rial={quote?.total.amountRial} data-selected={Boolean(ownSelection) || undefined} data-details-open={expanded || undefined} aria-label={title} onFocusCapture={() => { onFreeze(); onPreviewItinerary?.(group.itinerary,'focus'); }} onMouseEnter={() => {hovered.current=true;onPreviewItinerary?.(group.itinerary,'hover');}} onMouseLeave={event => {hovered.current=false;onPreviewItinerary?.(undefined,'hover',group.itinerary.itineraryId);if(event.currentTarget.contains(document.activeElement))onPreviewItinerary?.(group.itinerary,'focus');}} onBlur={event => {if(!event.currentTarget.contains(event.relatedTarget)){onPreviewItinerary?.(undefined,'focus',group.itinerary.itineraryId);if(hovered.current)onPreviewItinerary?.(group.itinerary,'hover');}}}>
  <button type="button" className={styles.cardSelect} data-card-select aria-label="انتخاب پیشنهاد" aria-describedby={summaryId} aria-pressed={Boolean(ownSelection)} disabled={selectionBlocked || !quote || status !== 'current'} onClick={() => { if (quote) { onFreeze(); onSelect(selectionFor(group.groupId,quote)); onPinItinerary?.(group.itinerary); } }}/>
  <span className={styles.srOnly} id={summaryId}>{title} · {operatorLabel(first.operatorId,first.mode)} · {departureDay} · {localTime(first.departureAt,first.departureTimeZone)} · {providerName}{quote ? ` · ${number(quote.total.amountRial / 10)} تومان برای ${number(travelerCount(snapshot.query))} مسافر${group.itinerary.return ? '، رفت‌وبرگشت' : ''}` : ''}</span>
  <div className={styles.cardHead}>
   <div className={styles.operator}><ProviderMark operatorId={first.operatorId} mode={first.mode} size={40}/><div><h3>{operatorLabel(first.operatorId,first.mode)}</h3><time dateTime={first.departureAt}>{departureDay}</time></div>{ownSelection && <span className={styles.selectedMark} aria-label="انتخاب‌شده"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8 3 3 6-6"/></svg></span>}</div>
   {quote ? <div className={styles.cardPrice} data-single-traveler={travelerCount(snapshot.query) === 1 || undefined}><Price total={quote.total} band={invalidPrice?'unknown':priceBand} scope={{kind:'party',travelers:travelerCount(snapshot.query)}}/></div> : <strong className={styles.invalid}>قیمت نهایی نامشخص</strong>}
  </div>
  <div className={styles.journey}>
   <div><strong><time dateTime={first.departureAt}>{localTime(first.departureAt,first.departureTimeZone)}</time></strong><span>{group.itinerary.return ? 'رفت' : 'حرکت'}</span></div>
   <div className={styles.routeSummary}><RouteCodes leg={group.itinerary.outbound} catalog={catalog}/><small>{minutes(group.durationMinutes)}{group.itinerary.return ? ' مجموع' : ''} · {group.connectionCount === 0 ? group.itinerary.mode === 'flight' ? 'مستقیم' : 'بدون تعویض وسیله' : `${number(group.connectionCount)} ${group.itinerary.mode === 'flight' ? 'توقف' : 'تعویض وسیله'}${group.itinerary.return ? ' در مجموع' : ''}`}</small></div>
   <div><strong><time dateTime={last.arrivalAt}>{localTime(last.arrivalAt,last.arrivalTimeZone)}</time></strong><span>رسیدن{arrivalDay !== departureDay && <time className={styles.arrivalDate} dateTime={last.arrivalAt}> · {arrivalDay}</time>}</span></div>
  </div>
  {group.itinerary.return && returnFirst && returnLast && <div className={styles.returnLine}><span>برگشت · <time dateTime={returnFirst.departureAt}>{localDay(returnFirst.departureAt,returnFirst.departureTimeZone)}</time> · <time dateTime={returnFirst.departureAt}>{localTime(returnFirst.departureAt,returnFirst.departureTimeZone)}</time> تا <time dateTime={returnLast.arrivalAt}>{localTime(returnLast.arrivalAt,returnLast.arrivalTimeZone)}{localDay(returnFirst.departureAt,returnFirst.departureTimeZone) !== localDay(returnLast.arrivalAt,returnLast.arrivalTimeZone) && ` · ${localDay(returnLast.arrivalAt,returnLast.arrivalTimeZone)}`}</time></span><RouteCodes leg={group.itinerary.return} catalog={catalog}/></div>}
  {invalidPrice && <p className={styles.invalid} role={ownSelection ? 'alert' : undefined} data-invalid-price={invalidState} title={invalidReason}>اعتبار قیمت پایان یافته<span className={styles.srOnly}>؛ {invalidReason}</span></p>}
  <div className={styles.cardActions}>
   {quote && !ownSelection && <span className={styles.providerName}><ProviderMark providerId={quote.providerId} size={24}/>{providerName}</span>}
   {!ownSelection && <Explanation group={group} snapshot={snapshot}/>}
   <Button variant="quiet" aria-label="جزئیات سفر" aria-expanded={expanded} aria-controls={detailsId} onPress={() => { onFreeze(); setExpanded(value=>!value); }}>جزئیات سفر <svg className={styles.detailChevron} viewBox="0 0 16 16" aria-hidden="true" data-open={expanded || undefined}><path d="m4 6 4 4 4-4"/></svg></Button>
  </div>
  <ResultsPresence>{ownSelection && !selectionBlocked && (renderProviderAction || continuation) && <ResultPresence key="sellers" collapse className={styles.presenceClip}><div className={styles.sellers} aria-label="فروشندگان با این قیمت" data-price-sellers>{renderProviderAction ? group.eligibleQuotes.filter(offer => quoteStatus(state,selectionFor(group.groupId,offer),now) === 'current').map(offer => <div className={styles.sellerChoice} key={offer.quoteId+':'+offer.version} data-seller-quote-id={offer.quoteId} data-seller-amount-rial={offer.total.amountRial}>{renderProviderAction(offer)}{group.eligibleQuotes.filter(other=>other.providerId===offer.providerId).length > 1 && <small>گزینه {number(group.eligibleQuotes.filter(other=>other.providerId===offer.providerId).findIndex(other=>other.quoteId===offer.quoteId)+1)}</small>}</div>) : continuation}</div></ResultPresence>}
  {expanded && <ResultPresence key="details" collapse className={styles.presenceClip}><div id={detailsId} className={styles.details}><div className={styles.timelines}><RouteTimeline leg={group.itinerary.outbound} catalog={catalog} label="رفت"/>{group.itinerary.return && <RouteTimeline leg={group.itinerary.return} catalog={catalog} label="برگشت"/>}</div><ProviderOffers group={group} catalog={catalog} state={state} now={now} draftChanged={draftChanged}/></div></ResultPresence>}
  </ResultsPresence>
 </article>;
}
