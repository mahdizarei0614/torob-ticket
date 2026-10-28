import {StrictMode} from 'react';
import {act,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {BrowserRouter} from 'react-router';
import {afterEach,expect,it,vi} from 'vitest';
import {Button,ThemeProvider,displayAccountName} from '@torob-ticket/ui';
import {ClientError,type ApiClient} from '@torob-ticket/client';
import {useSearchController} from '../search/use-search-controller';
import {searchStartPool} from '../search/search-start-pool';
import {catalog,session} from '../search/search-test-data';
import {AccountPanel} from './account-panel';
const capture=vi.hoisted(()=>({signIn:undefined as undefined|(()=>void),signOut:undefined as undefined|(()=>void)}));
vi.mock('@torob-ticket/ui',async original=>{
 const actual=await original<typeof import('@torob-ticket/ui')>();
 return{...actual,Button(props:Parameters<typeof actual.Button>[0]){
  if(props.children==='ادامه با ترب'&&props.onPress)capture.signIn=()=>props.onPress!({} as Parameters<NonNullable<typeof props.onPress>>[0]);
  if('data-profile-logout' in props&&props.onPress)capture.signOut=()=>props.onPress!({} as Parameters<NonNullable<typeof props.onPress>>[0]);
  const Actual=actual.Button;return <Actual {...props}/>;
 }};
});
const identity={identityId:'profile-user',displayName:'کاربر سفر',simulated:true as const};
afterEach(()=>{vi.restoreAllMocks();localStorage.clear();capture.signIn=undefined;capture.signOut=undefined;window.history.replaceState({},'','/');});
function setup(strict=false){
 const client={authState:vi.fn(async()=>({identity})),signIn:vi.fn(async()=>({identity})),signOut:vi.fn(async()=>({identity:null})),listSavedSearches:vi.fn(async()=>({items:[]})),saveSearch:vi.fn(),deleteSavedSearch:vi.fn(),startSearch:vi.fn(),cancelSearch:vi.fn(async()=>undefined)} as unknown as ApiClient;
 const covered=vi.fn();let controller!:ReturnType<typeof useSearchController>;
 function Harness(){controller=useSearchController(catalog,session,client);return <><Button>بیرون از حساب</Button><AccountPanel controller={controller} catalog={catalog} session={session} client={client} onCovered={covered}/></>;}
 window.history.replaceState({},'','/');
 const tree=<QueryClientProvider client={new QueryClient()}><BrowserRouter><ThemeProvider><Harness/></ThemeProvider></BrowserRouter></QueryClientProvider>;
 const view=render(strict?<StrictMode>{tree}</StrictMode>:tree);
 return{...view,client,covered,get controller(){return controller;}};
}
async function open(signedIn=true){const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'حساب کاربری'}));await screen.findByRole('button',{name:signedIn?'خروج از حساب':'ادامه با ترب'});return user;}
it('shows only actual user details and inline-icon logout without saved-search or appearance presentation/requests',async()=>{
 const h=setup();await open();const profile=screen.getByRole('dialog',{name:'حساب کاربری'}),logout=screen.getByRole('button',{name:'خروج از حساب'});
 expect(screen.getByText(displayAccountName(identity),{exact:true})).toBeVisible();expect(screen.getByLabelText('اطلاعات کاربری')).toHaveTextContent('نام');
 expect(logout).toHaveAttribute('data-profile-logout');expect(logout.querySelector('svg')).toHaveAttribute('aria-hidden','true');expect(logout.querySelector('svg')).toHaveAttribute('stroke','currentColor');
 expect(profile.querySelector('form,input,select')).toBeNull();expect(profile).not.toHaveAttribute('aria-modal','true');
 for(const text of ['پوسته نمایش','ذخیره جست‌وجوی فعلی','نام جست‌وجو','سفرهای ذخیره‌شده','باز کردن و دریافت قیمت تازه','حذف جست‌وجو'])expect(screen.queryByText(text,{exact:true})).not.toBeInTheDocument();
 expect(h.client.listSavedSearches).not.toHaveBeenCalled();expect(h.client.saveSearch).not.toHaveBeenCalled();expect(h.client.deleteSavedSearch).not.toHaveBeenCalled();expect(h.client.startSearch).not.toHaveBeenCalled();expect(h.covered).not.toHaveBeenCalledWith(true);
});
it('keeps guest sign-in reachable and preserves local theme preference through login/logout',async()=>{
 const h=setup();vi.mocked(h.client.authState).mockResolvedValue({identity:null});localStorage.setItem('torobticket.appearance','dark');
 const before=h.controller.state,user=await open(false);expect(screen.queryByText(/ذخیره/)).not.toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'ادامه با ترب'}));await screen.findByRole('button',{name:'خروج از حساب'});expect(h.client.signIn).toHaveBeenCalledOnce();expect(h.controller.state).toEqual(before);
 await user.click(screen.getByRole('button',{name:'خروج از حساب'}));await screen.findByRole('button',{name:'ادامه با ترب'});expect(h.client.signOut).toHaveBeenCalledOnce();expect(h.controller.state).toEqual(before);
 expect(localStorage.getItem('torobticket.appearance')).toBe('dark');expect(h.client.listSavedSearches).not.toHaveBeenCalled();expect(h.client.saveSearch).not.toHaveBeenCalled();expect(h.client.deleteSavedSearch).not.toHaveBeenCalled();
});
it.each(['signIn','signOut'] as const)('rejects a retained %s after close/reopen while current controls still work',async action=>{
 const h=setup();if(action==='signIn')vi.mocked(h.client.authState).mockResolvedValue({identity:null});const user=await open(action==='signOut'),old=capture[action]!;
 await user.keyboard('{Escape}');await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());await open(action==='signOut');act(()=>old());expect(h.client[action]).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:action==='signIn'?'ادامه با ترب':'خروج از حساب'}));await waitFor(()=>expect(h.client[action]).toHaveBeenCalledOnce());
});
it.each(['edit','history','reset'] as const)('fences an already-rendered logout on same-turn %s invalidation',async action=>{
 const h=setup();await open();const old=capture.signOut!;
 act(()=>{if(action==='edit')h.controller.edit({filters:{refundableOnly:true}});if(action==='history'){window.history.replaceState({},'','/');window.dispatchEvent(new PopStateEvent('popstate'));}if(action==='reset')searchStartPool(h.client).beginReset();old();});
 expect(h.client.signOut).not.toHaveBeenCalled();expect(h.client.saveSearch).not.toHaveBeenCalled();expect(h.client.deleteSavedSearch).not.toHaveBeenCalled();
});
it('clears privileged identity on SESSION_EXPIRED and keeps guest recovery and local preferences',async()=>{
 const h=setup(),user=await open();localStorage.setItem('torobticket.appearance','light');
 vi.mocked(h.client.signOut).mockRejectedValueOnce(new ClientError('api','expired',{code:'SESSION_EXPIRED',fieldPaths:[],retryable:false,requestId:'request'},401));
 await user.click(screen.getByRole('button',{name:'خروج از حساب'}));await screen.findByRole('alert');expect(screen.getByRole('button',{name:'ادامه با ترب'})).toBeVisible();expect(screen.queryByRole('button',{name:'خروج از حساب'})).toBeNull();expect(screen.queryByText(identity.displayName,{exact:true})).toBeNull();
 expect(localStorage.getItem('torobticket.appearance')).toBe('light');expect(h.client.listSavedSearches).not.toHaveBeenCalled();
});
it('does not restore an obsolete identity read after a newer profile refresh',async()=>{
 const h=setup();let release!:(value:{identity:typeof identity|null})=>void;vi.mocked(h.client.authState).mockReturnValueOnce(new Promise(resolve=>{release=resolve;})).mockResolvedValue({identity:null});
 const user=await open(false);await user.keyboard('{Escape}');await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());await open(false);
 await act(async()=>release({identity}));expect(screen.getByRole('button',{name:'ادامه با ترب'})).toBeVisible();expect(screen.queryByRole('button',{name:'خروج از حساب'})).not.toBeInTheDocument();
});
it('keeps current sign-in/logout and Escape focus return working through StrictMode replay',async()=>{
 const h=setup(true);vi.mocked(h.client.authState).mockResolvedValue({identity:null});const user=await open(false),trigger=screen.getByRole('button',{name:'حساب کاربری'});
 await user.click(screen.getByRole('button',{name:'ادامه با ترب'}));await screen.findByRole('button',{name:'خروج از حساب'});await user.click(screen.getByRole('button',{name:'خروج از حساب'}));await screen.findByRole('button',{name:'ادامه با ترب'});
 await waitFor(()=>expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true));await user.keyboard('{Escape}');await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());await waitFor(()=>expect(trigger).toHaveFocus());
 expect(h.client.signIn).toHaveBeenCalledOnce();expect(h.client.signOut).toHaveBeenCalledOnce();const old=capture.signIn!;h.unmount();act(()=>old());expect(h.client.signIn).toHaveBeenCalledOnce();
});
it('outside dismissal closes the profile and revokes its retained logout action',async()=>{
 const h=setup(),user=await open(),old=capture.signOut!;const outside=screen.getByRole('button',{name:'بیرون از حساب'});await user.click(outside);await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());act(()=>old());expect(h.client.signOut).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'حساب کاربری'})).toHaveAttribute('aria-expanded','false');
});
