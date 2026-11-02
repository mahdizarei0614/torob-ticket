import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { expect } from '../fixtures';
import { tabTo } from './a11y-helpers';

/** Passive public DOM trace. Never changes focus, hiding, inert or vendor code. */
export async function installCityMenuFocusTrace(page: Page) {
  await page.addInitScript(() => {
    const entries: Record<string, unknown>[] = [], identities = new WeakMap<Element, number>();
    let sequence = 0, nextIdentity = 0, phase = 'boot', overflow = false;
    const identify = (node: Element) => { let id = identities.get(node); if (!id) { id = ++nextIdentity; identities.set(node, id); } return id; };
    const describe = (node: Element | null) => node ? { node: identify(node), tag: node.tagName, id: node.id, role: node.getAttribute('role'), type: node.getAttribute('type'), name: node.getAttribute('aria-label'), labels: node instanceof HTMLInputElement ? Array.from(node.labels ?? []).map(label => label.textContent?.trim()) : undefined, connected: node.isConnected } : null;
    const ancestry = (node: Element | null) => {
      const owners = [];
      for (let current = node; current; current = current.parentElement) owners.push({ ...describe(current), ariaHidden: current.getAttribute('aria-hidden'), inert: current instanceof HTMLElement && current.inert, inertAttribute: current.hasAttribute('inert') });
      return owners;
    };
    const snapshot = () => {
      const active = document.activeElement, owners = ancestry(active);
      return { active: describe(active), ancestors: owners, hiddenOwners: owners.filter(owner => owner.ariaHidden === 'true' || owner.inert || owner.inertAttribute), originExpanded: document.querySelector('[role="combobox"][aria-label="مبدا"]')?.getAttribute('aria-expanded') ?? Array.from(document.querySelectorAll<HTMLInputElement>('input[role="combobox"]')).find(input => Array.from(input.labels ?? []).some(label => label.textContent?.trim() === 'مبدا'))?.getAttribute('aria-expanded') ?? null, listboxes: document.querySelectorAll('[role="listbox"]').length, documentFocused: document.hasFocus(), visibility: document.visibilityState };
    };
    const emit = (kind: string, facts: Record<string, unknown> = {}) => {
      if (entries.length >= 20_000) { overflow = true; return; }
      entries.push({ sequence: ++sequence, phase, kind, at: performance.now(), ...facts });
    };
    document.addEventListener('keydown', event => emit('keydown-capture', { key: event.key, shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey, trusted: event.isTrusted, target: describe(event.target instanceof Element ? event.target : null), state: snapshot() }), true);
    document.addEventListener('pointerdown', event => emit('pointerdown-capture', { trusted: event.isTrusted, pointerType: event.pointerType, target: describe(event.target instanceof Element ? event.target : null), state: snapshot() }), true);
    document.addEventListener('focusin', event => {
      const focusSequence = sequence + 1, capturedPhase = phase, capturedTarget = document.activeElement;
      emit('focusin-capture', { focusSequence, trusted: event.isTrusted, eventPhase: event.eventPhase, target: describe(event.target instanceof Element ? event.target : null), state: snapshot() });
      queueMicrotask(() => emit('focus-microtask', { focusSequence, capturedPhase, sameActiveOwner: document.activeElement === capturedTarget, state: snapshot() }));
      requestAnimationFrame(() => {
        emit('focus-first-raf', { focusSequence, capturedPhase, sameActiveOwner: document.activeElement === capturedTarget, state: snapshot() });
        requestAnimationFrame(() => emit('focus-second-raf', { focusSequence, capturedPhase, sameActiveOwner: document.activeElement === capturedTarget, state: snapshot() }));
      });
    }, true);
    document.addEventListener('focusout', event => emit('focusout-capture', { trusted: event.isTrusted, target: describe(event.target instanceof Element ? event.target : null), relatedTarget: describe(event.relatedTarget instanceof Element ? event.relatedTarget : null), state: snapshot() }), true);
    const observe = () => new MutationObserver(records => {
      for (const record of records) if (record.target instanceof Element) emit('attribute-observer-delivery', { target: describe(record.target), attribute: record.attributeName, oldValue: record.oldValue, valueAtDelivery: record.attributeName ? record.target.getAttribute(record.attributeName) : null, state: snapshot() });
    }).observe(document, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['aria-hidden', 'inert', 'aria-expanded'] });
    observe();
    Object.assign(window, { t31CityMenuFocusTrace: { mark: (value: string) => { phase = value; emit('phase', { state: snapshot() }); }, snapshot: () => ({ entries: [...entries], overflow, current: snapshot(), semantics: 'focusin-capture reads attributes synchronously at native event capture. Mutation timestamps are observer delivery, not synchronous mutation timestamps. Finite microtask/rAF samples are separately identified.' }) } });
  });
}

