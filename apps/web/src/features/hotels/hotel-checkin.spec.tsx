import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {HotelQuoteSnapshot} from '@torob-ticket/contracts';
import {hotelFixture, hotelQuote} from './hotel-test-data';
import {HotelSelection} from './hotel-selection';
import {RoomRates} from './room-rates';

function show(surface:'selection'|'rates',quote:HotelQuoteSnapshot){
 if(surface==='rates')return render(<RoomRates quote={quote} disabled={false} selected onSelect={vi.fn()}/>);
 const view=render(<HotelSelection hotel={hotelFixture} quote={quote} pending={false} onRefresh={vi.fn()}/>);
 fireEvent.click(screen.getByLabelText('جزئیات اقامت هتل نمونه'));
 return view;
}
describe.each(['selection','rates'] as const)('%s check-in conditions',surface=>{
 it('shows an unpublished time explicitly without fabricating a standard hour',()=>{
  const quote=hotelQuote();quote.roomDetails=quote.roomDetails!.map(detail=>{const{checkInLocalTime:_time,...policy}=detail.policy;void _time;return{...detail,policy};});
  show(surface,quote);
  expect(screen.getAllByText(/ساعت پذیرش اعلام نشده/)).toHaveLength(quote.roomAllocation.length);
  expect(screen.queryByText('14:00')).not.toBeInTheDocument();
  expect(screen.getAllByText(/ورود زودتر تضمین نمی‌شود/)).toHaveLength(quote.roomAllocation.length);
 });
 it('retains every recorded legacy check-in hour',()=>{
  const quote=hotelQuote(),before=JSON.stringify(quote);show(surface,quote);
  expect(screen.getAllByText('14:00')).toHaveLength(quote.roomAllocation.length);
  expect(screen.queryByText(/ساعت پذیرش اعلام نشده/)).not.toBeInTheDocument();
  expect(JSON.stringify(quote)).toBe(before);
 });
});
