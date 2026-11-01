import { expect, loadQuery, dateExplorer, currentDatePrices, queryFor, runSearch, test, writeEvidence } from '../../fixtures';
import { assertCalendarMinimum, assertDateSurfaces, minimumTotal, withDate } from './matrix-assertions';

for (const mode of ['flight', 'train', 'bus'] as const) {
  test(`@t30-dates ${mode}: return wheel, chart and applied calendar preserve the fixed leg and exact complete totals`, async ({ reviewer }, info) => {
    test.setTimeout(150_000);
    const { page } = reviewer;
    const query = queryFor(mode, 'domestic', 'round-trip');
    let starts = 0;
    page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/searches') starts++; });
    await loadQuery(reviewer, query);
    let recovery = await runSearch(reviewer);
    const baseline = recovery;
    const outboundId = await dateExplorer(page).getAttribute('data-date-price-id');
    const returnControl = page.getByRole('radiogroup', { name: 'جستجو بر اساس', exact: true }).getByRole('radio', { name: 'تاریخ برگشت', exact: true });
    await returnControl.focus(); await page.keyboard.press('Space');
    await expect(dateExplorer(page)).toHaveAttribute('data-date-leg', 'return');
    await expect(dateExplorer(page)).not.toHaveAttribute('data-date-price-id', outboundId!);
    const returnPrices = await assertDateSurfaces(reviewer, recovery);
    expect(returnPrices.query.query.departureDate).toBe(query.departureDate);
    const priced = returnPrices.cells.filter(cell => cell.status === 'priced');
    expect(new Set(priced.map(cell => cell.minimum.amountRial)).size).toBeGreaterThan(1);
    expect(starts).toBe(1);
    const commits = [];

    const wheel = page.getByRole('listbox', { name: 'روزهای نزدیک', exact: true });
    recovery = await runSearch(reviewer, async () => { await wheel.focus(); await page.keyboard.press('ArrowDown'); });
    expect(recovery.snapshot.query).toEqual(withDate(query, 'return', '2026-11-10'));
    const wheelCell = priced.find(cell => cell.date === '2026-11-10');
    expect(wheelCell?.status).toBe('priced');
    if (!wheelCell || wheelCell.status !== 'priced') throw new Error('Missing actual next-return-day price');
    expect(minimumTotal(recovery)).toBe(wheelCell.minimum.amountRial);
    await assertDateSurfaces(reviewer, recovery);
    commits.push({ interaction: 'native wheel keyboard ArrowDown', searchId: recovery.snapshot.searchId, query: recovery.snapshot.query, total: minimumTotal(recovery) });

    const chart = page.getByRole('slider', { name: 'انتخاب روز از نمودار', exact: true });
    recovery = await runSearch(reviewer, async () => { await chart.focus(); await page.keyboard.press('ArrowRight'); });
    expect(recovery.snapshot.query).toEqual(withDate(query, 'return', '2026-11-11'));
    const chartCell = priced.find(cell => cell.date === '2026-11-11');
    expect(chartCell?.status).toBe('priced');
    if (!chartCell || chartCell.status !== 'priced') throw new Error('Missing actual next chart return price');
    expect(minimumTotal(recovery)).toBe(chartCell.minimum.amountRial);
    await assertDateSurfaces(reviewer, recovery);
    commits.push({ interaction: 'native chart keyboard ArrowRight', searchId: recovery.snapshot.searchId, query: recovery.snapshot.query, total: minimumTotal(recovery) });

    // Provisional calendar changes use real controls and real new date evidence without committing transport.
    const calendarBefore = await dateExplorer(page).getAttribute('data-date-price-id');
    await page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true }).click();
    const calendar = page.getByRole('dialog', { name: 'انتخاب تاریخ سفر', exact: true });
    await expect(calendar).toBeVisible();
    await expect(dateExplorer(page)).not.toHaveAttribute('data-date-price-id', calendarBefore!);
    await currentDatePrices(reviewer);
    await calendar.getByText('ورود تاریخ میلادی', { exact: true }).click();
    await calendar.getByLabel('تاریخ برگشت میلادی در تقویم', { exact: true }).fill('2026-11-12');
    const provisional = await currentDatePrices(reviewer);
    const provisionalCell = provisional.cells.find(cell => cell.date === '2026-11-12');
    expect(provisionalCell?.status).toBe('priced');
    expect(provisional.query.query.departureDate).toBe(query.departureDate);
    expect(starts).toBe(3);
    await expect(dateExplorer(page)).toHaveAttribute('data-selected-return', '2026-11-11');
    recovery = await runSearch(reviewer, () => calendar.getByRole('button', { name: 'اعمال تاریخ‌ها', exact: true }).click());
    expect(recovery.snapshot.query).toEqual(withDate(query, 'return', '2026-11-12'));
    if (!provisionalCell || provisionalCell.status !== 'priced') throw new Error('Missing calendar complete return price');
    expect(minimumTotal(recovery)).toBe(provisionalCell.minimum.amountRial);
    await assertDateSurfaces(reviewer, recovery);
    commits.push({ interaction: 'native Gregorian calendar input + Apply dates', searchId: recovery.snapshot.searchId, query: recovery.snapshot.query, total: minimumTotal(recovery) });

    const returnId = await dateExplorer(page).getAttribute('data-date-price-id');
    const outboundControl = page.getByRole('radiogroup', { name: 'جستجو بر اساس', exact: true }).getByRole('radio', { name: 'تاریخ رفت', exact: true });
    await outboundControl.focus(); await page.keyboard.press('Space');
    await expect(dateExplorer(page)).toHaveAttribute('data-date-leg', 'outbound');
    await expect(dateExplorer(page)).not.toHaveAttribute('data-date-price-id', returnId!);
    const outboundPrices = await currentDatePrices(reviewer);
    expect(outboundPrices.query.query.returnDate).toBe('2026-11-12');
    const nextOutbound = outboundPrices.cells.find(cell => cell.date === '2026-11-03');
    expect(nextOutbound?.status).toBe('priced');
    recovery = await runSearch(reviewer, async () => { await wheel.focus(); await page.keyboard.press('ArrowDown'); });
    expect(recovery.snapshot.query).toEqual({ ...query, departureDate: '2026-11-03', returnDate: '2026-11-12' });
    if (!nextOutbound || nextOutbound.status !== 'priced') throw new Error('Missing complete departure price with fixed return');
    expect(minimumTotal(recovery)).toBe(nextOutbound.minimum.amountRial);
    await assertDateSurfaces(reviewer, recovery);
    await assertCalendarMinimum(reviewer, recovery);
    commits.push({ interaction: 'outbound native wheel with return fixed', searchId: recovery.snapshot.searchId, query: recovery.snapshot.query, total: minimumTotal(recovery) });
    expect(starts).toBe(5);
    writeEvidence(info, 'date-commits', { session: reviewer.session, baseline, returnPrices, provisional, outboundPrices, commits, starts, final: recovery, proof: 'Every exact total is an actual complete single-provider round-trip quote; each native date commit starts exactly one search and preserves its opposite leg.' });
  });
}
