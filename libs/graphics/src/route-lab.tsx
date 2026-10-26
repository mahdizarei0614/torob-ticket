import { useEffect, useMemo, useRef, useState } from 'react';
import type { GeoPoint, Itinerary, Mode, Place } from '@torob-ticket/contracts';
import { ThemeProvider, useTheme } from '@torob-ticket/ui';
import { GraphicsProvider, type GraphicsController } from './graphics-provider';
import { RouteScene, RouteTimeline } from './scenes/route-scene';
import { LocationScene } from './scenes/location-scene';
import type { IllustrativePath } from './geo/route-geometry';
import type { AreaGeometry } from './geo/geography';
import type { SceneMarker } from './scenes/scene-surface';
import styles from './scenes/scenes.module.css';
interface LabScenario { id: string; name: string; scope: 'domestic' | 'international'; itinerary: Itinerary }
interface FixtureAsset { revision: string; dots: { world: GeoPoint[]; iran: GeoPoint[] }; places: Place[]; paths: IllustrativePath[]; scenarios: LabScenario[]; destination: { features: { properties: { id: string; cityId: string; name?: string; kind: string; fictional?: boolean }; geometry: { type: string; coordinates: unknown } }[] } }
function Lab({ data, mode, setMode }: { data: FixtureAsset; mode: Mode; setMode: (mode: Mode) => void }) {
  const { appearance, setPreference } = useTheme();
  const [pinned, setPinned] = useState(data.scenarios[0]!); const [preview, setPreview] = useState<LabScenario | null>(null);
  const [direction, setDirection] = useState<'outbound' | 'return'>('outbound');
  const [fit, setFit] = useState(0); const [reveal, setReveal] = useState(1); const [progress, setProgress] = useState<0 | .35 | .7 | 1>(0);
  const [point, setPoint] = useState<GeoPoint>(); const [place, setPlace] = useState(''); const [report, setReport] = useState('');
  const [fitMode, setFitMode] = useState<'route' | 'geography'>('geography');
  const [empty, setEmpty] = useState(false);
  const controller = useRef<GraphicsController | null>(null);
  const displayed = preview ?? pinned;
  const pin = (scenario: LabScenario) => { setFitMode('route'); setPinned(scenario); setPreview(null); setDirection('outbound'); setMode(scenario.itinerary.mode); setFit(value => value + 1); };
  const features = useMemo(() => data.destination.features.filter(feature => feature.properties.cityId === 'tehran'), [data]);
  const boundary = useMemo(() => features.find(feature => feature.properties.kind === 'illustrative-destination-extent')!.geometry as AreaGeometry, [features]);
  const landmarks = useMemo<SceneMarker[]>(() => features.filter(feature => feature.properties.kind === 'landmark').map(feature => ({ id: feature.properties.id, name: feature.properties.name ?? 'نشانه محلی', point: { longitude: (feature.geometry.coordinates as number[])[0]!, latitude: (feature.geometry.coordinates as number[])[1]! }, kind: 'landmark' })), [features]);
  const accommodations = useMemo<SceneMarker[]>(() => features.filter(feature => feature.properties.kind === 'accommodation').slice(0, 3).map((feature, i) => ({ id: feature.properties.id, name: ['اقامتگاه سپیدار','اقامتگاه آفتاب','اقامتگاه نارون'][i]!, point: { longitude: (feature.geometry.coordinates as number[])[0]!, latitude: (feature.geometry.coordinates as number[])[1]! }, kind: 'accommodation' })), [features]);
  return <main className={styles.lab} lang="fa" dir="rtl">
    <h1>کارگاه نقشه و مسیر</h1>
    <p>کاتالوگ جغرافیایی و تنظیمات نمایش مسیر. جغرافیا: Natural Earth، مالکیت عمومی؛ فرودگاه‌ها: OurAirports. نشانه‌ها و محدوده‌ها: <a href="/provenance.json">منشأ داده‌های محلی</a>.</p>
    <div className={styles.labControls}>
      <label>نوع سفر <select aria-label="نوع سفر" value={mode} onChange={event => { const next = event.target.value as Mode; pin(data.scenarios.find(scenario => scenario.itinerary.mode === next)!); }}><option value="flight">هواپیما</option><option value="train">قطار</option><option value="bus">اتوبوس</option></select></label>
      <label>محدوده <select aria-label="محدوده" value={pinned.scope} onChange={event => pin(data.scenarios.find(scenario => scenario.itinerary.mode === mode && scenario.scope === event.target.value)!)}><option value="domestic">ایران</option><option value="international">جهان</option></select></label>
      <label>مسیر <select aria-label="مسیر" value={pinned.id} onChange={event => pin(data.scenarios.find(scenario => scenario.id === event.target.value)!)}>{data.scenarios.map(scenario => <option value={scenario.id} key={scenario.id}>{scenario.name}</option>)}</select></label>
      <button onClick={event => setPreference(appearance === 'light' ? 'dark' : 'light', event.currentTarget)}>تغییر روشنایی</button>
      <button onClick={() => setPreview(data.scenarios.find(scenario => scenario.id !== pinned.id && scenario.itinerary.mode === mode) ?? pinned)}>پیش‌نمایش مسیر دیگر</button>
      <button onClick={() => setPreview(null)}>پایان پیش‌نمایش</button>
      <button onClick={() => { setFitMode('route'); if (preview) pin(preview); else setFit(value => value + 1); }}>تثبیت و تنظیم دوربین</button>
      <button onClick={() => { setFitMode('geography'); setFit(value => value + 1); }}>نمای کامل جغرافیا</button>
      <label>جهت <select aria-label="جهت" value={direction} onChange={event => setDirection(event.target.value as 'outbound' | 'return')}><option value="outbound">رفت</option><option value="return" disabled={!displayed.itinerary.return}>برگشت</option></select></label>
      <label>پیشرفت ارجاع <select aria-label="پیشرفت ارجاع" value={progress} onChange={event => setProgress(Number(event.target.value) as 0 | .35 | .7 | 1)}><option value="0">مبدأ · ۰٪</option><option value="0.35">مقایسه · ۳۵٪</option><option value="0.7">پیشنهاد انتخابی · ۷۰٪</option><option value="1">ارجاع · ۱۰۰٪</option></select></label>
      <label>آشکارسازی مسیر <input type="range" aria-label="آشکارسازی مسیر" min="0" max="1" step="0.1" value={reveal} onChange={event => setReveal(Number(event.target.value))} /></label>
      <label><input type="checkbox" aria-label="بدون برنامه سفر" checked={empty} onChange={event => setEmpty(event.target.checked)} />بدون برنامه سفر</label>
      <button onClick={() => setReport(JSON.stringify({ ...controller.current?.inspect(), pinned: pinned.id, displayed: displayed.id, direction, progress, point, selectedPlace: place, dataRevision: data.revision }, null, 2))}>تازه‌سازی گزارش مسیر</button>
    </div>
    <p aria-live="polite">{preview ? 'پیش‌نمایش بدون تنظیم دوربین' : 'مسیر تثبیت‌شده'} · <output aria-label="مکان انتخابی">{place || 'انتخاب نشده'}</output></p>
    <GraphicsProvider controllerRef={controller} diagnostics>
      <div className={styles.layout}>
        <div className={styles.mainMap} data-testid="main-route-map"><RouteScene places={data.places} dots={displayed.scope === 'domestic' ? data.dots.iran : data.dots.world} scope={displayed.scope} fitMode={fitMode} itinerary={empty ? undefined : displayed.itinerary} paths={data.paths} direction={direction} fitKey={String(fit)} originKey={pinned.itinerary.originPlaceId} progress={progress} reveal={reveal} onPlaceSelect={setPlace} /></div>
        <section className={styles.results} aria-label="محتوای مستقل قابل پیمایش"><h2>مسیر متنی معادل</h2><RouteTimeline itinerary={displayed.itinerary} places={data.places} direction={direction} />{Array.from({ length: 18 }, (_, i) => <p key={i}>جزئیات مسیر هنگام پیمایش · {i + 1}</p>)}</section>
      </div>
      <section className={styles.location}><h2>انتخاب موقعیت محلی</h2><LocationScene destinationBoundary={boundary} landmarks={landmarks} accommodations={accommodations} customPoint={point} onPointChange={setPoint} fitKey="tehran" /><output aria-label="نقطه انتخابی" dir="ltr">{point ? `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}` : 'No custom point'}</output></section>
    </GraphicsProvider>
    <h2>گزارش فنی آزمایشگاه</h2><pre data-testid="route-report" className={styles.report}>{report}</pre><a href="/">صفحه اصلی</a>
  </main>;
}
export function RouteLab() {
  const [data, setData] = useState<FixtureAsset>(); const [error, setError] = useState(false); const [mode, setMode] = useState<Mode>('flight');
  useEffect(() => { const abort = new AbortController(); fetch('/geography/route-scene-fixtures.json', { signal: abort.signal }).then(response => { if (!response.ok) throw new Error('Bundled scene data unavailable'); return response.json(); }).then((data: FixtureAsset) => setData(data)).catch(() => { if (!abort.signal.aborted) setError(true); }); return () => abort.abort(); }, []);
  return <ThemeProvider mode={mode} language="fa" initialPreference="light">{data ? <Lab data={data} mode={mode} setMode={setMode} /> : <p lang="fa" role="status">{error ? 'داده محلی نقشه در دسترس نیست.' : 'آماده‌سازی داده محلی نقشه…'}</p>}</ThemeProvider>;
}
