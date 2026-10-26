import {render,screen} from '@testing-library/react';
import {it,expect,vi} from 'vitest';
import {DatePriceSnapshotSchema} from '@torob-ticket/contracts';
import {DateExplorer} from './date-explorer';
import {useDatePrices} from './use-date-prices';
import {catalog,query,session} from '../search/search-test-data';
vi.mock('./use-date-prices',()=>({useDatePrices:vi.fn()}));
vi.mock('./date-chart',()=>({DateChart:()=>null}));
it('keeps distinct date evidence rows while unknown coverage/time become actual priced evidence',()=>{
 const props={draft:query,catalog,session,onCommit:vi.fn(),onPreview:vi.fn(),onCovered:vi.fn(),onInteractionChange:vi.fn()};vi.mocked(useDatePrices).mockReturnValue({waiting:true,retryable:false,retry:vi.fn(),stale:false});const view=render(<DateExplorer {...props}/>);
 const row=screen.getByText('زمان مشاهده قیمت کامل در دسترس نیست.').parentElement!,before=Array.from(row.children);expect(before).toHaveLength(3);expect(row.querySelector('time')).toBeNull();expect(row.textContent).not.toContain('۰ از ۰');expect(screen.getByText('در انتظار ظرفیت بررسی قیمت روزها…').parentElement).toBe(row);
 const observedAt='2026-10-25T06:00:00.000Z',snapshot=DatePriceSnapshotSchema.parse({datePriceId:'days',clientGeneration:'dates',query:{query,leg:'outbound',dates:[query.departureDate],clientGeneration:'dates'},status:'complete',observedAt,cells:[{date:query.departureDate,status:'priced',minimum:{amountRial:1000000,currency:'IRR'},quoteIds:['q'],offerIds:['o'],observedAt,coverage:{complete:true,expectedProviderIds:['p'],successfulProviderIds:['p'],failedProviderIds:[],pendingProviderIds:[]}}]});vi.mocked(useDatePrices).mockReturnValue({waiting:false,retryable:false,retry:vi.fn(),stale:false,snapshot});view.rerender(<DateExplorer {...props}/>);expect(Array.from(row.children)).toEqual(before);expect(row.querySelector('time')).toHaveAttribute('datetime',observedAt);expect(row.textContent).toContain('۱ از ۱ فروشنده پاسخ موفق');expect(screen.queryByText('در انتظار ظرفیت بررسی قیمت روزها…')).toBeNull();
});
