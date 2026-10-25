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
