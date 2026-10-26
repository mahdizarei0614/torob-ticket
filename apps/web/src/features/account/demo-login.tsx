import { Button,displayAccountName } from '@torob-ticket/ui';
import type { DemoAccount } from './use-demo-account';
export function DemoLogin({ account }: {
    account: DemoAccount;
}) { return account.identity ? <><p>سلام، {displayAccountName(account.identity)}</p><Button variant="quiet" isDisabled={account.pending === 'write'} onPress={() => void account.signOut()}>خروج از حساب</Button></> : <><p>برای مقایسه و ادامه با فروشنده نیازی به ورود نیست. با ورود، جست‌وجوهای خود را ذخیره کنید.</p><Button isLoading={account.pending === 'write'} onPress={() => void account.signIn()}>ادامه با ترب</Button></>; }
