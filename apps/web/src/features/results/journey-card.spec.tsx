import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReducer } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { JourneyCard } from './journey-card';
import { priceCards } from './price-cards';
import { createResultsState, resultsReducer } from './results-reducer';
import { group, observedAt, recovery } from './results-test-data';
import { catalog as baseCatalog } from '../search/search-test-data';
const catalog={...baseCatalog,places:[{id:'IKA',cityId:'a',name:'فرودگاه امام خمینی',kind:'airport' as const,code:'IKA',point:{latitude:35,longitude:51},timeZone:'Asia/Tehran'},{id:'MHD',cityId:'b',name:'فرودگاه مشهد',kind:'airport' as const,code:'MHD',point:{latitude:36,longitude:59},timeZone:'Asia/Tehran'}],providerCapabilities:[...baseCatalog.providerCapabilities,{...baseCatalog.providerCapabilities[0]!,providerId:'other',name:'فروشنده دوم خیالی'}]};
describe('journey and provider offer facts',()=>{
 it('separates different totals and keeps the exact chosen price, provider conditions and breakdown',async()=>{
  const data=group('a');const second=structuredClone(data.eligibleQuotes[0]!);second.quoteId='other-quote';second.providerId='other';second.total.amountRial=20000000;second.conditions.outbound.checkedBaggageKg={status:'unknown',reason:'not-reported'};second.conditions.outbound.refundable={status:'known',value:true};second.breakdown=[{code:'base',amount:second.total,mandatory:true}];data.eligibleQuotes.push(second);
  function Harness(){const[state,dispatch]=useReducer(resultsReducer,undefined,()=>resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:recovery([data])}));return <>{priceCards([data],'cheapest').map(card=><JourneyCard key={card.id} cardId={card.id} group={card.group} snapshot={state.adopted!.snapshot} catalog={catalog} state={state} now={Date.parse(observedAt)} onFreeze={()=>dispatch({type:'freeze'})} onSelect={selection=>dispatch({type:'select',selection,now:Date.parse(observedAt)})}/>)}</>;}
  const user=userEvent.setup();render(<Harness/>);const cards=screen.getAllByRole('article');expect(cards).toHaveLength(2);const card=cards[1]!;await user.click(within(card).getByRole('button',{name:'انتخاب پیشنهاد'}));await user.click(within(card).getByRole('button',{name:'جزئیات سفر'}));
  const other=within(card).getByRole('region',{name:/فروشنده دوم خیالی/});expect(cards[0]).not.toHaveAttribute('data-selected');
  expect(card).toHaveAttribute('data-quote-id','other-quote');expect(card).toHaveAttribute('data-amount-rial','20000000');
  expect(other).toHaveAttribute('data-selected','true');expect(other).toHaveAttribute('data-offer-quote-version',String(second.version));expect(other).toHaveTextContent('بار تحویلی: نامشخص');expect(other).toHaveTextContent('قابل استرداد طبق شرایط فروشنده');expect(other).toHaveTextContent('فروشنده دوم خیالی');expect(within(card).getByRole('button',{name:'انتخاب پیشنهاد'})).toHaveAttribute('aria-pressed','true');
  expect(within(card).queryByLabelText('مقایسه با کم‌قیمت‌ترین پیشنهاد این جست‌وجو')).not.toBeInTheDocument();
 });
 it('previews the same itinerary on keyboard focus and mouse hover, and clears on leaving',async()=>{
  const data=group('a');const state=resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:recovery([data])});const preview=vi.fn();const freeze=vi.fn();
  render(<JourneyCard group={data} snapshot={state.adopted!.snapshot} catalog={catalog} state={state} now={Date.parse(observedAt)} onFreeze={freeze} onSelect={()=>undefined} onPreviewItinerary={preview}/>);
  act(()=>screen.getByRole('button',{name:'انتخاب پیشنهاد'}).focus());expect(preview).toHaveBeenLastCalledWith(data.itinerary,'focus');expect(freeze).toHaveBeenCalled();
  const user=userEvent.setup();await user.hover(screen.getByRole('article'));expect(preview).toHaveBeenLastCalledWith(data.itinerary,'hover');await user.unhover(screen.getByRole('article'));expect(preview).toHaveBeenLastCalledWith(data.itinerary,'focus');act(()=>screen.getByRole('button',{name:'انتخاب پیشنهاد'}).blur());expect(preview).toHaveBeenLastCalledWith(undefined,'focus',data.itinerary.itineraryId);
 });
 it('keeps incomplete mandatory-price offers separate and exposes no choice for them',async()=>{
  const data=group('a');data.eligibleQuotes=[];data.representativeQuoteId=undefined;
  data.incompletePriceOffers=[{offerId:'incomplete',providerId:'p',fareId:'unknown-fare',itinerary:data.itinerary,conditions:{outbound:{...group('a').eligibleQuotes[0]!.conditions.outbound}},breakdown:[],completeness:{status:'incomplete',missing:['mandatory-charge']},eligibility:{status:'unknown',reasons:['missing']},availability:{status:'known',value:true},observedAt,provenance:group('a').eligibleQuotes[0]!.provenance,issues:[]}];
  const state=resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:recovery([data])});render(<JourneyCard group={data} snapshot={state.adopted!.snapshot} catalog={catalog} state={state} now={Date.parse(observedAt)} onFreeze={()=>undefined} onSelect={()=>undefined}/>);
  expect(screen.getByRole('button',{name:'انتخاب پیشنهاد'})).toBeDisabled();await userEvent.setup().click(screen.getByRole('button',{name:'جزئیات سفر'}));const incomplete=screen.getByRole('region',{name:'پیشنهادهای با قیمت ناقص'});expect(incomplete).toHaveTextContent('قیمت نهایی نامشخص');expect(within(incomplete).queryByRole('button')).not.toBeInTheDocument();
 });
});


