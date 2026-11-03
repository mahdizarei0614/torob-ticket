import {describe,expect,it,vi} from 'vitest';
import {openProviderWindow,providerOutboundUrl} from './provider-window';

function newTab(){
 const replace=vi.fn(),close=vi.fn();
 const tab={closed:false,opener:window,location:{replace},close} as unknown as Window;
 return {tab,replace,close};
}
describe('confirmed provider window',()=>{
 it.each(['','../outside','https://other.example','with space'])('never opens a window for an invalid receipt ID %s',id=>{const open=vi.fn();expect(openProviderWindow(id,open)).toBe(false);expect(open).not.toHaveBeenCalled();});
 it('severs the opener before navigating to the same-origin tracked receipt route',()=>{
  const {tab,replace,close}=newTab(),open=vi.fn(()=>tab);
  replace.mockImplementation(destination=>{expect(tab.opener).toBeNull();expect(destination).toBe(new URL('/api/v1/referrals/confirmed-referral/outbound',window.location.origin).href);});
  expect(openProviderWindow('confirmed-referral',open)).toBe(true);
  expect(open).toHaveBeenCalledExactlyOnceWith('about:blank','_blank');
  expect(replace).toHaveBeenCalledExactlyOnceWith(providerOutboundUrl('confirmed-referral'));expect(close).not.toHaveBeenCalled();
 });
 it('does not infer a successful handoff from a blocked or already-closed window',()=>{
  expect(openProviderWindow('confirmed-referral',vi.fn(()=>null))).toBe(false);
  const {tab,replace}=newTab();Object.defineProperty(tab,'closed',{value:true});
  expect(openProviderWindow('confirmed-referral',vi.fn(()=>tab))).toBe(false);expect(replace).not.toHaveBeenCalled();
 });
 it.each(['opener','navigate'] as const)('closes a fresh blank tab when %s setup fails',failure=>{
  const {tab,replace,close}=newTab();
  if(failure==='opener')Object.defineProperty(tab,'opener',{set(){throw Error('blocked');}});
  else replace.mockImplementation(()=>{throw Error('navigation denied');});
  expect(openProviderWindow('confirmed-referral',vi.fn(()=>tab))).toBe(false);expect(close).toHaveBeenCalledTimes(1);
  if(failure==='opener')expect(replace).not.toHaveBeenCalled();
 });
});
