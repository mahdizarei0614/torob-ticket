import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { SearchPage } from './features/search/search-page';
const GraphicsLab = lazy(() => import('@torob-ticket/graphics').then(module => ({ default: module.GraphicsLab })));
const RouteLab = lazy(() => import('@torob-ticket/graphics').then(module => ({ default: module.RouteLab })));
export function ConsumerRoutes() { return <BrowserRouter><Routes><Route path="/" element={<SearchPage />} /><Route path="/graphics-lab" element={<Suspense fallback={<p lang="fa" dir="rtl">در حال آماده‌سازی آزمایشگاه…</p>}><GraphicsLab /></Suspense>} /><Route path="/route-lab" element={<Suspense fallback={<p lang="fa" dir="rtl">در حال آماده‌سازی نقشه…</p>}><RouteLab /></Suspense>} /><Route path="*" element={<main lang="fa" dir="rtl"><h1>این صفحه پیدا نشد</h1><a href="/">بازگشت به جست‌وجوی سفر</a></main>} /></Routes></BrowserRouter>; }
