import { useState } from 'react';
import { Button, Dialog } from '@torob-ticket/ui';
import type { CatalogSnapshot, Mode, Scope, SessionInfo } from '@torob-ticket/contracts';
import { dateBounds, type SearchDraft } from '../search/search-url';
import styles from '../search/search.module.css';
const modeNames = { flight: 'پرواز', train: 'قطار', bus: 'اتوبوس' };
export function DemoMenu({ catalog, session, onPreset }: { catalog: CatalogSnapshot; session: SessionInfo; onPreset: (draft: SearchDraft) => void }) {
  const [open, setOpen] = useState(false);
  const presets = (['flight','train','bus'] as Mode[]).flatMap(mode => (['domestic','international'] as Scope[]).flatMap(scope => {
    const route = catalog.supportedConnections.find(c => c.mode === mode && c.scope === scope);
    if (!route) return [];
    const origin = catalog.cities.find(c => c.id === route.originCityId);
    const destination = catalog.cities.find(c => c.id === route.destinationCityId);
    const classCode = catalog.classChoices.find(c => c.mode === mode)?.code;
    if (!origin || !destination || !classCode) return [];
    return [{ label: `${modeNames[mode]} ${scope === 'domestic' ? 'داخلی' : 'بین‌المللی'} · ${origin.name} به ${destination.name}`, draft: { ...route, tripType: 'one-way' as const, departureDate: dateBounds(session, origin.timeZone).min, party: { adults: 1, children: 0, infants: 0 }, classCode, filters: {}, sort: 'cheapest' as const } }];
  }));
  return <><Button variant="quiet" onPress={() => setOpen(true)}>سفرهای پیشنهادی</Button><Dialog title="سفرهای پیشنهادی" isOpen={open} onOpenChange={setOpen}>
    <p className={styles.muted}>یک مسیر را انتخاب کنید و جزئیات سفر را به دلخواه تغییر دهید.</p><div className={styles.presets}>{presets.map(p => <Button key={`${p.draft.mode}-${p.draft.scope}`} variant="secondary" onPress={() => { onPreset(p.draft); setOpen(false); }}>{p.label}</Button>)}</div>
  </Dialog></>;
}
