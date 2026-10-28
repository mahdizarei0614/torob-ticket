import {StrictMode,useState} from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@torob-ticket/ui';
import { ClientError, type ApiClient } from '@torob-ticket/client';
import type { SavedSearch } from '@torob-ticket/contracts';
import { useSearchController } from '../search/use-search-controller';
import { searchStartPool } from '../search/search-start-pool';
import { catalog, query, session } from '../search/search-test-data';
import { AccountPanel } from './account-panel';
const capture = vi.hoisted(() => ({ open: undefined as undefined | ((saved: SavedSearch) => void),signIn:undefined as undefined|(()=>void),submit:undefined as undefined|(()=>void),theme:undefined as undefined|(()=>void),input:undefined as undefined|((value:string)=>void),cancel:undefined as undefined|(()=>void) }));
vi.mock('./saved-searches', async (importOriginal) => { const actual = await importOriginal<typeof import('./saved-searches')>(); return { ...actual, SavedSearches(props: Parameters<typeof actual.SavedSearches>[0]) { capture.open = props.onOpen; const Actual = actual.SavedSearches; return <Actual {...props}/>; } }; });
vi.mock('@torob-ticket/ui',async importOriginal=>{const actual=await importOriginal<typeof import('@torob-ticket/ui')>();
 return {...actual,Button(props:Parameters<typeof actual.Button>[0]){if(props.children==='ادامه با ترب'&&props.onPress)capture.signIn=()=>props.onPress!({} as Parameters<NonNullable<typeof props.onPress>>[0]);if(props.children==='انصراف از ذخیره'&&props.onPress)capture.cancel=()=>props.onPress!({} as Parameters<NonNullable<typeof props.onPress>>[0]);const Actual=actual.Button;return <Actual {...props}/>;}};});
vi.mock('./account-popover',async importOriginal=>{const actual=await importOriginal<typeof import('./account-popover')>();const {Children,isValidElement}=await import('react');
 return {...actual,AccountPopover(props:Parameters<typeof actual.AccountPopover>[0]){function walk(node:unknown){if(!isValidElement(node))return;const element=node as {type:unknown;props:{children?:import('react').ReactNode;onSubmit?:(event:{preventDefault:()=>void})=>void;onChange?:(event:{target:{value:string};currentTarget:HTMLElement})=>void;[key:string]:unknown}};
 if(element.type==='form'&&element.props.onSubmit)capture.submit=()=>element.props.onSubmit!({preventDefault(){}});
 if(element.type==='input'&&element.props['aria-label']==='نام جست‌وجو'&&element.props.onChange)capture.input=value=>element.props.onChange!({target:{value},currentTarget:document.createElement('input')});
 if(element.type==='select'&&element.props['aria-label']==='پوسته نمایش'&&element.props.onChange)capture.theme=()=>element.props.onChange!({target:{value:'dark'},currentTarget:document.createElement('select')});
 Children.forEach(element.props.children,walk);}walk(props.children);const Actual=actual.AccountPopover;return <Actual {...props}/>;}};});
