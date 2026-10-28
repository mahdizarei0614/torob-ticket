import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DateExplorer } from './date-explorer';
import { catalog,query,session } from '../search/search-test-data';
vi.mock('./date-chart',()=>({DateChart:()=>null}));
vi.mock('./use-date-prices',()=>({useDatePrices:()=>({waiting:false,retryable:false})}));
describe('calendar external intent invalidation',()=>{
  it('places the calendar action after the nearby wheel in the same compact column and keeps cancel provisional',()=>{
    const commit=vi.fn();render(<DateExplorer catalog={catalog} session={session} draft={query} onCommit={commit} onPreview={vi.fn()} onCovered={vi.fn()} onInteractionChange={vi.fn()}/>);
    const wheel=screen.getByRole('listbox',{name:'روزهای نزدیک'}),trigger=screen.getByRole('button',{name:'تقویم جلالی و انتخاب تاریخ'});
    expect(wheel.parentElement?.parentElement).toBe(trigger.parentElement);
    expect(wheel.compareDocumentPosition(trigger)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(trigger);fireEvent.click(screen.getByRole('button',{name:'انصراف'}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(commit).not.toHaveBeenCalled();
  });
  it('discards old whole-draft calendar data and uncovers/focuses the trigger after a same-date party restore',()=>{
    const commit=vi.fn(),covered=vi.fn();const props={catalog,session,onCommit:commit,onPreview:vi.fn(),onCovered:covered,onInteractionChange:vi.fn()};
    const view=render(<DateExplorer {...props} draft={{...query,party:{adults:2,children:0,infants:0}}}/>);
    fireEvent.click(screen.getByRole('button',{name:'تقویم جلالی و انتخاب تاریخ'}));fireEvent.click(screen.getByText('ورود تاریخ میلادی'));fireEvent.change(screen.getByLabelText('تاریخ رفت میلادی در تقویم'),{target:{value:'2026-10-26'}});
    view.rerender(<DateExplorer {...props} draft={query}/>);const apply=screen.queryByRole('button',{name:'اعمال تاریخ‌ها'});if(apply)fireEvent.click(apply);
    expect(commit).not.toHaveBeenCalled();expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(covered).toHaveBeenLastCalledWith(false);
  });
});
