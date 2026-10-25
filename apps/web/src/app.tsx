import { lazy, Suspense } from 'react';
const GraphicsLab = lazy(() => import('@torob-ticket/graphics').then(module => ({ default: module.GraphicsLab })));
export function App() {
  if (location.pathname === '/graphics-lab') return <Suspense fallback={<p lang="fa" dir="rtl">در حال آماده‌سازی آزمایشگاه…</p>}><GraphicsLab /></Suspense>;
  return (
    <main lang="fa" dir="rtl">
      <h1>ترب تیکت</h1>
      <p role="note">نسخه نمایشی مقایسه سفر؛ خرید یا رزرو انجام نمی‌شود.</p>
      <a href="/admin/">مدیریت نسخه نمایشی</a>
    </main>
  );
}
