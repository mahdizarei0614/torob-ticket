import type {HotelQuoteSnapshot} from '@torob-ticket/contracts';
import {formatTomanParts} from '@torob-ticket/domain';
import {Price} from '@torob-ticket/ui';
import {nights} from './hotel-format';
import styles from './hotels.module.css';

/** A one-room, one-night quote is its nightly price; historical totals stay totals. */
export function HotelPrice({quote}:{quote:HotelQuoteSnapshot}){
 const nightCount=nights(quote.query.checkIn,quote.query.checkOut);
 if(quote.query.rooms!==1||nightCount!==1)return <Price total={quote.total} scope={{kind:'stay',rooms:quote.query.rooms,nights:nightCount}}/>;
 const amount=formatTomanParts(quote.total,'fa-IR').map(part=>part.value).join('');
 return <div className={styles.nightlyPrice} role="group" aria-label={`قیمت هر شب: ${amount} تومان`}>
  <div aria-hidden="true"><bdi>{amount}</bdi><span>تومان</span></div>
  <span aria-hidden="true">هر شب</span>
 </div>;
}
