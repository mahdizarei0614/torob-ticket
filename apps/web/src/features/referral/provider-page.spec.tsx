import {render,screen,waitFor,fireEvent} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,it,expect,vi} from 'vitest';
import {apiClient,ClientError} from '@torob-ticket/client';
import type {ReferralReceipt} from '@torob-ticket/contracts';
import {group} from '../results/results-test-data';
import {catalog} from '../search/search-test-data';
import {ProviderPage} from './provider-page';
const g=group('a'),quote=g.eligibleQuotes[0]!;
const receipt:ReferralReceipt={referralId:'receipt',intentId:'i',selection:{kind:'transport',quoteId:quote.quoteId,quoteVersion:quote.version},payload:{kind:'transport',quote,itinerary:g.itinerary},confirmedAt:'2026-10-25T06:01:00Z',handoffPath:'/provider-demo/receipt'};
afterEach(()=>{vi.restoreAllMocks();sessionStorage.clear();});
it('a cold provider visit reads immutable evidence only and Return never infers a missing checkpoint',async()=>{
 const get=vi.spyOn(apiClient,'getReferral').mockResolvedValue(receipt),read=vi.spyOn(apiClient,'catalogReadonly').mockResolvedValue(catalog),session=vi.spyOn(apiClient,'session'),prepare=vi.spyOn(apiClient,'prepareReferral'),confirm=vi.spyOn(apiClient,'confirmReferral'),returned=vi.fn();
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ProviderPage referralId="receipt" retained={false} onReturn={returned}/></QueryClientProvider>);
 await screen.findByText('ارجاع به فروشنده ثبت شد');expect(get).toHaveBeenCalledTimes(1);expect(read).toHaveBeenCalledTimes(1);expect(session).not.toHaveBeenCalled();expect(prepare).not.toHaveBeenCalled();expect(confirm).not.toHaveBeenCalled();
 session.mockResolvedValue({} as Awaited<ReturnType<typeof apiClient.session>>);fireEvent.click(screen.getByRole('button',{name:'بازگشت به مقایسه سفر'}));await screen.findByText(/زمینه این مقایسه در دسترس نیست/);expect(session).toHaveBeenCalledTimes(1);expect(returned).not.toHaveBeenCalled();expect(prepare).not.toHaveBeenCalled();expect(confirm).not.toHaveBeenCalled();
});
it('retained Return restores its owner directly without bootstrap or new mutation',async()=>{
 vi.spyOn(apiClient,'getReferral').mockResolvedValue(receipt);vi.spyOn(apiClient,'catalogReadonly').mockResolvedValue(catalog);const session=vi.spyOn(apiClient,'session'),returned=vi.fn();
 render(<QueryClientProvider client={new QueryClient()}><ProviderPage referralId="receipt" retained onReturn={returned}/></QueryClientProvider>);await screen.findByText('ارجاع به فروشنده ثبت شد');fireEvent.click(screen.getByRole('button',{name:'بازگشت به مقایسه سفر'}));await waitFor(()=>expect(returned).toHaveBeenCalledTimes(1));expect(session).not.toHaveBeenCalled();
});

it('a re-entered provider page cannot display a cached receipt without validating the current cookie scope',async()=>{
 const cache=new QueryClient();cache.setQueryData(['referral','receipt'],{receipt,catalog});
 const get=vi.spyOn(apiClient,'getReferral').mockRejectedValue(new ClientError('api','NOT_FOUND',{code:'NOT_FOUND',retryable:false,fieldPaths:[],requestId:'new-scope'},404));const session=vi.spyOn(apiClient,'session');
 render(<QueryClientProvider client={cache}><ProviderPage referralId="receipt" retained={false} onReturn={()=>undefined}/></QueryClientProvider>);
 await waitFor(()=>expect(get).toHaveBeenCalledTimes(1));expect(screen.queryByText('ارجاع به فروشنده ثبت شد')).toBeNull();await screen.findByText('این ارجاع در نشست فعلی پیدا نشد.');expect(session).not.toHaveBeenCalled();
});
