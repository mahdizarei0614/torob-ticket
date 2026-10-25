import {HotelEntry} from '../hotels/hotel-entry';
import {AccountPanel} from '../account/account-panel';
import { useState } from 'react';
import { GraphicsProvider } from '@torob-ticket/graphics/host';
import { ResultsPage } from '../results/results-page';
import { TripMap, MobileRoutePanel, useDesktopMap } from '../map/trip-map';
import { useTripMap } from '../map/use-trip-map';
import { DateExplorer } from '../dates/date-explorer';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@torob-ticket/client';
import { Button, ThemeProvider, useTheme } from '@torob-ticket/ui';
import type { CatalogSnapshot, SessionInfo, HotelQuoteSnapshot } from '@torob-ticket/contracts';
import { DemoMenu } from '../demo/demo-menu';
import { SearchComposer } from './search-composer';
import { errorMessage, useSearchController } from './use-search-controller';
import styles from './search.module.css';
function AppearanceButton() {
  const theme = useTheme();
  return <Button variant="quiet" aria-label={theme.appearance === 'dark' ? 'نمای روشن' : 'نمای تیره'} onPress={event => theme.setPreference(theme.appearance === 'dark' ? 'light' : 'dark', event.target as HTMLElement)}>{theme.appearance === 'dark' ? '☀' : '☾'}</Button>;
}
function Consumer({ catalog, session }: { catalog: CatalogSnapshot; session: SessionInfo }) {
  const controller = useSearchController(catalog, session);
  const { state } = controller;
  const map=useTripMap(controller,catalog);const desktop=useDesktopMap();const [mapMotion,setMapMotion]=useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);const [accountOpen,setAccountOpen]=useState(false);const [hotelOpen,setHotelOpen]=useState(false);const [hotelQuote,setHotelQuote]=useState<HotelQuoteSnapshot|undefined>();const covered=calendarOpen||accountOpen||hotelOpen;
  const [dateInteracting, setDateInteracting] = useState(false);
  const cityName = (id: string) => catalog.cities.find(c => c.id === id)?.name ?? 'انتخاب نشده';
  return <ThemeProvider language="fa" mode={state.draft.mode}><GraphicsProvider covered={covered} foregroundAllowed={!calendarOpen&&!accountOpen} motion={mapMotion}><main lang="fa" dir="rtl" className={styles.shell} data-pinned-itinerary={state.pinnedItineraryId} data-preview-itinerary={state.previewItineraryId} data-selected-hotel-quote={hotelQuote?.quoteId}>
    <TripMap map={map} catalog={catalog} desktop={desktop} covered={covered} onMotionChange={setMapMotion}/>
    <div className={styles.content}><header className={styles.header}><a className={styles.brand} href="/" aria-label="ترب تیکت، خانه">ترب<span>تیکت</span><small>مقایسه سفر</small></a><div className={styles.headerActions}><span className={styles.demoBadge}>نسخه نمایشی</span><AppearanceButton /><AccountPanel controller={controller} catalog={catalog} session={session} onCovered={setAccountOpen}/></div></header>
      <section className={styles.intro}><span className={styles.eyebrow}>مسیر خودت را پیدا کن</span><h1>سفر بعدی از کجا شروع می‌شود؟</h1><p>پرواز، قطار یا اتوبوس؛ شرایط سفر را کنار هم ببینید.</p></section>
      <SearchComposer draft={state.draft} catalog={catalog} session={session} edit={controller.edit} onSubmit={() => { void controller.submit(undefined,true); }} errors={controller.validity.errors} pending={controller.pending} disabled={controller.resetting || controller.startLimitReached || dateInteracting} dateExplorer={<DateExplorer interaction={controller.dateInteractions} draft={state.draft} catalog={catalog} session={session} onCommit={controller.commitDates} onPreview={date => controller.dispatch({ type: 'preview-date', date })} onCovered={setCalendarOpen} onInteractionChange={setDateInteracting} disabled={controller.resetting} waiting={controller.waitingDate} />} />
      <div aria-live="polite" className={styles.feedback}>{dateInteracting && <p role="status">انتخاب روز در حال تنظیم است؛ با رها کردن، همان تاریخ جست‌وجو می‌شود.</p>}{controller.capacityMessage && <p role="status">{controller.capacityMessage}</p>}{state.notice && <p role="status">{state.notice}</p>}{controller.feedback && <p role="alert" className={styles.error}>{controller.feedback}</p>}{controller.accepted && <p role="status">درخواست جست‌وجو برای {cityName(state.committed?.originCityId ?? '')} به {cityName(state.committed?.destinationCityId ?? '')} در نشست شما ثبت شد.</p>}</div>
      {!desktop&&<MobileRoutePanel map={map} catalog={catalog}/>}
      <HotelEntry controller={controller} map={map} catalog={catalog} session={session} onCovered={setHotelOpen} onSelectHotelQuote={setHotelQuote}/>
      {state.searchId && state.committed && state.generation && <ResultsPage isCurrent={() => controller.resultIsCurrent(state.generation!,state.searchId!)} generation={state.generation} searchId={state.searchId} query={state.committed} catalog={catalog} refinementDisabled={!controller.canRefineResults || controller.pending || controller.resetting || controller.startLimitReached || dateInteracting} draftChanged={!controller.canRefineResults} enterResults={controller.enterResults} onRefine={query => controller.refineResults(query,state.generation!,controller.refinementToken)} onEdit={() => { const form = document.querySelector<HTMLFormElement>('form'); form?.scrollIntoView({block:'start'}); form?.querySelector<HTMLElement>('input,button')?.focus({preventScroll:true}); }} onPreviewItinerary={map.preview} onPinItinerary={map.pin} onSelectQuote={map.selection} />}
      <footer className={styles.footer}><DemoMenu catalog={catalog} session={session} onPreset={controller.preset} onReset={() => { void controller.reset(); }} resetting={controller.resetting} /><p role="note">نسخه نمایشی با داده‌ها و فروشندگان خیالی؛ خرید یا رزرو انجام نمی‌شود. مستقل از ترب.</p></footer>
    </div>
  </main></GraphicsProvider></ThemeProvider>;
}
export function SearchPage() {
  const bootstrap = useQuery({ queryKey: ['consumer-bootstrap'], queryFn: async ({ signal }) => { const session = await apiClient.session(); const catalog = await apiClient.catalog(signal); return { session: apiClient.sessionSnapshot() ?? session, catalog }; }, staleTime: Infinity, retry: false, refetchOnWindowFocus: false });
  if (!bootstrap.data) return <ThemeProvider language="fa"><main lang="fa" dir="rtl" className={styles.loading}><h1>ترب تیکت</h1><p role="note">نسخه نمایشی مقایسه سفر؛ خرید یا رزرو انجام نمی‌شود.</p><p role={bootstrap.error ? 'alert' : 'status'}>{bootstrap.error ? errorMessage(bootstrap.error) : 'در حال آماده‌سازی مسیرهای سفر…'}</p>{bootstrap.error && <Button onPress={() => { void bootstrap.refetch(); }}>تلاش دوباره</Button>}<a href="/admin/">مدیریت نسخه نمایشی</a></main></ThemeProvider>;
  return <Consumer catalog={bootstrap.data.catalog} session={bootstrap.data.session} />;
}
