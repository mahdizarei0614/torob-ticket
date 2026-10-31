import type {ReactNode} from 'react';
import type {Hotel,HotelComparisonResult,HotelQuoteSnapshot,CatalogSnapshot} from '@torob-ticket/contracts';
import {displayHotelName} from '@torob-ticket/ui';
import {faNumber,resultLabel} from './hotel-format';
import {HotelPrice} from './hotel-price';
import styles from './hotels.module.css';

interface HotelCardProps {
 hotel:Hotel; result:HotelComparisonResult; quotes:HotelQuoteSnapshot[]; catalog:CatalogSnapshot;
 disabled:boolean; selected?:HotelQuoteSnapshot; isSelected?:boolean; distanceTo?:'arrival'|'location';
 onSelect?:(quote:HotelQuoteSnapshot)=>void; onSelectHotel?:(hotelId:string)=>void;
 referralAction?:{quoteId:string;node:ReactNode};
}
export function HotelCard({hotel,result,quotes,disabled,selected,isSelected,distanceTo='arrival',onSelect,onSelectHotel}:HotelCardProps){
 const base=quotes.find(quote=>quote.quoteId===result.representativeQuoteId);
 const quote=base&&selected?.quoteId===base.quoteId&&selected.hotelId===hotel.hotelId&&selected.version>=base.version?selected:base;
 const active=isSelected??selected?.hotelId===hotel.hotelId;
 const distance=distanceTo==='location'?result.locationDistanceKm:result.arrivalDistanceKm;
 const expired=Boolean(quote&&Date.parse(quote.expiresAt)<=Date.now());
 function inspect(){
  if(disabled)return;
  if(onSelectHotel){onSelectHotel(hotel.hotelId);return;}
  if(quote&&!expired&&quote.completeness.status==='complete'&&quote.eligibility.status==='eligible')onSelect?.(quote);
 }
 return <article className={styles.squareCard} data-hotel-id={hotel.hotelId} data-hotel-status={result.status} data-selected={Boolean(active)} data-hotel-quote-id={quote?.quoteId} data-quote-version={quote?.version} data-hotel-price-rial={quote?.total.amountRial} data-price-expired={expired||undefined}>
  <button type="button" className={styles.squareCardSelect} data-hotel-card-select aria-label={`انتخاب ${displayHotelName(hotel)}`} aria-pressed={Boolean(active)} disabled={disabled} onClick={inspect}/>
  <svg className={styles.hotelCardArt} width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><path d="M14 78V27l31-12 23 12v51M68 41h15v37M8 78h80M23 36h7m11-4h7m9 4h5M23 48h7m11-4h7m9 4h5M23 60h7m11-4h7m9 4h5M76 50h3m-3 12h3M36 78V66h15v12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
  <div className={styles.squareCardIdentity} data-hotel-card-identity><span className={styles.hotelStars}>{hotel.stars===null?'درجه اعلام نشده':<><svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="m10 2 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L2.2 7.7l5.4-.8Z"/></svg>{faNumber(hotel.stars)} ستاره</>}</span><h3 title={displayHotelName(hotel)}>{displayHotelName(hotel)}</h3></div>
  <div className={styles.squareCardBottom} data-hotel-card-meta><span className={styles.hotelDistance}>{distance===null?'فاصله نامشخص':<><svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M15.5 8c0 4-5.5 9-5.5 9S4.5 12 4.5 8a5.5 5.5 0 1 1 11 0Z"/><circle cx="10" cy="8" r="1.7"/></svg>{faNumber(distance)} کیلومتر {distanceTo==='location'?'تا نقطه':'تا رسیدن'}</>}</span>
   {quote?<div className={styles.squareCardPrice}><HotelPrice quote={quote}/>{expired&&<small>نیاز به قیمت تازه</small>}</div>:<strong className={styles.hotelPriceUnknown}>{resultLabel(result.status)}</strong>}
  </div>
  {active&&<span className={styles.hotelChosen} aria-hidden="true"><svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="m4 10 4 4 8-8"/></svg></span>}
 </article>;
}
