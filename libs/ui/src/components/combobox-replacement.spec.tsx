import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it} from 'vitest';
import {useRef,useState} from 'react';
import {ComboBox} from './combobox';

afterEach(cleanup);
const cities=[{id:'tehran',label:'تهران',code:'THR'},{id:'mashhad',label:'مشهد',code:'MHD'},{id:'shiraz',label:'شیراز',code:'SYZ'}];
function City(){
 const [selected,setSelected]=useState<string|null>('mashhad'),[text,setText]=useState('مشهد'),current=useRef(selected);current.current=selected;
 return <><ComboBox label="مقصد" items={cities} selectedKey={selected} inputValue={text} clearable
  onSelectionChange={id=>{current.current=id;setSelected(id);}}
  onInputChange={value=>{setText(value);if(value!==cities.find(c=>c.id===current.current)?.label)setSelected(null);}}/><output aria-label="شهر تاییدشده">{selected}</output></>;
}
it('preserves a replacement query when editing invalidates the previously selected city',async()=>{
 const user=userEvent.setup();render(<City/>);const input=screen.getByRole('combobox',{name:'مقصد'});
 await user.click(input);fireEvent.change(input,{target:{value:'شیراز'}});
 expect(input).toHaveValue('شیراز');expect(screen.getByLabelText('شهر تاییدشده')).toBeEmptyDOMElement();
 expect(await screen.findByRole('option',{name:/شیراز/})).toBeVisible();await user.keyboard('{ArrowDown}{Enter}');
 expect(input).toHaveValue('شیراز');expect(screen.getByLabelText('شهر تاییدشده')).toHaveTextContent('shiraz');
});
it('keeps the first replacement keystroke and lets explicit Clear erase both text and selection',async()=>{
 const user=userEvent.setup();render(<City/>);const input=screen.getByRole('combobox',{name:'مقصد'});
 await user.click(input);input.setSelectionRange(0,4);await user.type(input,'شیراز',{skipClick:true});
 expect(input).toHaveValue('شیراز');await user.keyboard('{ArrowDown}{Enter}');expect(screen.getByLabelText('شهر تاییدشده')).toHaveTextContent('shiraz');
 await user.click(screen.getByRole('button',{name:'پاک کردن مقصد'}));expect(input).toHaveValue('');expect(input).toHaveFocus();expect(screen.getByLabelText('شهر تاییدشده')).toBeEmptyDOMElement();
 await user.type(input,'تهران');await user.keyboard('{ArrowDown}{Enter}');expect(input).toHaveValue('تهران');expect(screen.getByLabelText('شهر تاییدشده')).toHaveTextContent('tehran');
});
it('does not erase typed text when focus moves away before a replacement city is selected',async()=>{
 const user=userEvent.setup();render(<City/>);const input=screen.getByRole('combobox',{name:'مقصد'});
 await user.click(input);fireEvent.input(input,{target:{value:'شیراز'}});
 expect(input).toHaveValue('شیراز');await user.tab();
 expect(input).toHaveValue('شیراز');expect(screen.getByLabelText('شهر تاییدشده')).toBeEmptyDOMElement();
 await user.click(input);expect(await screen.findByRole('option',{name:/شیراز/})).toBeVisible();await user.keyboard('{ArrowDown}{Enter}');
 expect(screen.getByLabelText('شهر تاییدشده')).toHaveTextContent('shiraz');
});
it('Escape closes replacement suggestions while preserving unconfirmed text through another render',async()=>{
 const user=userEvent.setup(),view=render(<City/>),input=screen.getByRole('combobox',{name:'مقصد'});
 await user.click(input);fireEvent.input(input,{target:{value:'شیراز'}});
 expect(await screen.findByRole('option',{name:/شیراز/})).toBeVisible();await user.keyboard('{Escape}');
 expect(input).toHaveValue('شیراز');expect(screen.getByLabelText('شهر تاییدشده')).toBeEmptyDOMElement();
 expect(input).toHaveAttribute('aria-expanded','false');
 await act(async()=>{view.rerender(<City/>);await Promise.resolve();});
 expect(input).toHaveValue('شیراز');expect(input).toHaveAttribute('aria-expanded','false');
 expect(screen.queryByRole('option',{name:/شیراز/})).not.toBeInTheDocument();
});
