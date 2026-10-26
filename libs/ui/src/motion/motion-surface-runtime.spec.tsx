import {StrictMode} from 'react';
import {act,cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {MotionSurface} from './motion-surface';
afterEach(cleanup);
it('the real Motion adapter mounts, settles and preserves semantic content/focus through static updates under StrictMode',()=>{const view=render(<StrictMode><MotionSurface disabled motionKey="one"><section aria-label="Trip detail"><button>Continue comparison</button><p role="status">Cancellation unknown</p></section></MotionSurface></StrictMode>);const button=screen.getByRole('button');act(()=>button.focus());view.rerender(<StrictMode><MotionSurface disabled motionKey="two"><section aria-label="Trip detail"><button>Continue comparison</button><p role="status">Cancellation unknown</p></section></MotionSurface></StrictMode>);expect(document.activeElement).toBe(button);expect(screen.getAllByRole('status')).toHaveLength(1);expect(screen.getByRole('region',{name:'Trip detail'})).toBeVisible();expect(view.container.querySelector('[data-motion-policy]')).toHaveAttribute('data-motion-policy','static');view.unmount();expect(screen.queryByRole('button')).toBeNull();});
