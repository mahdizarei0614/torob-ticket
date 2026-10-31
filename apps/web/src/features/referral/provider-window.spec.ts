import {describe,expect,it,vi} from 'vitest';
import {openProviderWindow,PROVIDER_DESTINATION} from './provider-window';

function newTab(){
 const replace=vi.fn(),close=vi.fn();
 const tab={closed:false,opener:window,location:{replace},close} as unknown as Window;
 return {tab,replace,close};
}
describe('confirmed provider window',()=>{
 it('severs the opener before navigating only to the owner-selected destination',()=>{
  const {tab,replace,close}=newTab(),open=vi.fn(()=>tab);
  replace.mockImplementation(destination=>{expect(tab.opener).toBeNull();expect(destination).toBe('https://zarei.xyz');});
  expect(openProviderWindow(open)).toBe(true);
  expect(open).toHaveBeenCalledExactlyOnceWith('about:blank','_blank');
  expect(replace).toHaveBeenCalledExactlyOnceWith(PROVIDER_DESTINATION);expect(close).not.toHaveBeenCalled();
 });
 it('does not infer a successful handoff from a blocked or already-closed window',()=>{
  expect(openProviderWindow(vi.fn(()=>null))).toBe(false);
  const {tab,replace}=newTab();Object.defineProperty(tab,'closed',{value:true});
  expect(openProviderWindow(vi.fn(()=>tab))).toBe(false);expect(replace).not.toHaveBeenCalled();
 });
 it.each(['opener','navigate'] as const)('closes a fresh blank tab when %s setup fails',failure=>{
  const {tab,replace,close}=newTab();
  if(failure==='opener')Object.defineProperty(tab,'opener',{set(){throw Error('blocked');}});
  else replace.mockImplementation(()=>{throw Error('navigation denied');});
  expect(openProviderWindow(vi.fn(()=>tab))).toBe(false);expect(close).toHaveBeenCalledTimes(1);
  if(failure==='opener')expect(replace).not.toHaveBeenCalled();
 });
});
