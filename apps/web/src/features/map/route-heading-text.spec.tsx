import {StrictMode} from 'react';
import {render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {gsap} from 'gsap';
import {RouteHeadingText,type HeadingTextHistory} from './route-heading-text';

beforeEach(()=>vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
afterEach(()=>{gsap.globalTimeline.clear();vi.unstubAllGlobals();});
const history=():HeadingTextHistory=>({values:new Map(),initialized:false});
function Heading({text,record,disabled=false,present=true}:{text:string;record:HeadingTextHistory;disabled?:boolean;present?:boolean}){return <h2><RouteHeadingText identity="destination" slot="destination" text={text} history={record} disabled={disabled} present={present}/></h2>;}
const visual=()=>document.querySelector<HTMLElement>('[data-map-city-label]')!;

it('keeps the accessible destination exact throughout the actual one-second RTL scramble',()=>{
 const record=history(),view=render(<Heading record={record} text="تهران"/>);
 expect(visual().textContent).toBe('تهران');expect(gsap.getTweensOf(visual())).toHaveLength(0);
 record.initialized=true;view.rerender(<Heading record={record} text="استانبول"/>);
 const tween=gsap.getTweensOf(visual())[0]!;expect(tween.duration()).toBe(1);
 tween.progress(.4);expect(visual()).toHaveAttribute('data-scramble-state','scrambling');expect(visual().textContent).not.toBe('استانبول');
 expect(screen.getByRole('heading')).toHaveAccessibleName('استانبول');expect(visual()).toHaveAttribute('aria-hidden','true');
 tween.progress(1);expect(visual().textContent).toBe('استانبول');expect(visual()).toHaveAttribute('data-scramble-state','settled');
 expect(screen.getByRole('heading')).toHaveAccessibleName('استانبول');
});

it('replaces an interrupted word and ignores the retired completion callback',()=>{
 const record=history(),view=render(<Heading record={record} text="تهران"/>);record.initialized=true;
 view.rerender(<Heading record={record} text="استانبول"/>);const retired=gsap.getTweensOf(visual())[0]!;retired.progress(.3);
 view.rerender(<Heading record={record} text="مشهد"/>);const current=gsap.getTweensOf(visual())[0]!;
 expect(current).not.toBe(retired);expect(gsap.getTweensOf(visual())).not.toContain(retired);
 retired.vars.onComplete?.();expect(visual()).toHaveAttribute('data-scramble-state','scrambling');expect(screen.getByRole('heading')).toHaveAccessibleName('مشهد');
 current.progress(1);expect(visual().textContent).toBe('مشهد');
});

it('settles covered/disabled text and never replays unchanged words after resume or frame remount',()=>{
 const record=history(),view=render(<Heading record={record} text="تهران"/>);record.initialized=true;
 view.rerender(<Heading record={record} text="تبریز"/>);expect(gsap.getTweensOf(visual())).toHaveLength(1);
 view.rerender(<Heading record={record} text="تبریز" disabled/>);expect(gsap.getTweensOf(visual())).toHaveLength(0);expect(visual().textContent).toBe('تبریز');
 view.rerender(<Heading record={record} text="تبریز"/>);expect(gsap.getTweensOf(visual())).toHaveLength(0);
 view.unmount();render(<Heading record={record} text="تبریز"/>);expect(gsap.getTweensOf(visual())).toHaveLength(0);expect(visual().textContent).toBe('تبریز');
});

it('survives StrictMode and kills pending letter work on retirement/unmount',()=>{
 const record=history(),view=render(<StrictMode><Heading record={record} text="تهران"/></StrictMode>);record.initialized=true;
 view.rerender(<StrictMode><Heading record={record} text="شیراز"/></StrictMode>);const node=visual();expect(gsap.getTweensOf(node)).toHaveLength(1);
 view.rerender(<StrictMode><Heading record={record} text="شیراز" present={false}/></StrictMode>);expect(node.textContent).toBe('شیراز');expect(gsap.getTweensOf(node)).toHaveLength(0);
 view.rerender(<StrictMode><Heading record={record} text="یزد"/></StrictMode>);const pending=gsap.getTweensOf(node)[0]!;
 view.unmount();expect(gsap.getTweensOf(node)).toHaveLength(0);pending.vars.onComplete?.();expect(node.textContent).not.toBe('یزد');
});
