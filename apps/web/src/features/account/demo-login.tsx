import { Button,displayAccountName } from '@torob-ticket/ui';
import type { DemoAccount } from './use-demo-account';
import styles from './account.module.css';
export function DemoLogin({ account }: {
    account: Pick<DemoAccount,'identity'|'pending'|'signIn'|'signOut'>;
}) { return account.identity ? <>
 <div className={styles.identity} aria-label="اطلاعات کاربری"><span>نام</span><strong>{displayAccountName(account.identity)}</strong></div>
 <Button variant="quiet" data-profile-logout isLoading={account.pending === 'write'} onPress={() => void account.signOut()}>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 4H5v16h5M14 8l4 4-4 4M9 12h10"/></svg>
  خروج از حساب
 </Button>
</> : <Button isLoading={account.pending === 'write'} onPress={() => void account.signIn()}>ادامه با ترب</Button>; }
