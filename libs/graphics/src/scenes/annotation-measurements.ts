import { useLayoutEffect, useState, type RefObject } from 'react';

export interface AnnotationSize { width: number; height: number }
/** Measure the whole final label once per content/font/size change, never on the
 * decorative animation clock. Hidden probes have the same CSS as live facts. */
export function useAnnotationMeasurements(root: RefObject<HTMLElement | null>, identity: string): ReadonlyMap<string, AnnotationSize> {
  const [sizes, setSizes] = useState<ReadonlyMap<string, AnnotationSize>>(() => new Map());
  useLayoutEffect(() => {
    let live = true;
    const elements = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-annotation-measure]') ?? []);
    const measure = () => {
      if (!live) return;
      const next = new Map<string, AnnotationSize>();
      for (const element of elements) {
        const box = element.getBoundingClientRect(), id = element.dataset['annotationMeasure'];
        if (id && box.width > 0 && box.height > 0) next.set(id, { width: Math.ceil(box.width), height: Math.ceil(box.height) });
      }
      setSizes(previous => previous.size === next.size && [...next].every(([id, value]) => previous.get(id)?.width === value.width && previous.get(id)?.height === value.height) ? previous : next);
    };
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    elements.forEach(element => observer?.observe(element));
    measure();
    void document.fonts?.ready.then(measure);
    return () => { live = false; observer?.disconnect(); };
  }, [root, identity]);
  return sizes;
}
