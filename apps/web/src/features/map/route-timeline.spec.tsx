import {render,screen} from '@testing-library/react';
import {expect,it} from 'vitest';
import {ItinerarySchema} from '@torob-ticket/contracts';
import {catalog} from '../search/search-test-data';
import {group} from '../results/results-test-data';
import {RouteTimeline} from './route-timeline';
// Constructed canonical public DTO only; never supplied to a consumer live search.
it('canonical airport/ground transfer and unknown-stop timeline stays localized, ordered and direction-specific',()=>{
 const first=group('a').itinerary.outbound.segments[0]!;
 const itinerary=ItinerarySchema.parse({...group('a').itinerary,outbound:{segments:[{...first,segmentId:'one',destinationPlaceId:'IST',arrivalTimeZone:'Europe/Istanbul'},{...first,segmentId:'transfer',mode:'bus',originPlaceId:'IST',destinationPlaceId:'SAW',departureAt:'2026-10-25T07:40:00Z',arrivalAt:'2026-10-25T08:30:00Z',departureTimeZone:'Europe/Istanbul',arrivalTimeZone:'Europe/Istanbul'},{...first,segmentId:'last',originPlaceId:'SAW',departureAt:'2026-10-25T10:00:00Z',arrivalAt:'2026-10-25T11:00:00Z',departureTimeZone:'Europe/Istanbul'}],stops:[{placeId:'IST',kind:'ground-transfer',waitMinutes:10,vehicleChange:true},{placeId:'SAW',kind:'connection',waitMinutes:90,vehicleChange:true}]}});
 const leg=itinerary.outbound;const view=render(<RouteTimeline itinerary={itinerary} catalog={catalog} direction="outbound"/>);
 expect([...view.container.querySelectorAll('[data-segment-id]')].map(node=>node.getAttribute('data-segment-id'))).toEqual(['one','transfer','last']);
 expect(view.container.querySelector('[data-transfer="true"]')).not.toBeNull();expect(screen.getAllByText(/انتقال زمینی/).length).toBeGreaterThan(0);
 for(const stop of leg.stops)expect(view.container.querySelector('[data-stop-place="'+stop.placeId+'"]')).toHaveTextContent('ورود نامعلوم · حرکت نامعلوم');
 for(const segment of leg.segments){expect(view.container.querySelector('time[datetime="'+segment.departureAt+'"]')).not.toHaveTextContent(segment.departureAt);expect(view.container.textContent).toContain(segment.departureTimeZone);}
 view.rerender(<RouteTimeline itinerary={itinerary} catalog={catalog} direction="return"/>);expect(screen.getByRole('status')).toHaveTextContent('اطلاعات این بخش');
});

it.each([true,false])('repeated place occurrences preserve known=%s stop order and unmatched facts exactly once',known=>{
 const first=group('a').itinerary.outbound.segments[0]!;const minute=60000;const epoch=Date.parse(first.departureAt);const departures=[0,65,140,225];const endpoints=[['A','B'],['B','C'],['C','B'],['B','D']];
 const segments=endpoints.map(([from,to],index)=>({...first,segmentId:'loop-'+index,originPlaceId:from!,destinationPlaceId:to!,departureAt:new Date(epoch+departures[index]!*minute).toISOString(),arrivalAt:new Date(epoch+(departures[index]!+60)*minute).toISOString(),departureTimeZone:from==='C'?'Europe/Istanbul':'Asia/Tehran',arrivalTimeZone:to==='C'?'Europe/Istanbul':'Asia/Tehran'}));
 const stops=[['B',5,0],['C',15,1],['B',25,2]].map(([id,wait,index])=>({placeId:String(id),kind:'connection' as const,waitMinutes:Number(wait),vehicleChange:true,...(known?{arrivalAt:segments[Number(index)]!.arrivalAt,departureAt:segments[Number(index)+1]!.departureAt}:{})}));
 stops.splice(1,0,{placeId:'unmatched',kind:'connection',waitMinutes:3,vehicleChange:true,...(known?{arrivalAt:new Date(epoch+62*minute).toISOString(),departureAt:new Date(epoch+65*minute).toISOString()}:{})});
 const itinerary=ItinerarySchema.parse({...group('loop').itinerary,outbound:{segments,stops}});const view=render(<RouteTimeline itinerary={itinerary} catalog={catalog} direction="outbound"/>);
 const rows=[...view.container.querySelectorAll('[data-stop-place]')];expect(rows.map(node=>node.getAttribute('data-stop-place'))).toEqual(['B','unmatched','C','B']);expect(rows.map(node=>node.getAttribute('data-stop-occurrence'))).toEqual(['0','1','2','3']);expect(rows[1]).toHaveAttribute('data-stop-unmatched','true');
 expect(rows[0]).toHaveTextContent('۵ دقیقه');expect(rows[3]).toHaveTextContent('۲۵ دقیقه');if(known){expect(rows[0]!.querySelector('time')?.dateTime).toBe(stops[0]!.arrivalAt);expect(rows[3]!.querySelector('time')?.dateTime).toBe(stops[3]!.arrivalAt);expect(rows[1]).toHaveTextContent('منطقه زمانی اعلام نشده');}else for(const row of rows)expect(row).toHaveTextContent('ورود نامعلوم · حرکت نامعلوم');
});