it('keeps different return stops, facilities, operator and local times independent in card and details',async()=>{
 const data=group('asymmetric');const original=data.itinerary.outbound.segments[0]!;
 data.itinerary.return={segments:[
  {...original,segmentId:'back-one',serviceId:'back-service-one',operatorId:'airline:turkish-airlines',originPlaceId:'MHD',destinationPlaceId:'IST',departureAt:'2026-10-28T05:00:00Z',arrivalAt:'2026-10-28T08:00:00Z',arrivalTimeZone:'Europe/Istanbul'},
  {...original,segmentId:'back-two',serviceId:'back-service-two',operatorId:'airline:turkish-airlines',originPlaceId:'IST',destinationPlaceId:'THR',departureAt:'2026-10-28T09:30:00Z',arrivalAt:'2026-10-28T12:00:00Z',departureTimeZone:'Europe/Istanbul'},
 ],stops:[{placeId:'IST',kind:'connection',waitMinutes:90,vehicleChange:true,arrivalAt:'2026-10-28T08:00:00Z',departureAt:'2026-10-28T09:30:00Z'}]};
 const extended={...catalog,places:[...catalog.places,{...catalog.places[0]!,id:'THR',code:'THR',name:'فرودگاه مهرآباد'},{...catalog.places[0]!,id:'IST',code:'IST',cityId:'istanbul',name:'فرودگاه استانبول',timeZone:'Europe/Istanbul'}]};
 const received=recovery([data]);received.snapshot.query={...received.snapshot.query,tripType:'round-trip',returnDate:'2026-10-28'};
 const state=resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:received});
 const view=render(<JourneyCard group={data} snapshot={state.adopted!.snapshot} catalog={extended} state={state} now={Date.parse(observedAt)} onFreeze={()=>undefined} onSelect={()=>undefined}/>);
 expect(view.container.querySelector('[data-card-route-leg="outbound"]')).toHaveTextContent('IKA→MHD');
 const returning=view.container.querySelector('[data-card-route-leg="return"]')!;
 expect(returning).toHaveTextContent('MHD→IST→THR');expect(returning).not.toHaveTextContent('IKA');
 expect(returning.parentElement).toHaveTextContent('ترکیش ایرلاینز');
 await userEvent.setup().click(screen.getByRole('button',{name:'جزئیات سفر'}));
 const outbound=screen.getByRole('region',{name:'جزئیات مسیر رفت'}),back=screen.getByRole('region',{name:'جزئیات مسیر برگشت'});
 expect(Array.from(outbound.querySelectorAll('[data-segment-id]')).map(node=>node.getAttribute('data-segment-id'))).toEqual(['asymmetric-segment']);
 expect(Array.from(back.querySelectorAll('[data-segment-id]')).map(node=>node.getAttribute('data-segment-id'))).toEqual(['back-one','back-two']);
 expect(back.querySelectorAll('[data-stop-place="IST"]')).toHaveLength(1);expect(back).toHaveTextContent('۱ ساعت و ۳۰ دقیقه');
 expect(back.querySelector('time[datetime="2026-10-28T09:30:00Z"]')).toHaveTextContent('۱۲:۳۰');
 expect(back).toHaveTextContent('فرودگاه مهرآباد');expect(back).not.toHaveTextContent('فرودگاه امام خمینی');
});