const identity = { identityId: 'demo', displayName: 'مسافر نمایشی', simulated: true as const };
const saved: SavedSearch = { savedSearchId: 'saved', identityId: 'demo', name: 'سفر من', query, createdAt: '2026-10-25T06:00:00Z' };
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); capture.open=undefined;capture.signIn=undefined;capture.submit=undefined;capture.theme=undefined;capture.input=undefined;capture.cancel=undefined; });
function setup(strict=false,items:SavedSearch[]=[saved]) { const client = { authState: vi.fn(async () => ({ identity })), signIn: vi.fn(async () => ({ identity })), signOut: vi.fn(async () => ({ identity: null })), listSavedSearches: vi.fn(async () => ({ items })), saveSearch: vi.fn(async () => saved), deleteSavedSearch: vi.fn(async () => ({ deletedSavedSearchId: 'saved' })), startSearch: vi.fn(), cancelSearch: vi.fn(async () => undefined) } as unknown as ApiClient; const covered = vi.fn(); let controller!: ReturnType<typeof useSearchController>; function Harness() { controller = useSearchController(catalog, session, client);const[show,setShow]=useState(!strict);if(!show)return <button onClick={()=>setShow(true)}>افزودن حساب برای بررسی چرخه عمر</button>; return <><button type="button">بیرون از حساب</button><AccountPanel controller={controller} catalog={catalog} session={session} client={client} onCovered={covered}/></>; } window.history.replaceState(null, '', '/'); const cache = new QueryClient(); const tree=<QueryClientProvider client={cache}><BrowserRouter><ThemeProvider><Harness /></ThemeProvider></BrowserRouter></QueryClientProvider>;const view=render(strict?<StrictMode>{tree}</StrictMode>:tree); return { client, covered, get controller() { return controller; }, ...view }; }
async function open() { const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'حساب کاربری' })); await screen.findByRole('button', { name: 'خروج از حساب' }); await screen.findByRole('button', { name: 'باز کردن و دریافت قیمت تازه' }); return user; }
it('actual row callback rejects same-turn logout, newer refresh, edit/history and reset before touching the actual controller', async () => { const h = setup(), user = await open(); let old = capture.open!; await user.keyboard('{Escape}'); await open(); act(() => old(saved)); expect(h.client.startSearch).not.toHaveBeenCalled(); expect(screen.getByRole('dialog')).toBeInTheDocument(); old = capture.open!; act(() => { h.controller.edit({ filters: { refundableOnly: true } }); old(saved); }); expect(h.client.startSearch).not.toHaveBeenCalled(); expect(h.controller.state.draft.filters.refundableOnly).toBe(true); old = capture.open!; act(() => { window.history.replaceState(null, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); old(saved); }); expect(h.client.startSearch).not.toHaveBeenCalled(); old = capture.open!; await user.click(screen.getByRole('button', { name: 'خروج از حساب' })); act(() => old(saved)); expect(h.client.startSearch).not.toHaveBeenCalled(); await user.click(screen.getByRole('button', { name: 'ادامه با ترب' })); await screen.findByRole('button', { name: 'باز کردن و دریافت قیمت تازه' }); old = capture.open!; act(() => { searchStartPool(h.client).beginReset(); old(saved); }); expect(h.client.startSearch).not.toHaveBeenCalled(); expect(h.covered).toHaveBeenLastCalledWith(false); h.unmount(); });
it('retains a rejected save name/query for deliberate retry and only announces saved after success', async () => { const h = setup(), user = await open(); vi.mocked(h.client.saveSearch).mockRejectedValueOnce(new ClientError('network', 'offline')); await user.click(screen.getByRole('button', { name: 'ذخیره جست‌وجوی فعلی' })); await user.type(screen.getByRole('textbox', { name: 'نام جست‌وجو' }), 'سفر دلخواه'); await user.click(screen.getByRole('button', { name: 'ذخیره این جست‌وجو' })); await screen.findByRole('alert'); expect(screen.getByRole('textbox', { name: 'نام جست‌وجو' })).toHaveValue('سفر دلخواه'); expect(screen.queryByText(/^جست‌وجو ذخیره شد/)).not.toBeInTheDocument(); await user.click(screen.getByRole('button', { name: 'ذخیره این جست‌وجو' })); await screen.findByText(/^جست‌وجو ذخیره شد/); expect(screen.queryByRole('textbox', { name: 'نام جست‌وجو' })).not.toBeInTheDocument(); expect(vi.mocked(h.client.saveSearch).mock.calls[1]![0]).toMatchObject({ name: 'سفر دلخواه', query }); h.unmount(); });
it('Cancel/Escape discard name transactions, and an actual retained form submit after an edit cannot save old intent', async () => { const h = setup(), user = await open(); await user.click(screen.getByRole('button', { name: 'ذخیره جست‌وجوی فعلی' })); await user.type(screen.getByRole('textbox', { name: 'نام جست‌وجو' }), 'نباید بماند'); await user.click(screen.getByRole('button', { name: 'انصراف از ذخیره' })); await user.click(screen.getByRole('button', { name: 'ذخیره جست‌وجوی فعلی' })); expect(screen.getByRole('textbox', { name: 'نام جست‌وجو' })).toHaveValue(''); await user.type(screen.getByRole('textbox', { name: 'نام جست‌وجو' }), 'بازگشت'); await user.keyboard('{Escape}'); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); expect(h.covered).toHaveBeenLastCalledWith(false); await open(); await user.click(screen.getByRole('button', { name: 'ذخیره جست‌وجوی فعلی' })); expect(screen.getByRole('textbox', { name: 'نام جست‌وجو' })).toHaveValue(''); await user.type(screen.getByRole('textbox', { name: 'نام جست‌وجو' }), 'قدیمی'); const form = screen.getByRole('form', { name: 'نام‌گذاری جست‌وجوی ذخیره‌شده' }); act(() => { h.controller.edit({ filters: { refundableOnly: true } }); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }); expect(h.client.saveSearch).not.toHaveBeenCalled(); expect(h.client.startSearch).not.toHaveBeenCalled(); h.unmount(); });
it('clears privileged account data on SESSION_EXPIRED and leaves theme local for guests', async () => { const h = setup(), user = await open(); await user.selectOptions(screen.getByRole('combobox', { name: 'پوسته نمایش' }), 'dark'); expect(localStorage.getItem('torobticket.appearance')).toBe('dark'); vi.mocked(h.client.deleteSavedSearch).mockRejectedValueOnce(new ClientError('api', 'expired', { code: 'SESSION_EXPIRED', fieldPaths: [], retryable: false, requestId: 'request' }, 401)); await user.click(screen.getByRole('button', { name: 'حذف جست‌وجو' })); await screen.findByRole('alert'); expect(screen.queryByRole('button', { name: 'باز کردن و دریافت قیمت تازه' })).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: 'ادامه با ترب' })).toBeInTheDocument(); expect(localStorage.getItem('torobticket.appearance')).toBe('dark'); h.unmount(); });

