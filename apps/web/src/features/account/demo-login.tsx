import { Button,displayAccountName } from '@torob-ticket/ui';
import type { DemoAccount } from './use-demo-account';
import styles from './account.module.css';
export function DemoLogin({ account }: {
    account: Pick<DemoAccount,'identity'|'pending'|'signIn'|'signOut'>;
}) {
 const signedIn = !!account.identity;
 // Keep pending announcement references and native keyboard focus attached.
 return <>
 {account.identity && <div className={styles.identity} role="group" aria-label="اطلاعات کاربری"><span>نام</span><strong>{displayAccountName(account.identity)}</strong></div>}
 <Button key="account-action" variant={signedIn ? 'quiet' : 'primary'} {...(signedIn ? { 'data-profile-logout': true } : {})} isLoading={account.pending === 'write'} onPress={() => void (signedIn ? account.signOut() : account.signIn())}>
  {signedIn ? <>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 4H5v16h5M14 8l4 4-4 4M9 12h10"/></svg>
  خروج از حساب
  </> : 'ادامه با ترب'}
 </Button>
 </>;
}
