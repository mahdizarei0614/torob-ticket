import { Button } from '@torob-ticket/ui';
import type { DemoAccount } from './use-demo-account';
export function DemoLogin({ account }: {
    account: DemoAccount;
}) { return account.identity ? <><p>سلام، {account.identity.displayName}</p><Button variant="quiet" isDisabled={account.pending === 'write'} onPress={() => void account.signOut()}>خروج از حساب نمایشی</Button></> : <><p>مقایسه و ادامه به فروشنده بدون ورود هم در دسترس است. ورود نمایشی فقط جست‌وجوهای ذخیره‌شده همین نشست را فعال می‌کند.</p><Button isLoading={account.pending === 'write'} onPress={() => void account.signIn()}>ادامه با ترب — نمایشی</Button><p>ورود شبیه‌سازی شده است؛ اطلاعات شخصی نمی‌خواهیم و وابستگی رسمی به ترب نداریم.</p></>; }
