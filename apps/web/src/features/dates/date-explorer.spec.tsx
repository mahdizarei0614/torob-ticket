import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DateExplorer } from './date-explorer';
import { catalog,query,session } from '../search/search-test-data';
vi.mock('./date-chart',()=>({DateChart:()=>null}));
vi.mock('./use-date-prices',()=>({useDatePrices:()=>({waiting:false,retryable:false})}));
describe('calendar external intent invalidation',()=>{
  it('discards old whole-draft calendar data and uncovers/focuses the trigger after a same-date party restore',()=>{
    const commit=vi.fn(),covered=vi.fn();const props={catalog,session,onCommit:commit,onPreview:vi.fn(),onCovered:covered,onInteractionChange:vi.fn()};
    const view=render(<DateExplorer {...props} draft={{...query,party:{adults:2,children:0,infants:0}}}/>);
    fireEvent.click(screen.getByRole('button',{name:'تقویم جلالی و انتخاب تاریخ'}));fireEvent.change(screen.getByLabelText('تاریخ رفت میلادی در تقویم'),{target:{value:'2026-10-26'}});
    view.rerender(<DateExplorer {...props} draft={query}/>);const apply=screen.queryByRole('button',{name:'اعمال تاریخ‌ها'});if(apply)fireEvent.click(apply);
    expect(commit).not.toHaveBeenCalled();expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(covered).toHaveBeenLastCalledWith(false);
  });
});
