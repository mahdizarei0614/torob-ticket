import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DateExplorer } from './date-explorer';
import { SearchComposer } from '../search/search-composer';
import { validateDraft, type SearchDraft } from '../search/search-url';
import { catalog,query,session } from '../search/search-test-data';
vi.mock('./date-chart',()=>({DateChart:()=>null}));
vi.mock('./use-date-prices',()=>({useDatePrices:()=>({waiting:false,retryable:false})}));
describe('calendar external intent invalidation',()=>{
  it('keeps the portalled leg on the invalidated return and fences provisional work without inventing a return date',()=>{
    const commit=vi.fn(),props={catalog,session,onCommit:commit,onPreview:vi.fn(),onCovered:vi.fn(),onInteractionChange:vi.fn()};
    const form=(draft:SearchDraft)=><SearchComposer draft={draft} catalog={catalog} session={session} edit={vi.fn()} onSubmit={vi.fn()} errors={validateDraft(draft,catalog,session).errors} pending={false} disabled={false} dateExplorer={<DateExplorer {...props} draft={draft}/>}/>;
    const view=render(form({...query,tripType:'round-trip',returnDate:'2026-10-26'}));
    const explorer=screen.getByRole('region',{name:'کاوش تاریخ سفر'}),calendar=screen.getByRole('button',{name:'تقویم جلالی و انتخاب تاریخ'});
    fireEvent.click(calendar); expect(screen.getByRole('dialog')).toBeInTheDocument();
    view.rerender(form({...query,departureDate:'2026-10-27',tripType:'round-trip',returnDate:undefined}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(explorer).toHaveAttribute('data-date-leg','return');
    expect(screen.getByRole('radio',{name:'تاریخ برگشت'})).toBeChecked(); expect(explorer).toHaveAttribute('data-selected-return','');
    expect(screen.getByRole('button',{name:'تقویم جلالی و انتخاب تاریخ'})).toBe(calendar); expect(commit).not.toHaveBeenCalled();
  });
  it('places the calendar action after the nearby wheel in the same compact column and keeps cancel provisional',()=>{
    const commit=vi.fn();render(<DateExplorer catalog={catalog} session={session} draft={query} onCommit={commit} onPreview={vi.fn()} onCovered={vi.fn()} onInteractionChange={vi.fn()}/>);
    const wheel=screen.getByRole('listbox',{name:'روزهای نزدیک'}),trigger=screen.getByRole('button',{name:'تقویم جلالی و انتخاب تاریخ'});
    expect(wheel.parentElement?.parentElement).toBe(trigger.parentElement?.parentElement);
    expect(trigger).toHaveTextContent('تقویم و تاریخ'); expect(trigger.querySelector('svg')).toBeInTheDocument();
    expect(wheel.compareDocumentPosition(trigger)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(trigger);fireEvent.click(screen.getByRole('button',{name:'انصراف'}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(commit).not.toHaveBeenCalled();
  });
  it('moves to the return wheel when a later departure invalidates the return, without selecting a replacement',()=>{
    const commit=vi.fn();const props={catalog,session,onCommit:commit,onPreview:vi.fn(),onCovered:vi.fn(),onInteractionChange:vi.fn()};
    const view=render(<DateExplorer {...props} draft={{...query,tripType:'round-trip',returnDate:'2026-10-26'}}/>);
    view.rerender(<DateExplorer {...props} draft={{...query,departureDate:'2026-10-27',tripType:'round-trip',returnDate:undefined}}/>);
    expect(screen.getByRole('radio',{name:'تاریخ برگشت'})).toBeChecked();
    fireEvent.click(screen.getByRole('radio',{name:'تاریخ رفت'}));
    expect(screen.getByRole('radio',{name:'تاریخ رفت'})).toBeChecked();
    expect(commit).not.toHaveBeenCalled();
  });
  it('allows explicit outbound and return editing inside a provisional calendar when return is missing',()=>{
    const commit=vi.fn();render(<DateExplorer catalog={catalog} session={session} draft={{...query,tripType:'round-trip',returnDate:undefined}} onCommit={commit} onPreview={vi.fn()} onCovered={vi.fn()} onInteractionChange={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'تقویم جلالی و انتخاب تاریخ'}));
    fireEvent.change(screen.getByLabelText('بخش سفر در تقویم'),{target:{value:'outbound'}});
    expect(screen.getByLabelText('بخش سفر در تقویم')).toHaveValue('outbound');
    fireEvent.click(screen.getByText('ورود تاریخ میلادی'));
    fireEvent.change(screen.getByLabelText('تاریخ رفت میلادی در تقویم'),{target:{value:'2026-10-26'}});
    fireEvent.change(screen.getByLabelText('تاریخ برگشت میلادی در تقویم'),{target:{value:'2026-10-29'}});
    fireEvent.click(screen.getByRole('button',{name:'اعمال تاریخ‌ها'}));
    expect(commit).toHaveBeenCalledWith(expect.objectContaining({departureDate:'2026-10-26',returnDate:'2026-10-29'}));
  });
  it('discards old whole-draft calendar data and uncovers/focuses the trigger after a same-date party restore',()=>{
    const commit=vi.fn(),covered=vi.fn();const props={catalog,session,onCommit:commit,onPreview:vi.fn(),onCovered:covered,onInteractionChange:vi.fn()};
    const view=render(<DateExplorer {...props} draft={{...query,party:{adults:2,children:0,infants:0}}}/>);
    fireEvent.click(screen.getByRole('button',{name:'تقویم جلالی و انتخاب تاریخ'}));fireEvent.click(screen.getByText('ورود تاریخ میلادی'));fireEvent.change(screen.getByLabelText('تاریخ رفت میلادی در تقویم'),{target:{value:'2026-10-26'}});
    view.rerender(<DateExplorer {...props} draft={query}/>);const apply=screen.queryByRole('button',{name:'اعمال تاریخ‌ها'});if(apply)fireEvent.click(apply);
    expect(commit).not.toHaveBeenCalled();expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(covered).toHaveBeenLastCalledWith(false);
  });
});
