// Actual filter regressions adapted from independently reproduced R2/R3.
import { render,screen,fireEvent,cleanup,within } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import { displayOperatorName } from '@torob-ticket/ui';
import { ResultFilters } from './result-filters';
import { catalog,query } from '../search/search-test-data';
import { group,recovery } from './results-test-data';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('Cancel abandons provisional result filters instead of committing them after reopening',()=>{
 const committed={...query,filters:{budgetMaxRial:50000000}};const apply=vi.fn();
 render(<ResultFilters query={committed} snapshot={recovery([group('a')]).snapshot} catalog={catalog} disabled={false} onApply={apply}/>);
 fireEvent.click(screen.getByRole('button',{name:/فیلتر نتایج/}));
 fireEvent.change(screen.getByLabelText('سقف مبلغ کل (تومان)'),{target:{value:'1'}});
 fireEvent.click(screen.getByRole('button',{name:'انصراف از فیلتر'}));
 expect(apply).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:/فیلتر نتایج/}));

 expect(screen.getByLabelText('سقف مبلغ کل (تومان)')).toHaveValue(5000000);
});
it('Clear committed filters does not require correcting an invalid provisional value first',()=>{
 const apply=vi.fn();render(<ResultFilters query={{...query,filters:{refundableOnly:true}}} snapshot={recovery([group('a')]).snapshot} catalog={catalog} disabled={false} onApply={apply}/>);
 fireEvent.click(screen.getByRole('button',{name:/فیلتر نتایج/}));fireEvent.change(screen.getByLabelText('سقف مبلغ کل (تومان)'),{target:{value:'-1'}});
 fireEvent.click(screen.getByRole('button',{name:'پاک کردن فیلترها'}));

 expect(apply).toHaveBeenCalledWith({...query,filters:{}});
});
it('Cancel discards every filter/class field and validation error, restores committed query and returns focus',()=>{
 const extended={...catalog,classChoices:[...catalog.classChoices,{mode:'flight' as const,code:'business',name:'تجاری'}]};
 const committed={...query,filters:{budgetMaxRial:50000000,maxStopsOrTransfers:3,checkedBaggageMinKg:20,refundableOnly:true,providerIds:['p'],operatorIds:['demo-operator-flight-0'],departureWindow:{startMinute:480,endMinute:1080}}};
 const apply=vi.fn();render(<ResultFilters query={committed} snapshot={recovery([group('a')]).snapshot} catalog={extended} disabled={false} onApply={apply}/>);
 const trigger=screen.getByRole('button',{name:/فیلتر نتایج/});fireEvent.click(trigger);
 fireEvent.change(screen.getByLabelText('سقف مبلغ کل (تومان)'),{target:{value:'-1'}});fireEvent.change(screen.getByLabelText('حداکثر توقف'),{target:{value:'0'}});fireEvent.change(screen.getByLabelText('حداقل بار تحویلی (کیلوگرم)'),{target:{value:'0'}});fireEvent.change(screen.getByLabelText('کلاس نتایج'),{target:{value:'business'}});
 fireEvent.click(screen.getByLabelText('فقط قابل استرداد؛ شرایط نامشخص پذیرفته نمی‌شود'));fireEvent.click(screen.getByLabelText('خیالی'));fireEvent.click(screen.getByLabelText(displayOperatorName('demo-operator-flight-0','flight')));fireEvent.click(screen.getByLabelText('محدود کردن بازه حرکت'));
 fireEvent.submit(screen.getByRole('form',{name:'فیلتر پیشنهادهای سفر'}));expect(screen.getByRole('alert')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'انصراف از فیلتر'}));expect(trigger).toHaveFocus();expect(apply).not.toHaveBeenCalled();
 fireEvent.click(trigger);expect(screen.getByLabelText('سقف مبلغ کل (تومان)')).toHaveValue(5000000);expect(screen.getByLabelText('حداکثر توقف')).toHaveValue(3);expect(screen.getByLabelText('حداقل بار تحویلی (کیلوگرم)')).toHaveValue(20);expect(screen.getByLabelText('کلاس نتایج')).toHaveValue('economy');expect(screen.getByLabelText('فقط قابل استرداد؛ شرایط نامشخص پذیرفته نمی‌شود')).toBeChecked();expect(screen.getByLabelText('خیالی')).toBeChecked();expect(screen.getByLabelText(displayOperatorName('demo-operator-flight-0','flight'))).toBeChecked();expect(screen.getByLabelText('از ساعت')).toHaveValue('08:00');expect(screen.getByLabelText('تا ساعت')).toHaveValue('18:00');expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('Escape and toggle-close discard changes before another open without applying',()=>{
 const apply=vi.fn();render(<ResultFilters query={query} snapshot={recovery([group('a')]).snapshot} catalog={catalog} disabled={false} onApply={apply}/>);const trigger=screen.getByRole('button',{name:/فیلتر نتایج/});fireEvent.click(trigger);const budget=screen.getByLabelText('سقف مبلغ کل (تومان)');budget.focus();fireEvent.change(budget,{target:{value:'10'}});fireEvent.keyDown(budget,{key:'Escape'});expect(trigger).toHaveFocus();expect(screen.queryByRole('form')).not.toBeInTheDocument();fireEvent.click(trigger);expect(screen.getByLabelText('سقف مبلغ کل (تومان)')).toHaveValue(null);fireEvent.change(screen.getByLabelText('سقف مبلغ کل (تومان)'),{target:{value:'20'}});fireEvent.click(trigger);fireEvent.click(trigger);expect(screen.getByLabelText('سقف مبلغ کل (تومان)')).toHaveValue(null);expect(apply).not.toHaveBeenCalled();
});

