import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReducer } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { JourneyCard } from './journey-card';
import { createResultsState, resultsReducer } from './results-reducer';
import { group, observedAt, recovery } from './results-test-data';
import { catalog as baseCatalog } from '../search/search-test-data';
const catalog={...baseCatalog,places:[{id:'IKA',cityId:'a',name:'فرودگاه امام خمینی',kind:'airport' as const,code:'IKA',point:{latitude:35,longitude:51},timeZone:'Asia/Tehran'},{id:'MHD',cityId:'b',name:'فرودگاه مشهد',kind:'airport' as const,code:'MHD',point:{latitude:36,longitude:59},timeZone:'Asia/Tehran'}],providerCapabilities:[...baseCatalog.providerCapabilities,{...baseCatalog.providerCapabilities[0]!,providerId:'other',name:'فروشنده دوم خیالی'}]};
describe('journey and provider offer facts',()=>{
 it('switches the displayed total, bag/refund conditions and breakdown to the exact chosen provider',async()=>{
  const data=group('a');const second=structuredClone(data.eligibleQuotes[0]!);second.quoteId='other-quote';second.providerId='other';second.total.amountRial=20000000;second.conditions.outbound.checkedBaggageKg={status:'unknown',reason:'not-reported'};second.conditions.outbound.refundable={status:'known',value:true};second.breakdown=[{code:'base',amount:second.total,mandatory:true}];data.eligibleQuotes.push(second);
  function Harness(){const[state,dispatch]=useReducer(resultsReducer,undefined,()=>resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:recovery([data])}));return <JourneyCard group={data} snapshot={state.adopted!.snapshot} catalog={catalog} state={state} now={Date.parse(observedAt)} onFreeze={()=>dispatch({type:'freeze'})} onSelect={selection=>dispatch({type:'select',selection,now:Date.parse(observedAt)})}/>;}
  const user=userEvent.setup();render(<Harness/>);await user.click(screen.getByRole('button',{name:'جزئیات و ۲ پیشنهاد فروشندگان'}));
  const other=screen.getByRole('region',{name:/فروشنده دوم خیالی/});await user.click(within(other).getByRole('button',{name:'انتخاب این پیشنهاد'}));
  const card=screen.getByRole('article');expect(card).toHaveAttribute('data-quote-id','other-quote');expect(card).toHaveAttribute('data-amount-rial','20000000');
  const facts=within(card).getByLabelText('شرایط پیشنهاد نمایش‌داده‌شده');expect(facts).toHaveTextContent('بار تحویلی: نامشخص');expect(facts).toHaveTextContent('قابل استرداد طبق شرایط فروشنده');expect(facts).toHaveTextContent('فروشنده دوم خیالی');
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
  expect(screen.getByRole('button',{name:'انتخاب پیشنهاد'})).toBeDisabled();await userEvent.setup().click(screen.getByRole('button',{name:'جزئیات و ۰ پیشنهاد فروشندگان'}));const incomplete=screen.getByRole('region',{name:'پیشنهادهای با قیمت ناقص'});expect(incomplete).toHaveTextContent('قیمت نهایی نامشخص');expect(within(incomplete).queryByRole('button')).not.toBeInTheDocument();
 });
});
