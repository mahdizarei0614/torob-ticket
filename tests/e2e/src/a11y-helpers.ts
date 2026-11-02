import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { expect } from '../fixtures';

/** Whole accessible page, including the active portal. No node/rule exclusions. */
export async function scanAccessibility(page: Page, info: TestInfo, state: string) {
  await page.evaluate(() => document.fonts.ready);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const receipt = {
    state, url: page.url(), viewport: page.viewportSize(), engine: result.testEngine,
    environment: result.testEnvironment, options: result.toolOptions,
    violations: result.violations, incomplete: result.incomplete,
    passes: result.passes.map(rule => ({ id: rule.id, nodeCount: rule.nodes.length })),
    inapplicable: result.inapplicable.map(rule => rule.id),
    boundary: 'Automated WCAG-tagged scan; incomplete findings need review. Not screen-reader, physical-device or compliance-certification evidence.',
  };
  writeFileSync(info.outputPath(`axe-${state}.json`), JSON.stringify(receipt, null, 2) + '\n');
  expect(result.violations.map(rule => ({ id: rule.id, impact: rule.impact, description: rule.description, nodes: rule.nodes.map(node => ({ target: node.target, failureSummary: node.failureSummary })) })), `Whole-page axe violations in ${state}`).toEqual([]);
  return receipt;
}

export async function focusSnapshot(page: Page) {
  return page.evaluate(() => {
    const node = document.activeElement as HTMLElement | null;
    if (!node) return null;
    const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
    let left = Math.max(0, rect.left), right = Math.min(innerWidth, rect.right), top = Math.max(0, rect.top), bottom = Math.min(innerHeight, rect.bottom);
    let exposed = true;
    for (let owner: HTMLElement | null = node; owner; owner = owner.parentElement) {
      const visible = getComputedStyle(owner), bounds = owner.getBoundingClientRect();
      if (owner.inert || owner.getAttribute('aria-hidden') === 'true' || visible.display === 'none' || ['hidden', 'collapse'].includes(visible.visibility) || visible.opacity !== '' && Number(visible.opacity) === 0) exposed = false;
      if (owner !== node && /^(auto|scroll|hidden|clip)$/.test(visible.overflowX)) { left = Math.max(left, bounds.left + parseFloat(visible.borderLeftWidth || '0')); right = Math.min(right, bounds.right - parseFloat(visible.borderRightWidth || '0')); }
      if (owner !== node && /^(auto|scroll|hidden|clip)$/.test(visible.overflowY)) { top = Math.max(top, bounds.top + parseFloat(visible.borderTopWidth || '0')); bottom = Math.min(bottom, bounds.bottom - parseFloat(visible.borderBottomWidth || '0')); }
    }
    const owningCard = node.closest('article[data-price-card-id]');
    const wholeCardSelector = node.matches('button[data-card-select]') && !!owningCard;
    const paintPoint = { x: (left + right) / 2, y: (top + bottom) / 2 };
    const painted = wholeCardSelector && right > left && bottom > top ? document.elementFromPoint(paintPoint.x, paintPoint.y) : null;
    const cardPaint = wholeCardSelector ? { ...paintPoint, tag: painted?.tagName ?? null, belongsToOwningCard: !!painted && !!owningCard?.contains(painted) } : null;
    const ancestry = [];
    for (let owner: HTMLElement | null = node; owner && ancestry.length < 8; owner = owner.parentElement) {
      const visible = getComputedStyle(owner), bounds = owner.getBoundingClientRect();
      ancestry.push({ tag: owner.tagName, role: owner.getAttribute('role'), focusWithin: owner.matches(':focus-within'), focusVisible: owner.matches(':focus-visible'), outlineStyle: visible.outlineStyle, outlineWidth: visible.outlineWidth, outlineColor: visible.outlineColor, outlineOffset: visible.outlineOffset, boxShadow: visible.boxShadow, borderColor: visible.borderColor, borderWidth: visible.borderWidth, overflow: visible.overflow, opacity: visible.opacity, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
    }
    return { tag: node.tagName, role: node.getAttribute('role'), name: node.getAttribute('aria-label') ?? node.textContent?.trim().slice(0, 100), x: rect.x, y: rect.y, width: rect.width, height: rect.height, wholeCardSelector, cardPaint, exposed, focusVisible: node.matches(':focus-visible'), visibleIntersection: { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }, outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, outlineColor: style.outlineColor, boxShadow: style.boxShadow, ancestry, viewport: { width: innerWidth, height: innerHeight } };
  });
}

export class KeyboardTraversalFailure extends Error {
  constructor(readonly steps: Awaited<ReturnType<typeof focusSnapshot>>[], limit: number) { super(`Keyboard traversal did not reach its one visible target in ${limit} Tab steps`); }
}

/** Real Tab/Shift+Tab traversal, never locator.focus() or DOM focus injection. */
export async function tabTo(page: Page, target: Locator, reverse = false, limit = 100) {
  await expect(target).toHaveCount(1);
  const tape: Awaited<ReturnType<typeof focusSnapshot>>[] = [];
  for (let index = 0; index <= limit; index++) {
    // A native combobox menu may temporarily hide outside controls from the
    // accessibility tree. Keep traversing it rather than waiting on a hidden
    // target and confusing a valid intermediate popup with a keyboard trap.
    const count = await target.count(); expect(count).toBeLessThanOrEqual(1);
    if (count === 1 && await target.evaluate(node => node === document.activeElement)) {
      await expect(target).toBeFocused();
      const focus = await focusSnapshot(page);
      expect(focus).not.toBeNull();
      expect(focus!.width).toBeGreaterThan(0); expect(focus!.height).toBeGreaterThan(0);
      expect(focus!.exposed).toBe(true);
      if (focus!.wholeCardSelector) {
        // This button spans an entire ticket, including expanding seller rows.
        // Its visible native focus ring and substantial clipped intersection
        // matter; every smaller control below retains strict full-box bounds.
        expect(focus!.visibleIntersection.width).toBeGreaterThanOrEqual(44);
        expect(focus!.visibleIntersection.height).toBeGreaterThanOrEqual(44);
        expect(focus!.cardPaint?.belongsToOwningCard).toBe(true);
        expect(focus!.focusVisible).toBe(true); expect(focus!.outlineStyle).not.toBe('none');
        expect(parseFloat(focus!.outlineWidth)).toBeGreaterThan(0);
        expect(focus!.outlineColor).not.toMatch(/^(transparent|rgba\([^)]*,\s*0\))$/);
      } else {
        expect(focus!.x).toBeGreaterThanOrEqual(-1); expect(focus!.x + focus!.width).toBeLessThanOrEqual(focus!.viewport.width + 1);
        expect(focus!.y).toBeGreaterThanOrEqual(0); expect(focus!.y + focus!.height).toBeLessThanOrEqual(focus!.viewport.height + 1);
      }
      return tape;
    }
    await page.keyboard.press(reverse ? 'Shift+Tab' : 'Tab');
    tape.push(await focusSnapshot(page));
  }
  throw new KeyboardTraversalFailure(tape, limit);
}
