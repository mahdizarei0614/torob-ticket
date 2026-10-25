import { useEffect, useState, useRef } from 'react';
import { apiClient, type ApiClient } from '@torob-ticket/client';
import type { CatalogSnapshot, SessionInfo, TransportSearchQuery } from '@torob-ticket/contracts';
import { Button, Dialog, useTheme, type ThemePreference } from '@torob-ticket/ui';
import type { useSearchController } from '../search/use-search-controller';
import { serializeSearchUrl, validateDraft } from '../search/search-url';
import { DemoLogin } from './demo-login';
import { SavedSearches } from './saved-searches';
import { useDemoAccount } from './use-demo-account';
import styles from './account.module.css';
export function AccountPanel({ controller, catalog, session, onCovered, client = apiClient }: {
    controller: ReturnType<typeof useSearchController>;
    catalog: CatalogSnapshot;
    session: SessionInfo;
    onCovered: (covered: boolean) => void;
    client?: ApiClient;
}) {
    const account = useDemoAccount(session.identity, client);
    const theme = useTheme();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [transaction, setTransaction] = useState<{
        query: TransportSearchQuery;
        lease: number;
    } | undefined>();
    const [notice, setNotice] = useState('');
    const transactionRef = useRef(transaction);
    transactionRef.current = transaction;
    function discard() { transactionRef.current = undefined; setTransaction(undefined); setName(''); }
    const actionLease = controller.dateInteractions.capture();
    const draft = controller.currentIntent().draft;
    const valid = validateDraft(draft, catalog, session);
    const queryKey = valid.query ? serializeSearchUrl(valid.query) : '';
    useEffect(() => { if (transaction && (!controller.dateInteractions.isCurrent(transaction.lease) || queryKey !== serializeSearchUrl(transaction.query))) {
        discard();
        setNotice('فرم سفر تغییر کرده است؛ ذخیره را دوباره آغاز کنید.');
    } }, [controller.state.intentRevision, queryKey]);
    useEffect(() => { if (controller.resetting) {
        setOpen(false);
        onCovered(false);
        discard();
    } }, [controller.resetting]);
    useEffect(() => () => onCovered(false), []);
    useEffect(() => { discard(); setNotice(''); }, [account.identity?.identityId]);
    function close(next: boolean) { setOpen(next); onCovered(next); if (!next) {
        discard();
        setNotice('');
    } }
    function show() { close(true); void account.refresh(); }
    function prepare() { if (!account.isCurrent())
        return; const checked = validateDraft(controller.currentIntent().draft, catalog, session); if (!checked.valid) {
        setNotice('برای ذخیره، اطلاعات سفر در فرم را کامل و معتبر کنید.');
        return;
    } const next = { query: checked.query!, lease: controller.dateInteractions.capture() }; transactionRef.current = next; setTransaction(next); setName(''); setNotice(''); }
    async function save() { const captured = transactionRef.current; if (!captured || !controller.dateInteractions.isCurrent(captured.lease) || !account.identity || !account.isCurrent())
        return; const current = validateDraft(controller.currentIntent().draft, catalog, session); if (!current.query || serializeSearchUrl(current.query) !== serializeSearchUrl(captured.query))
        return; const success = await account.save({ name, query: captured.query }); if (transactionRef.current !== captured || !controller.dateInteractions.isCurrent(captured.lease))
        return; if (success) {
        discard();
        setNotice('جست‌وجو ذخیره شد؛ هر بار باز کردن، قیمت تازه می‌گیرد.');
    } }
    return <><Button variant="quiet" aria-label="حساب نمایشی" isDisabled={controller.resetting} onPress={show}><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM3 22a9 9 0 0 1 18 0h-2a7 7 0 0 0-14 0Z"/></svg><span className={styles.triggerLabel}>حساب نمایشی</span></Button><Dialog title="حساب نمایشی و جست‌وجوهای ذخیره‌شده" isOpen={open} onOpenChange={close} mobileFullscreen><div className={styles.panel}><DemoLogin account={account}/>{account.pending === 'read' && <p role="status">دریافت وضعیت حساب…</p>}{account.error && <p role="alert">{account.error}</p>}{notice && <p role="status">{notice}</p>}<label className={styles.theme}>پوسته نمایش<select aria-label="پوسته نمایش" value={theme.preference} onChange={e => theme.setPreference(e.target.value as ThemePreference, e.currentTarget)}><option value="system">هماهنگ با دستگاه</option><option value="light">روشن</option><option value="dark">تیره</option></select></label>{account.identity && <><Button variant="secondary" isDisabled={account.pending === 'write' || !valid.valid} onPress={prepare}>ذخیره جست‌وجوی فعلی</Button>{transaction && <form aria-label="نام‌گذاری جست‌وجوی ذخیره‌شده" onSubmit={e => { e.preventDefault(); void save(); }}><label>نام جست‌وجو<input aria-label="نام جست‌وجو" value={name} maxLength={200} onChange={e => setName(e.target.value)}/></label><div className={styles.actions}><Button type="submit" isDisabled={!name.trim() || account.pending === 'write'}>ذخیره این جست‌وجو</Button><Button variant="quiet" onPress={() => { discard(); }}>انصراف از ذخیره</Button></div></form>}<SavedSearches account={account} catalog={catalog} onOpen={saved => { if (!account.isCurrent() || !controller.dateInteractions.isCurrent(actionLease) || !account.identity)
        return; close(false); controller.openSavedSearch(saved.query); }}/></>}</div></Dialog></>;
}
