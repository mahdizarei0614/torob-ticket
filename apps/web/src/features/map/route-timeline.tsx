import type {CatalogSnapshot,Itinerary} from '@torob-ticket/contracts';
import {RouteTimeline as SegmentTimeline} from '../results/journey-card';
/** Same canonical leg and localization as the result details; never reconstruct a timetable. */
export function RouteTimeline({itinerary,direction,catalog}:{itinerary:Itinerary;direction:'outbound'|'return';catalog:CatalogSnapshot}) {
 const leg=direction==='return'?itinerary.return:itinerary.outbound;
 return leg?<SegmentTimeline leg={leg} transportMode={itinerary.mode} catalog={catalog} label={direction==='return'?'برگشت':'رفت'}/>:<p role="status">اطلاعات این بخش سفر در دسترس نیست.</p>;
}