it('an obsolete panel cannot apply, reopen or return focus into the old result region',()=>{
 let current=true;const apply=vi.fn();render(<ResultFilters isCurrent={()=>current} query={query} snapshot={recovery([group('a')]).snapshot} catalog={catalog} disabled={false} onApply={apply}/>);const trigger=screen.getByRole('button',{name:/فیلتر نتایج/});fireEvent.click(trigger);screen.getByLabelText('سقف مبلغ کل (تومان)').focus();current=false;fireEvent.click(screen.getByRole('button',{name:'پاک کردن فیلترها'}));expect(apply).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'انصراف از فیلتر'}));expect(trigger).not.toHaveFocus();fireEvent.click(trigger);expect(screen.queryByRole('form')).not.toBeInTheDocument();
});

it('retains only decorative exits and fences their submit, clear, input and Escape events after a rapid reopen',()=>{
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));
 const apply=vi.fn();render(<ResultFilters query={query} snapshot={recovery([group('a')]).snapshot} catalog={catalog} disabled={false} onApply={apply}/>);
 const trigger=screen.getByRole('button',{name:'فیلتر نتایج'});fireEvent.click(trigger);
 const oldForm=screen.getByRole('form',{name:'فیلتر پیشنهادهای سفر'}),oldScope=within(oldForm);
 const oldInput=oldScope.getByLabelText('سقف مبلغ کل (تومان)'),oldClear=oldScope.getByRole('button',{name:'پاک کردن فیلترها'}),oldCancel=oldScope.getByRole('button',{name:'انصراف از فیلتر'});
 fireEvent.click(trigger);
 expect(oldForm.isConnected).toBe(true);
 expect(oldForm.closest('[data-content-presence]')).toHaveAttribute('inert');
 expect(oldForm.closest('[data-content-presence]')).toHaveAttribute('aria-hidden','true');
 expect(screen.queryByRole('form')).not.toBeInTheDocument();
 fireEvent.submit(oldForm);fireEvent.click(oldClear);expect(apply).not.toHaveBeenCalled();
 fireEvent.click(trigger);
 const currentForm=screen.getByRole('form',{name:'فیلتر پیشنهادهای سفر'}),currentInput=within(currentForm).getByLabelText('سقف مبلغ کل (تومان)');
 expect(currentForm).not.toBe(oldForm);currentInput.focus();fireEvent.change(currentInput,{target:{value:'22'}});
 fireEvent.change(oldInput,{target:{value:'99'}});fireEvent.submit(oldForm);fireEvent.click(oldClear);fireEvent.keyDown(oldInput,{key:'Escape'});fireEvent.click(oldCancel);
 expect(apply).not.toHaveBeenCalled();expect(currentInput).toHaveValue(22);expect(currentInput).toHaveFocus();
 expect(screen.getByRole('form',{name:'فیلتر پیشنهادهای سفر'})).toBe(currentForm);expect(trigger).toHaveAttribute('aria-expanded','true');
 fireEvent.submit(currentForm);expect(apply).toHaveBeenCalledExactlyOnceWith({...query,filters:{budgetMaxRial:220}});
});

it('changes the current stop and departure words without replacing focused inputs or provisional values',()=>{
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));
 const props={snapshot:recovery([group('a')]).snapshot,catalog,disabled:false,onApply:vi.fn()};
 const view=render(<ResultFilters {...props} query={query}/>);fireEvent.click(screen.getByRole('button',{name:'فیلتر نتایج'}));
 const maximum=screen.getByRole('spinbutton',{name:'حداکثر توقف'});maximum.focus();fireEvent.change(maximum,{target:{value:'2'}});
 expect(screen.getByRole('spinbutton',{name:'حداکثر توقف'})).toBe(maximum);expect(maximum).toHaveFocus();
 view.rerender(<ResultFilters {...props} query={{...query,mode:'train',tripType:'round-trip',returnDate:'2026-11-03',classCode:'coupe',filters:{refundableOnly:true}}}/>);
 expect(screen.getByRole('spinbutton',{name:'حداکثر مجموع تعویض وسیله'})).toBe(maximum);
 expect(screen.queryByRole('spinbutton',{name:'حداکثر توقف'})).not.toBeInTheDocument();expect(maximum).toHaveValue(2);expect(maximum).toHaveFocus();
 expect(screen.getByRole('group',{name:'ساعت حرکت رفت به وقت محلی مبدا'})).toBeInTheDocument();
 expect(screen.queryByRole('group',{name:'ساعت حرکت به وقت محلی مبدا'})).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'فیلتر نتایج · ۱'})).toHaveAttribute('aria-expanded','true');
});
