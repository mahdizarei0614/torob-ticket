import {StrictMode} from 'react';
import {act,cleanup,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {MotionPolicyProvider,MotionSurface} from './motion-surface';
beforeEach(()=>vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}})));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('the real Motion adapter mounts, settles and preserves semantic content/focus through static updates under StrictMode',()=>{const view=render(<StrictMode><MotionSurface disabled motionKey="one"><section aria-label="Trip detail"><button>Continue comparison</button><p role="status">Cancellation unknown</p></section></MotionSurface></StrictMode>);const button=screen.getByRole('button');act(()=>button.focus());view.rerender(<StrictMode><MotionSurface disabled motionKey="two"><section aria-label="Trip detail"><button>Continue comparison</button><p role="status">Cancellation unknown</p></section></MotionSurface></StrictMode>);expect(document.activeElement).toBe(button);expect(screen.getAllByRole('status')).toHaveLength(1);expect(screen.getByRole('region',{name:'Trip detail'})).toBeVisible();expect(view.container.querySelector('[data-motion-policy]')).toHaveAttribute('data-motion-policy','static');view.unmount();expect(screen.queryByRole('button')).toBeNull();});
it('keeps an active entry moving after StrictMode replay and settles real coverage without replay on resume',async()=>{
 const tree=(covered:boolean,text:string)=><StrictMode><MotionPolicyProvider covered={covered}><MotionSurface purpose="dock" motionKey="arrival" data-testid="dock-surface"><button>Hotels</button><span>{text}</span></MotionSurface></MotionPolicyProvider></StrictMode>;
 const view=render(tree(false,'Original')),surface=screen.getByTestId('dock-surface'),button=screen.getByRole('button');expect(Number(surface.style.opacity)).toBeLessThan(1);
 await waitFor(()=>{expect(Number(surface.style.opacity)).toBeGreaterThan(0);expect(Number(surface.style.opacity)).toBeLessThan(1);},{interval:10});act(()=>button.focus());view.rerender(tree(false,'Updated'));expect(screen.getByTestId('dock-surface')).toBe(surface);expect(button).toHaveFocus();
 view.rerender(tree(true,'Covered'));await waitFor(()=>expect(surface.style.opacity).toBe('1'));view.rerender(tree(false,'Resumed'));expect(surface.style.opacity).toBe('1');expect(button).toHaveFocus();
});