interface FocusState {
  hiddenOwners: unknown[];
  originExpanded: string | null;
  active: { tag: string; name: string | null } | null;
}
interface FocusEntry {
  sequence: number;
  phase: string;
  kind: string;
  state: FocusState;
  trusted?: boolean;
  key?: string;
  shiftKey?: boolean;
  attribute?: string;
  oldValue?: string | null;
  valueAtDelivery?: string | null;
  sameActiveOwner?: boolean;
  target?: { tag: string; type: string | null; name: string | null } | null;
}
interface FocusTrace { entries: FocusEntry[]; overflow: boolean; current: FocusState }

const primaryExplanation = 'https://react-aria.adobe.com/blog/building-a-combobox#portals';

/** Exactly this pinned React Aria portal state, never a general axe exception.
 * Every other scan still requires zero violations. This retains all eight raw
 * findings and requires native event-time cleanup in the engine being tested.
 * It does not establish assistive-technology speech or touch behavior. */
export async function auditCityMenuFocus(page: Page, info: TestInfo) {
  const origin = page.getByRole('combobox', { name: 'مبدا', exact: true });
  const composer = page.locator('form[aria-label="جست‌وجوی سفر"]');
  const knownOwners: { name: string; locator: Locator }[] = [
    { name: 'toolbar', locator: page.locator('main header:has([data-profile-trigger])') },
    { name: 'introduction', locator: page.locator('main section:has(> h1)') },
    { name: 'mode-scope-trip-controls', locator: page.locator('form[aria-label="جست‌وجوی سفر"] > div:has([data-segment-track][data-segment-value="flight"]):has([data-segment-track][data-segment-value="domestic"]):has([data-segment-track][data-segment-value="one-way"])') },
    { name: 'origin-clear', locator: page.locator('button[aria-label="پاک کردن مبدا"]') },
    { name: 'class-control', locator: composer.locator('[data-search-field="classCode"]').locator('..') },
    { name: 'date-leg-control', locator: composer.locator('[data-search-controls] > div:has([data-segment-track][data-segment-value="outbound"])') },
    { name: 'date-explorer', locator: page.locator('section[aria-label="کاوش تاریخ سفر"]') },
    { name: 'submit-row', locator: composer.locator('[data-search-field="form"]').locator('..') },
  ];
  const actions: Record<string, unknown>[] = [];
  const ownerFacts: { name: string; count: number; nodes: { tag: string; id: string; ariaHidden: string | null }[] }[] = [];
  let checkpoint = 'start';
  const mark = async (phase: string) => {
    checkpoint = phase; actions.push({ phase, wallAt: Date.now() });
    await page.evaluate(value => (window as unknown as { t31CityMenuFocusTrace: { mark: (phase: string) => void } }).t31CityMenuFocusTrace.mark(value), phase);
  };
  const unhidden = async () => {
    for (const owner of knownOwners) await expect(owner.locator, owner.name).not.toHaveAttribute('aria-hidden', 'true');
  };
  const matchedOwners: { name: string; target: string }[] = [];
  let rawFindingsVerified = false, nativeActionsVerified = false;
  let recordedTrace: FocusTrace | undefined;
  const disposition = { engine: info.project.name, rawFindingsVerified, nativeActionsVerified, matchedOwners, ownerFacts, checkpoint,
    rawRule: 'aria-hidden-focus', rawNodeCount: 8, nativeEventTimeVerified: false, primaryExplanation,
    rationale: 'Pinned React Aria hides outside its portalled listbox for touch AT. This single measured state is manually dispositioned only if all eight exact outside owners match, every native focusin is exposed, and outside hiding retires before focus leaves the menu.',
    boundary: 'Raw violations remain visible. No axe rule or element is excluded. All other states require zero violations. This measures only this run\'s engine; VoiceOver was not performed at owner request.' };
  const saveDisposition = () => writeFileSync(info.outputPath('native-city-menu-disposition.json'), JSON.stringify(disposition, null, 2) + '\n');
  try {
    await mark('keyboard-open'); await tabTo(page, origin);
    await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('ته');
    await expect(origin).toHaveAttribute('aria-expanded', 'true');
    const list = page.getByRole('listbox').filter({ has: page.getByRole('option', { name: 'تهران', exact: true }) });
    await expect(list).toBeVisible(); await expect(origin).toBeFocused();
    const exposedInput = await origin.evaluate(node => !node.closest('[aria-hidden="true"], [inert]'));
    expect(exposedInput).toBe(true);
    await expect(list).toHaveAttribute('id', await origin.getAttribute('aria-controls') ?? 'missing-controls');
    await expect(list).not.toHaveAttribute('aria-hidden', 'true');
    await mark('raw-axe-open-menu');
    await page.evaluate(() => document.fonts.ready);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    // Collect the WHOLE page without excluding any rule, node or canvas.
    writeFileSync(info.outputPath('axe-city-menu.json'), JSON.stringify({
      state: 'city-menu', url: page.url(), viewport: page.viewportSize(), engine: axe.testEngine,
      environment: axe.testEnvironment, options: axe.toolOptions, violations: axe.violations,
      incomplete: axe.incomplete, passes: axe.passes.map(rule => ({ id: rule.id, nodeCount: rule.nodes.length })),
      inapplicable: axe.inapplicable.map(rule => rule.id),
      boundary: 'Raw whole-page findings retained, including all eight aria-hidden-focus findings. See native-city-menu-disposition.json; this is not a zero-violation scan.',
    }, null, 2) + '\n');
    expect(axe.violations.map(rule => rule.id)).toEqual(['aria-hidden-focus']);
    const findings = axe.violations[0]!.nodes;
    expect(findings).toHaveLength(8);
    checkpoint = 'known-outside-owners';
    // Capture all eight owners before any assertion can stop the audit.
    for (const owner of knownOwners) {
      const nodes = await owner.locator.evaluateAll(elements => elements.map(node => ({ tag: node.tagName, id: node.id, ariaHidden: node.getAttribute('aria-hidden') })));
      ownerFacts.push({ name: owner.name, count: nodes.length, nodes });
    }
    writeFileSync(info.outputPath('city-menu-owner-facts.json'), JSON.stringify(ownerFacts, null, 2) + '\n');
    for (const owner of knownOwners) {
      checkpoint = `verify-outside-owner:${owner.name}`;
      await expect(owner.locator, owner.name).toHaveCount(1);
      await expect(owner.locator, owner.name).toHaveAttribute('aria-hidden', 'true');
    }
    checkpoint = 'match-raw-owner-targets';
    for (const finding of findings) {
      expect(finding.target).toHaveLength(1);
      const target = finding.target[0]; expect(typeof target).toBe('string');
      if (typeof target !== 'string') throw new Error('Unexpected city-menu shadow target');
      await expect(page.locator(target)).toHaveCount(1);
      const matches: string[] = [];
      for (const owner of knownOwners) if (await owner.locator.evaluate((node, selector) => node.matches(selector), target)) matches.push(owner.name);
      expect(matches, `Exact structurally known outside owner for ${target}`).toHaveLength(1);
      matchedOwners.push({ name: matches[0]!, target });
    }
    expect(matchedOwners.map(owner => owner.name).sort()).toEqual(knownOwners.map(owner => owner.name).sort());
    rawFindingsVerified = true;

    await mark('native-tab-to-clear'); await page.keyboard.press('Tab');
    await expect(origin).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('button[aria-label="پاک کردن مبدا"]')).toBeFocused(); await unhidden();
    await mark('tab-to-clear-settled');

    await mark('native-shift-tab-to-input'); await page.keyboard.press('Shift+Tab');
    await expect(origin).toBeFocused(); await expect(origin).toHaveAttribute('aria-expanded', 'true');
    await mark('shift-tab-input-settled');
    const text = await origin.inputValue();
    await mark('native-escape'); await page.keyboard.press('Escape');
    await expect(origin).toBeFocused(); await expect(origin).toHaveAttribute('aria-expanded', 'false'); await expect(origin).toHaveValue(text); await unhidden();
    await mark('escape-settled');

    await mark('native-reopen-arrow'); await page.keyboard.press('ArrowDown');
    await expect(origin).toHaveAttribute('aria-expanded', 'true');
    await mark('native-shift-tab-to-previous'); await page.keyboard.press('Shift+Tab');
    await expect(origin).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('radio', { name: 'یک‌طرفه', exact: true })).toBeFocused(); await unhidden();
    await mark('shift-tab-previous-settled');

    await mark('native-tab-reopen'); await page.keyboard.press('Tab');
    await expect(origin).toBeFocused(); await expect(origin).toHaveAttribute('aria-expanded', 'true');
    const appearance = page.locator('button[aria-label="نمای روشن"],button[aria-label="نمای تیره"]');
    await expect(appearance).toHaveCount(1);
    await mark('native-pointer-outside'); await appearance.click();
    await expect(origin).toHaveAttribute('aria-expanded', 'false'); await expect(appearance).toBeFocused(); await unhidden();
    await mark('pointer-outside-settled');
    // Drain only the finite passive samples; no arbitrary sleep or forced focus.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    nativeActionsVerified = true;
  } finally {
    recordedTrace = await page.evaluate(() => (window as unknown as { t31CityMenuFocusTrace: { snapshot: () => FocusTrace } }).t31CityMenuFocusTrace.snapshot());
    writeFileSync(info.outputPath('native-city-menu-focus.json'), JSON.stringify({ actions, ownerFacts, checkpoint, trace: recordedTrace,
      boundary: 'Native keyboard/pointer actions and synchronous focus-event ancestry. Mutation timestamps are observer delivery; no forced focus, vendor hooks, AT speech or physical-device claim.' }, null, 2) + '\n');
    Object.assign(disposition, { rawFindingsVerified, nativeActionsVerified, checkpoint });
    saveDisposition();
  }
  // A failed body rethrows its original error after raw capture. These checks
  // run only when the axe, structural owners and native actions completed.
  const trace = recordedTrace;
  if (!trace) throw new Error('City-menu passive focus receipt missing');
    expect(trace.overflow).toBe(false);
    const focusEvents = trace.entries.filter(entry => entry.kind === 'focusin-capture');
    expect(focusEvents.length).toBeGreaterThan(0);
    expect(focusEvents.flatMap(entry => entry.state.hiddenOwners)).toEqual([]);
    expect(trace.entries.filter(entry => entry.kind.startsWith('focus-') && entry.sameActiveOwner).flatMap(entry => entry.state.hiddenOwners)).toEqual([]);
    const outsidePhases = [
      { phase: 'native-tab-to-clear', settled: 'tab-to-clear-settled', tag: 'BUTTON', type: 'button', names: ['پاک کردن مبدا'] },
      { phase: 'native-shift-tab-to-previous', settled: 'shift-tab-previous-settled', tag: 'INPUT', type: 'radio', names: ['یک‌طرفه'] },
      { phase: 'native-pointer-outside', settled: 'pointer-outside-settled', tag: 'BUTTON', type: 'button', names: ['نمای روشن', 'نمای تیره'] },
    ];
    for (const { phase, settled, tag, type, names } of outsidePhases) {
      // React Aria may also dispatch a virtual focus event while retiring its
      // active option. All such captures still passed the hidden-owner check.
      const events = focusEvents.filter(entry => entry.phase === phase && entry.trusted);
      expect(events, `Actual focus event in ${phase}`).toHaveLength(1);
      expect(events[0]!.target?.tag).toBe(tag); expect(events[0]!.target?.type).toBe(type);
      expect(names).toContain(events[0]!.target?.name);
      expect(events[0]!.state.originExpanded).toBe('false');
      const settledMarkers = trace.entries.filter(entry => entry.kind === 'phase' && entry.phase === settled);
      expect(settledMarkers, `Explicit settled boundary for ${phase}`).toHaveLength(1);
      // Observer timestamps are delivery times. Firefox may deliver these after
      // native focus even though synchronous focus capture already proves that
      // the actual attributes were cleared before that control received focus.
      expect(trace.entries.some(entry => entry.phase === phase && entry.kind === 'attribute-observer-delivery' && entry.attribute === 'aria-hidden' && entry.oldValue === 'true' && entry.valueAtDelivery === null && entry.sequence < settledMarkers[0]!.sequence), `Hiding retirement delivered during the completed action ${phase}`).toBe(true);
    }
    for (const [phase, key, shift] of [['native-tab-to-clear', 'Tab', false], ['native-shift-tab-to-input', 'Tab', true], ['native-escape', 'Escape', false], ['native-shift-tab-to-previous', 'Tab', true], ['native-tab-reopen', 'Tab', false]] as const) {
      expect(trace.entries.some(entry => entry.phase === phase && entry.kind === 'keydown-capture' && entry.key === key && entry.shiftKey === shift && entry.trusted), `Native ${key} event in ${phase}`).toBe(true);
    }
    expect(trace.entries.some(entry => entry.phase === 'native-pointer-outside' && entry.kind === 'pointerdown-capture' && entry.trusted)).toBe(true);
    expect(trace.current.hiddenOwners).toEqual([]); expect(trace.current.originExpanded).toBe('false');
    expect(rawFindingsVerified).toBe(true);
    expect(nativeActionsVerified).toBe(true);
    disposition.nativeEventTimeVerified = true; saveDisposition();
}
