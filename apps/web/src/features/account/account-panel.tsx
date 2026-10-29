import {useEffect,useRef,useState} from 'react';
import {apiClient,type ApiClient} from '@torob-ticket/client';
import type {CatalogSnapshot,SessionInfo} from '@torob-ticket/contracts';
import {Button} from '@torob-ticket/ui';
import type {useSearchController} from '../search/use-search-controller';
import {DemoLogin} from './demo-login';
import {useDemoAccount} from './use-demo-account';
import {AccountPopover} from './account-popover';
import styles from './account.module.css';

export function AccountPanel({controller,session,onCovered,client=apiClient}:{
 controller:ReturnType<typeof useSearchController>;catalog:CatalogSnapshot;session:SessionInfo;
 onCovered:(covered:boolean)=>void;client?:ApiClient;
}) {
 // The profile reads identity only. Stored searches and their API remain untouched.
 const account=useDemoAccount(session.identity,client,false);
 const avatarName=!account.resetting&&!controller.resetting?account.identity?.displayName.trim():undefined;
 const avatarInitial=avatarName?(typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('fa',{granularity:'grapheme'}).segment(avatarName)][0]?.segment:[...avatarName][0]):undefined;
 const [open,setOpen]=useState(false);
 const dialog=useRef({open:false,epoch:0});
 const dialogEpoch=dialog.current.epoch;
 const actionLease=controller.dateInteractions.capture();
 const viewCurrent=()=>dialog.current.open&&dialog.current.epoch===dialogEpoch;
 const actionCurrent=()=>viewCurrent()&&account.isCurrent()&&controller.dateInteractions.isCurrent(actionLease);
 function changeDialog(next:boolean){
  dialog.current={open:next,epoch:dialog.current.epoch+1};setOpen(next);onCovered(false);
 }
 useEffect(()=>{if(controller.resetting)changeDialog(false);},[controller.resetting]);
 useEffect(()=>()=>{dialog.current={open:false,epoch:dialog.current.epoch+1};onCovered(false);},[]);
 function changePopover(next:boolean){
  if(dialog.current.epoch!==dialogEpoch)return;
  if(next){if(dialog.current.open||!account.isCurrent())return;changeDialog(true);void account.refresh();}
  else changeDialog(false);
 }
 // Closing/reopening, a changed intent, identity rotation or reset revokes old actions.
 const guarded=(work:()=>Promise<boolean>)=>actionCurrent()?work():Promise.resolve(false);
 return <AccountPopover isOpen={open} onOpenChange={changePopover} trigger={<Button variant="quiet" data-profile-trigger aria-label="حساب کاربری" isDisabled={controller.resetting||account.pending==='write'}>
   <span className={styles.avatar} data-profile-avatar={avatarInitial?'initial':'glyph'} aria-hidden="true">{avatarInitial??<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM3 22a9 9 0 0 1 18 0h-2a7 7 0 0 0-14 0Z"/></svg>}</span>
   <span className={styles.triggerLabel}>حساب کاربری</span>
  </Button>}>
   <div className={styles.panel}>
    <DemoLogin account={{identity:account.identity,pending:account.pending,signIn:()=>guarded(account.signIn),signOut:()=>guarded(account.signOut)}}/>
    {account.pending==='read'&&<p role="status">دریافت وضعیت حساب…</p>}
    {account.error&&<p role="alert">{account.error}</p>}
   </div>
 </AccountPopover>;
}