it('dismissed dialog callbacks cannot sign in, submit a save or change theme after close/reopen; current controls still work',async()=>{
 const h=setup(),user=userEvent.setup();vi.mocked(h.client.authState).mockResolvedValue({identity:null});
 await user.click(screen.getByRole('button',{name:'حساب کاربری'}));await screen.findByRole('button',{name:'ادامه با ترب'});
 const oldSignIn=capture.signIn!,oldTheme=capture.theme!;await user.keyboard('{Escape}');
 act(()=>{oldSignIn();oldTheme();});expect(h.client.signIn).not.toHaveBeenCalled();expect(localStorage.getItem('torobticket.appearance')).toBeNull();
 await user.click(screen.getByRole('button',{name:'حساب کاربری'}));await user.click(await screen.findByRole('button',{name:'ادامه با ترب'}));await screen.findByRole('button',{name:'ذخیره جست‌وجوی فعلی'});expect(h.client.signIn).toHaveBeenCalledTimes(1);
 await user.click(screen.getByRole('button',{name:'ذخیره جست‌وجوی فعلی'}));await user.type(screen.getByRole('textbox',{name:'نام جست‌وجو'}),'قدیمی');const oldSubmit=capture.submit!;
 await user.keyboard('{Escape}');await act(async()=>oldSubmit());expect(h.client.saveSearch).not.toHaveBeenCalled();
 vi.mocked(h.client.authState).mockResolvedValue({identity});await open();await user.click(screen.getByRole('button',{name:'ذخیره جست‌وجوی فعلی'}));await user.type(screen.getByRole('textbox',{name:'نام جست‌وجو'}),'تازه');
 await act(async()=>{oldSignIn();oldSubmit();oldTheme();});expect(h.client.saveSearch).not.toHaveBeenCalled();expect(h.client.signIn).toHaveBeenCalledTimes(1);expect(localStorage.getItem('torobticket.appearance')).toBeNull();
 await user.click(screen.getByRole('button',{name:'ذخیره این جست‌وجو'}));await screen.findByText(/^جست‌وجو ذخیره شد/);expect(h.client.saveSearch).toHaveBeenCalledTimes(1);h.unmount();
});

