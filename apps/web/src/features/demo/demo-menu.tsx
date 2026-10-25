import { useState } from 'react';
import { Button, Dialog } from '@torob-ticket/ui';
import type { CatalogSnapshot, Mode, Scope, SessionInfo } from '@torob-ticket/contracts';
import { dateBounds, type SearchDraft } from '../search/search-url';
import styles from '../search/search.module.css';
const modeNames = { flight: 'پرواز', train: 'قطار', bus: 'اتوبوس' };
export function DemoMenu({ catalog, session, onPreset, onReset, resetting }: { catalog: CatalogSnapshot; session: SessionInfo; onPreset: (draft: SearchDraft) => void; onReset: () => void; resetting: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const presets = (['flight','train','bus'] as Mode[]).flatMap(mode => (['domestic','international'] as Scope[]).flatMap(scope => {
    const route = catalog.supportedConnections.find(c => c.mode === mode && c.scope === scope);
    if (!route) return [];
    const origin = catalog.cities.find(c => c.id === route.originCityId);
    const destination = catalog.cities.find(c => c.id === route.destinationCityId);
    const classCode = catalog.classChoices.find(c => c.mode === mode)?.code;
    if (!origin || !destination || !classCode) return [];
    return [{ label: `${modeNames[mode]} ${scope === 'domestic' ? 'داخلی' : 'بین‌المللی'} · ${origin.name} به ${destination.name}`, draft: { ...route, tripType: 'one-way' as const, departureDate: dateBounds(session, origin.timeZone).min, party: { adults: 1, children: 0, infants: 0 }, classCode, filters: {}, sort: 'cheapest' as const } }];
  }));
  return <><Button variant="quiet" onPress={() => setOpen(true)}>کاوش نسخه نمایشی</Button><Dialog title="کاوش نسخه نمایشی" isOpen={open} onOpenChange={setOpen}>
    <p className={styles.muted}>یک سفر پیشنهادی را در فرم قرار دهید و آزادانه تغییرش دهید.</p><div className={styles.presets}>{presets.map(p => <Button key={`${p.draft.mode}-${p.draft.scope}`} variant="secondary" onPress={() => { onPreset(p.draft); setOpen(false); }}>{p.label}</Button>)}</div>
    <p>سناریوی نشست: <bdi dir="ltr">{session.scenario}</bdi></p><a href="/admin/">مدیریت نسخه نمایشی</a>
    <p className={styles.muted}>داده‌ها و فروشندگان خیالی‌اند. این محصول مستقل است و وابستگی رسمی به ترب ندارد.</p>
    <Button variant="quiet" onPress={() => { setOpen(false); setConfirm(true); }}>شروع دوباره نشست من</Button>
  </Dialog><Dialog title="شروع دوباره نشست؟" isOpen={confirm} onOpenChange={open => { if (!resetting) setConfirm(open); }}>
    <p>جست‌وجوهای فعال لغو می‌شوند و فعالیت‌ها، ارجاع‌ها، جست‌وجوهای ذخیره‌شده و تنظیمات همین نشست پاک می‌شوند.</p><div className={styles.submitRow}><Button variant="secondary" isDisabled={resetting} onPress={() => setConfirm(false)}>انصراف</Button><Button isLoading={resetting} onPress={onReset}>پاک کردن فعالیت و شروع دوباره</Button></div>
  </Dialog></>;
}
