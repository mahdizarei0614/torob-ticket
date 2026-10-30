import {fireEvent,render,screen} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
import {HotelCard} from './hotel-card';
import {hotelFixture,hotelSnapshot} from './hotel-test-data';
import {catalog} from '../search/search-test-data';

describe('compact selectable hotel cards',()=>{
 it('shows the exact whole-stay total and selects the same hotel id without a room configuration or fake handoff',()=>{
  const snapshot=hotelSnapshot(),inspect=vi.fn();render(<HotelCard hotel={hotelFixture} result={snapshot.results![0]!} quotes={snapshot.quotes} catalog={catalog} disabled={false} onSelectHotel={inspect}/>);
  expect(screen.getByRole('group',{name:/مجموع ۲ اتاق برای ۲ شب/})).toBeInTheDocument();expect(screen.getByText('درجه اعلام نشده')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:/انتخاب هتل/}));expect(inspect).toHaveBeenCalledWith('hotel');expect(screen.queryByRole('link')).toBeNull();expect(screen.queryByRole('spinbutton')).toBeNull();
 });
 it('lets an incomplete hotel be inspected without presenting its subtotal as a selectable complete price',()=>{
  const inspect=vi.fn();render(<HotelCard hotel={hotelFixture} result={{hotelId:'hotel',status:'incomplete',reasons:['local-mandatory-fee'],representativeQuoteId:null,quoteIds:[],arrivalDistanceKm:null,locationDistanceKm:null,distanceKind:'straight-line',knownSubtotal:{amountRial:1000000,currency:'IRR'}}} quotes={[]} catalog={catalog} disabled={false} onSelectHotel={inspect}/>);
  expect(screen.queryByRole('group',{name:/تومان/})).toBeNull();expect(screen.getByText('هزینه نهایی کامل اعلام نشده')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:/انتخاب هتل/}));expect(inspect).toHaveBeenCalledWith('hotel');
 });
 it('marks a map-selected hotel and preserves an accepted higher-version price on its card',()=>{
  const snapshot=hotelSnapshot(),fresh={...snapshot.quotes[0]!,version:2,total:{amountRial:45000000,currency:'IRR' as const}};
  render(<HotelCard hotel={hotelFixture} result={snapshot.results![0]!} quotes={snapshot.quotes} catalog={catalog} disabled={false} selected={fresh} isSelected onSelectHotel={vi.fn()}/>);
  expect(screen.getByRole('button',{name:/انتخاب هتل/})).toHaveAttribute('aria-pressed','true');expect(screen.getByRole('group',{name:/۴٬۵۰۰٬۰۰۰ تومان/})).toBeInTheDocument();
 });
 it('blocks obsolete card actions and never selects an expired quote through its compatibility action',()=>{
  const old=hotelSnapshot(Date.now()-700000),inspect=vi.fn(),select=vi.fn();const view=render(<HotelCard hotel={hotelFixture} result={old.results![0]!} quotes={old.quotes} catalog={catalog} disabled onSelectHotel={inspect}/>);
  fireEvent.click(screen.getByRole('button',{name:/انتخاب هتل/}));expect(inspect).not.toHaveBeenCalled();
  view.rerender(<HotelCard hotel={hotelFixture} result={old.results![0]!} quotes={old.quotes} catalog={catalog} disabled={false} onSelect={select}/>);fireEvent.click(screen.getByRole('button',{name:/انتخاب هتل/}));expect(select).not.toHaveBeenCalled();expect(screen.getByText('نیاز به قیمت تازه')).toBeInTheDocument();
 });
});