it('a fresh StrictMode account trigger and current sign-in/save work without unrelated state updates',async()=>{
 const h=setup(true),user=userEvent.setup();vi.mocked(h.client.authState).mockResolvedValue({identity:null});await user.click(screen.getByRole('button',{name:'افزودن حساب برای بررسی چرخه عمر'}));
 await user.click(screen.getByRole('button',{name:'حساب کاربری'}));await user.click(await screen.findByRole('button',{name:'ادامه با ترب'}));
 await user.click(await screen.findByRole('button',{name:'ذخیره جست‌وجوی فعلی'}));await user.type(screen.getByRole('textbox',{name:'نام جست‌وجو'}),'همین حساب');
 await user.click(screen.getByRole('button',{name:'ذخیره این جست‌وجو'}));await screen.findByText(/^جست‌وجو ذخیره شد/);expect(h.client.signIn).toHaveBeenCalledTimes(1);expect(h.client.saveSearch).toHaveBeenCalledTimes(1);expect(h.client.startSearch).not.toHaveBeenCalled();const old=capture.open!;h.unmount();await act(async()=>old(saved));expect(h.client.startSearch).not.toHaveBeenCalled();
});

for(const action of ['submit','input','cancel'] as const)it('cancelled form '+action+' callback cannot target the replacement transaction in the same dialog',async()=>{
 const h=setup(),user=await open();await user.click(screen.getByRole('button',{name:'ذخیره جست‌وجوی فعلی'}));await user.type(screen.getByRole('textbox',{name:'نام جست‌وجو'}),'لغوشده');
 const oldSubmit=capture.submit!,oldInput=capture.input!,oldCancel=capture.cancel!;await user.click(screen.getByRole('button',{name:'انصراف از ذخیره'}));
 await user.click(screen.getByRole('button',{name:'ذخیره جست‌وجوی فعلی'}));await user.type(screen.getByRole('textbox',{name:'نام جست‌وجو'}),'همین فرم');
 await act(async()=>{if(action==='submit')oldSubmit();if(action==='input')oldInput('قدیمی');if(action==='cancel')oldCancel();});expect(h.client.saveSearch).not.toHaveBeenCalled();expect(screen.getByRole('textbox',{name:'نام جست‌وجو'})).toHaveValue('همین فرم');
 await user.click(screen.getByRole('button',{name:'ذخیره این جست‌وجو'}));await screen.findByText(/^جست‌وجو ذخیره شد/);expect(h.client.saveSearch).toHaveBeenCalledTimes(1);expect(vi.mocked(h.client.saveSearch).mock.calls[0]![0].name).toBe('همین فرم');h.unmount();
});

