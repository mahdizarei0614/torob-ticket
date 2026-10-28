import { priceChartPresentation } from '@torob-ticket/ui';
import { animate } from 'motion';
export { priceChartRibbon } from './price-chart-ribbon';
type FiniteTween = (from: number, to: number, update: (value: number) => void) => { stop: () => void };
const tween: FiniteTween = (from, to, update) => animate(from, to, { duration: priceChartPresentation.motionMs / 1000, ease: [.2, .7, .2, 1], onUpdate: update });
/** Reuses Motion's finite ticker. Updates invalidate the on-demand host outside its frame callback. */
export function createPriceChartEmphasis(count: number, update: (index: number, value: number) => void, animateValue: FiniteTween = tween) {
  const values = Array<number>(count).fill(0), targets = Array<number>(count).fill(0), revisions = Array<number>(count).fill(0), controls: ({ stop: () => void } | undefined)[] = [];
  let retired = false;
  return {
    target(index: number, target: number, moving: boolean) {
      if (retired || index < 0 || index >= count || moving && targets[index] === target) return;
      targets[index] = target; revisions[index]!++; const revision = revisions[index]; controls[index]?.stop(); controls[index] = undefined;
      if (!moving || values[index] === target) { values[index] = target; update(index, target); return; }
      controls[index] = animateValue(values[index]!, target, value => { if (!retired && revisions[index] === revision) { values[index] = value; update(index, value); } });
    },
    dispose() { retired = true; controls.forEach(control => control?.stop()); },
  };
}
