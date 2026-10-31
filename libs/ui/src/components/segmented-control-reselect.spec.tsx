import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {SegmentedControl} from './segmented-control';
import {MotionPolicyProvider} from '../motion/motion-surface';

const options=[{id:'economy',label:'اقتصادی'},{id:'business',label:'تجاری'}];
beforeEach(()=>vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}})));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const label=(name:string)=>screen.getByRole('radio',{name}).closest<HTMLElement>('[data-segment-option]')!;

it('opt-in reselection dispatches once for pointer, Space and Enter while a first selection only changes the value',async()=>{
 const user=userEvent.setup(),change=vi.fn(),reselect=vi.fn();
 const view=render(<SegmentedControl label="کلاس" value="economy" onChange={change} onReselect={reselect} options={options}/>);
 await user.click(label('اقتصادی'));expect(reselect).toHaveBeenCalledExactlyOnceWith('economy');expect(change).not.toHaveBeenCalled();
 screen.getByRole('radio',{name:'اقتصادی'}).focus();await user.keyboard(' ');expect(reselect).toHaveBeenCalledTimes(2);await user.keyboard(' ');expect(reselect).toHaveBeenCalledTimes(3);
 fireEvent.click(screen.getByRole('radio',{name:'اقتصادی'}));expect(reselect).toHaveBeenCalledTimes(4);fireEvent.click(screen.getByRole('radio',{name:'اقتصادی'}));expect(reselect).toHaveBeenCalledTimes(5);
 await user.keyboard('{Enter}');expect(reselect.mock.calls.map(call=>call[0])).toEqual(Array.from({length:6},()=> 'economy'));expect(change).not.toHaveBeenCalled();
 await user.click(label('تجاری'));expect(change).toHaveBeenCalledExactlyOnceWith('business');expect(reselect).toHaveBeenCalledTimes(6);
 view.rerender(<SegmentedControl label="کلاس" value="business" onChange={change} onReselect={reselect} options={options}/>);await user.click(label('تجاری'));expect(reselect).toHaveBeenLastCalledWith('business');expect(reselect).toHaveBeenCalledTimes(7);expect(change).toHaveBeenCalledTimes(1);
});

it('ordinary callback/focus/hover renders preserve the action owner of an otherwise current selected press',async()=>{
 const user=userEvent.setup(),original=vi.fn(),replacement=vi.fn(),change=vi.fn();
 const view=render(<SegmentedControl label="کلاس" value="economy" onChange={change} onReselect={original} options={options}/>);
 await user.pointer({target:label('اقتصادی'),keys:'[MouseLeft>]'});
 view.rerender(<SegmentedControl label="کلاس" value="economy" onChange={change} onReselect={replacement} options={[...options]}/>);
 await user.pointer({target:label('اقتصادی'),keys:'[/MouseLeft]'});expect(original).toHaveBeenCalledExactlyOnceWith('economy');expect(replacement).not.toHaveBeenCalled();expect(change).not.toHaveBeenCalled();
});

it('a first keyboard selection changes once without reselecting through its native compatibility click',async()=>{
 const user=userEvent.setup(),change=vi.fn(),reselect=vi.fn();
 function ControlledOwner(){const [value,setValue]=useState('economy');return <SegmentedControl label="کلاس" value={value} onChange={next=>{change(next);setValue(next);}} onReselect={reselect} options={options}/>;}
 render(<ControlledOwner/>);const business=screen.getByRole('radio',{name:'تجاری'});business.focus();await user.keyboard(' ');expect(change).toHaveBeenCalledExactlyOnceWith('business');expect(business).toBeChecked();expect(reselect).not.toHaveBeenCalled();
 await user.keyboard(' ');expect(reselect).toHaveBeenCalledExactlyOnceWith('business');expect(change).toHaveBeenCalledTimes(1);expect(business).toBeChecked();
});

it.each(['covered','disabled','signature','selection','removed-handler'] as const)('retires a selected press across %s changes rather than reviving its old action',async kind=>{
 const user=userEvent.setup(),change=vi.fn(),reselect=vi.fn();
 const tree=(altered:boolean)=><MotionPolicyProvider covered={altered&&kind==='covered'}><SegmentedControl label="کلاس" value={altered&&kind==='selection'?'business':'economy'} onChange={change} onReselect={altered&&kind==='removed-handler'?undefined:reselect} isDisabled={altered&&kind==='disabled'} options={altered&&kind==='signature'?options.map(option=>({...option,label:option.label+' تازه'})):options}/></MotionPolicyProvider>;
 const view=render(tree(false));await user.pointer({target:label('اقتصادی'),keys:'[MouseLeft>]'});view.rerender(tree(true));
 // Even a return to the same enabled option does not revive the retired press.
 view.rerender(tree(false));await user.pointer({target:label('اقتصادی'),keys:'[/MouseLeft]'});expect(reselect).not.toHaveBeenCalled();
 await user.click(label('اقتصادی'));expect(reselect).toHaveBeenCalledExactlyOnceWith('economy');
});