it('uses a compact nonmodal profile popover, omits empty saved-search copy and restores trigger focus on Escape',async()=>{
 const h=setup(false,[]),user=userEvent.setup(),trigger=screen.getByRole('button',{name:'حساب کاربری'});
 await user.click(trigger);await screen.findByRole('button',{name:'خروج از حساب'});
 const profile=screen.getByRole('dialog',{name:'حساب کاربری'});
 expect(profile.closest('[data-profile-popover]')).not.toBeNull();expect(profile).not.toHaveAttribute('aria-modal','true');expect(trigger).toHaveAttribute('aria-expanded','true');
 expect(document.querySelector('[data-dialog-scroll]')).toBeNull();
 for(const text of ['جست‌وجوهای ذخیره‌شده','قصد سفر ذخیره می‌شود؛ هر بار باز کردن، قیمت تازه می‌گیرد و قیمت قبلی تضمین نمی‌شود.','هنوز جست‌وجویی ذخیره نکرده‌اید.'])expect(screen.queryByText(text,{exact:true})).not.toBeInTheDocument();
 expect(screen.queryByRole('region',{name:'سفرهای ذخیره‌شده'})).not.toBeInTheDocument();expect(h.covered).not.toHaveBeenCalledWith(true);
 await user.keyboard('{Escape}');await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());await waitFor(()=>expect(trigger).toHaveFocus());expect(trigger).toHaveAttribute('aria-expanded','false');h.unmount();
});
it('dismisses the profile on outside pointer interaction without leaving a naming transaction alive',async()=>{
 const h=setup(),user=await open();await user.click(screen.getByRole('button',{name:'ذخیره جست‌وجوی فعلی'}));await user.type(screen.getByRole('textbox',{name:'نام جست‌وجو'}),'بسته');const old=capture.submit!;
 await user.click(screen.getByRole('button',{name:'بیرون از حساب'}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());await act(async()=>old());expect(h.client.saveSearch).not.toHaveBeenCalled();h.unmount();
});

for(const outcome of ['save','cancel','sign-out','delete'] as const)it('keeps Escape reachable after '+outcome+' removes its focused account control',async()=>{
 const h=setup(),user=await open(),trigger=screen.getByRole('button',{name:'حساب کاربری'});
 if(outcome==='save'||outcome==='cancel'){
  await user.click(screen.getByRole('button',{name:'ذخیره جست‌وجوی فعلی'}));
  await user.type(screen.getByRole('textbox',{name:'نام جست‌وجو'}),'قابل بازگشت');
  await user.click(screen.getByRole('button',{name:outcome==='save'?'ذخیره این جست‌وجو':'انصراف از ذخیره'}));
  await waitFor(()=>expect(screen.queryByRole('form',{name:'نام‌گذاری جست‌وجوی ذخیره‌شده'})).toBeNull());
 }else if(outcome==='sign-out'){
  await user.click(screen.getByRole('button',{name:'خروج از حساب'}));await screen.findByRole('button',{name:'ادامه با ترب'});
 }else{
  vi.mocked(h.client.listSavedSearches).mockResolvedValue({items:[]});await user.click(screen.getByRole('button',{name:'حذف جست‌وجو'}));await waitFor(()=>expect(screen.queryByRole('button',{name:'حذف جست‌وجو'})).toBeNull());
 }
 await waitFor(()=>expect(screen.getByRole('dialog',{name:'حساب کاربری'}).contains(document.activeElement)).toBe(true));
 await user.keyboard('{Escape}');await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());await waitFor(()=>expect(trigger).toHaveFocus());h.unmount();
});
it('keeps Escape reachable after signing in replaces the focused login button',async()=>{
 const h=setup(),user=userEvent.setup();vi.mocked(h.client.authState).mockResolvedValue({identity:null});
 const trigger=screen.getByRole('button',{name:'حساب کاربری'});await user.click(trigger);await user.click(await screen.findByRole('button',{name:'ادامه با ترب'}));await screen.findByRole('button',{name:'خروج از حساب'});
 await waitFor(()=>expect(screen.getByRole('dialog',{name:'حساب کاربری'}).contains(document.activeElement)).toBe(true));await user.keyboard('{Escape}');await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());await waitFor(()=>expect(trigger).toHaveFocus());h.unmount();
});

it('does not repair focus or authorize a captured save after an explicit body focus departure closes the popover',async()=>{
 const h=setup(),user=await open();await user.click(screen.getByRole('button',{name:'ذخیره جست‌وجوی فعلی'}));await user.type(screen.getByRole('textbox',{name:'نام جست‌وجو'}),'بدنه');
 const submit=screen.getByRole('button',{name:'ذخیره این جست‌وجو'});
 act(()=>{submit.focus();fireEvent.focusOut(submit,{relatedTarget:document.body});submit.blur();});
 expect(document.activeElement).toBe(document.body);
 const retained=capture.submit!;await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());await act(async()=>retained());expect(h.client.saveSearch).not.toHaveBeenCalled();h.unmount();
});
