import type { CatalogSnapshot, SavedSearch } from '@torob-ticket/contracts';
import { Button } from '@torob-ticket/ui';
import type { DemoAccount } from './use-demo-account';
import styles from './account.module.css';
const modes = { flight: 'پرواز', train: 'قطار', bus: 'اتوبوس' };
export function SavedSearches({ account, catalog, onOpen }: {
    account: DemoAccount;
    catalog: CatalogSnapshot;
    onOpen: (saved: SavedSearch) => void;
}) {
    const name = (id: string) => catalog.cities.find(c => c.id === id)?.name ?? 'شهر نامشخص';
    return <section aria-label="جست‌وجوهای ذخیره‌شده"><h3>جست‌وجوهای ذخیره‌شده</h3><p>قصد سفر ذخیره می‌شود؛ هر بار باز کردن، قیمت تازه می‌گیرد و قیمت قبلی تضمین نمی‌شود.</p>{account.listStatus === 'loading' && <p role="status">دریافت جست‌وجوهای ذخیره‌شده…</p>}{account.listStatus === 'error' && <Button variant="quiet" onPress={() => void account.refresh()}>تلاش دوباره برای فهرست</Button>}{account.listStatus === 'complete' && account.items.length === 0 && <p>هنوز جست‌وجویی ذخیره نکرده‌اید.</p>}<div className={styles.items}>{account.items.map(item => <article key={item.savedSearchId} data-saved-search-id={item.savedSearchId} className={styles.item}><strong>{item.name}</strong><p>{modes[item.query.mode]} · {name(item.query.originCityId)} به {name(item.query.destinationCityId)} · {item.query.tripType === 'round-trip' ? 'رفت‌وبرگشت' : 'یک‌طرفه'}</p><p><bdi>{item.query.departureDate}</bdi>{item.query.returnDate && <> تا <bdi>{item.query.returnDate}</bdi></>} · {new Intl.NumberFormat('fa-IR').format(item.query.party.adults + item.query.party.children + item.query.party.infants)} مسافر · {catalog.classChoices.find(c => c.mode === item.query.mode && c.code === item.query.classCode)?.name ?? 'کلاس نامشخص'}</p><div className={styles.actions}><Button variant="secondary" isDisabled={account.pending === 'write' || account.resetting} onPress={() => onOpen(item)}>باز کردن و دریافت قیمت تازه</Button><Button variant="quiet" isDisabled={account.pending === 'write'} onPress={() => void account.remove(item.savedSearchId)}>حذف جست‌وجو</Button></div></article>)}</div></section>;
}
