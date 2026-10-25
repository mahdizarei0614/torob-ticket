import { useRef, useState } from 'react';
import { ThemeProvider, useTheme } from '@torob-ticket/ui';
import type { Mode } from '@torob-ticket/contracts';
import { GraphicsProvider, useGraphics, type GraphicsController } from './graphics-provider';
import { GraphicsView } from './graphics-view';
import { useLabResources, useLabScene } from './lab-scene';
import styles from './graphics.module.css';
function Fallback() {
  return <svg viewBox="0 0 300 180" role="presentation"><rect width="300" height="180" fill="var(--scene-background)" /><path d="M30 130 L270 50" fill="none" stroke="var(--scene-route)" strokeWidth="4" /><circle cx="270" cy="50" r="8" fill="var(--scene-highlight)" stroke="var(--scene-route)" /></svg>;
}
function Scenes({ broken, cameraX, moving, showSecond }: { broken: boolean; cameraX: number; moving: boolean; showSecond: boolean }) {
  const resources = useLabResources(broken);
  const scene = useLabScene(resources, cameraX, moving);
  return <div className={styles.views}>
    <section><h2>نمای مسیر اول</h2><GraphicsView label="مسیر اول: تهران به شیراز" fallback={<Fallback />}>{scene}</GraphicsView><p>تهران ← شیراز · نمایش مسیر نمونه</p></section>
    <section><h2>نمای مسیر دوم</h2><GraphicsView visible={showSecond} label="مسیر دوم: تهران به اصفهان" fallback={<Fallback />}>{scene}</GraphicsView><p>تهران ← اصفهان · نمایش مسیر نمونه</p></section>
  </div>;
}
function HostStatus() { const { status } = useGraphics(); return <output aria-label="وضعیت گرافیک" dir="ltr">{status}</output>; }
function Lab({ mode, setMode }: { mode: Mode; setMode: (mode: Mode) => void }) {
  const { appearance, setPreference } = useTheme();
  const [mounted, setMounted] = useState(true);
  const [covered, setCovered] = useState(false);
  const [motion, setMotion] = useState(false);
  const [second, setSecond] = useState(true);
  const [selected, setSelected] = useState('اول');
  const [cameraX, setCameraX] = useState(0);
  const [report, setReport] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const controller = useRef<GraphicsController | null>(null);
  const broken = new URLSearchParams(location.search).get('shader') === 'broken';
  const refresh = () => setReport(JSON.stringify({ ...controller.current?.inspect(), selected, cameraX }, null, 2));
  return <main className={styles.lab} lang="fa" dir="rtl">
    <h1>آزمایشگاه گرافیک</h1><p>صحنه آزمایشی زیرساخت نمایش؛ مقایسه یا رزرو واقعی انجام نمی‌شود.</p>
    <div className={styles.controls}>
      <label>نوع سفر <select value={mode} onChange={event => setMode(event.target.value as Mode)}><option value="flight">هواپیما</option><option value="train">قطار</option><option value="bus">اتوبوس</option></select></label>
      <button onClick={event => setPreference(appearance === 'light' ? 'dark' : 'light', event.currentTarget)}>تغییر روشنایی</button>
      <button onClick={() => setSelected('دوم')}>انتخاب مسیر دوم</button>
      <button onClick={() => { setCameraX(value => value + 0.1); controller.current?.invalidate(); }}>جابجایی دوربین</button>
      <button onClick={() => { setCovered(true); dialog.current?.showModal(); }}>باز کردن گفتگو</button>
      <label><input type="checkbox" checked={motion} onChange={event => setMotion(event.target.checked)} />حرکت نمایشی</label>
      <button onClick={() => setSecond(value => !value)}>نمایش یا پنهان کردن نمای دوم</button>
      <button onClick={() => setMounted(value => !value)}>{mounted ? 'آزادسازی گرافیک' : 'راه‌اندازی گرافیک'}</button>
      <button onClick={refresh}>تازه‌سازی گزارش</button>
    </div>
    <p>مسیر انتخاب‌شده: <output aria-label="مسیر انتخاب‌شده">{selected}</output> · جابجایی دوربین: <output aria-label="جابجایی دوربین">{cameraX.toFixed(1)}</output></p>
    {mounted && <GraphicsProvider controllerRef={controller} covered={covered} motion={motion} diagnostics>
      <HostStatus /><Scenes broken={broken} cameraX={cameraX} moving={motion && !covered} showSecond={second} />
    </GraphicsProvider>}
    <dialog ref={dialog} aria-label="گفتگوی آزمایشی" onClose={() => setCovered(false)}>
      <h2>گفتگوی آزمایشی</h2><p>مسیر انتخاب‌شده حفظ می‌شود.</p>
      <form method="dialog"><button>بستن گفتگو</button></form>
    </dialog>
    <h2>گزارش فنی آزمایشگاه</h2><pre className={styles.report} data-testid="graphics-report">{report}</pre>
    <div className={styles.spacer} aria-hidden="true" /><a href="/">بازگشت به صفحه اصلی</a>
  </main>;
}
export function GraphicsLab() {
  const [mode, setMode] = useState<Mode>('flight');
  return <ThemeProvider mode={mode} language="fa" initialPreference="light"><Lab mode={mode} setMode={setMode} /></ThemeProvider>;
}
