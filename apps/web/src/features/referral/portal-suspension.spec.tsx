import {useState} from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import {it,expect} from 'vitest';
import {Dialog,DialogSuspensionProvider,ThemeProvider} from '@torob-ticket/ui';
function Fixture(){const [covered,setCovered]=useState(false),[open,setOpen]=useState(true);return <ThemeProvider><button onClick={()=>setCovered(v=>!v)}>provider</button><output>{String(open)}</output><DialogSuspensionProvider value={covered}><Dialog title="hotel" isOpen={open} onOpenChange={setOpen}><input aria-label="draft" defaultValue="retained"/></Dialog></DialogSuspensionProvider></ThemeProvider>;}
it('visually suspends portal/focus trap without erasing the independent open model',()=>{render(<Fixture/>);expect(screen.getByRole('dialog',{name:'hotel'})).toBeTruthy();fireEvent.change(screen.getByLabelText('draft'),{target:{value:'independent stay'}});fireEvent.click(screen.getByText('provider'));expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getByText('true')).toBeTruthy();fireEvent.click(screen.getByText('provider'));expect(screen.getByRole('dialog',{name:'hotel'})).toBeTruthy();expect(screen.getByText('true')).toBeTruthy();});
