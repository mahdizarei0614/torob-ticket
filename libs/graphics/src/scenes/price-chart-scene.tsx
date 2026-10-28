import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, ShaderMaterial, Vector2, Vector4 } from 'three';
import { priceBand, priceChartPointOpacity, priceChartPresentation, priceChartX, usePriceChartLifecycle, type PriceChartFrame, type PriceChartLifecycle, type PriceRange } from '@torob-ticket/ui';
import type { DatePriceCell } from '@torob-ticket/contracts';
import { useThemeUniforms } from '../theme-uniforms';
import { createPriceChartEmphasis, priceChartRibbon } from './price-chart-drawing';
import fragmentShader from '../shaders/price-chart.frag.glsl?raw';
import vertexShader from '../shaders/price-chart.vert.glsl?raw';
interface Resources { line: BufferGeometry; dots: BufferGeometry; grid: BufferGeometry; guide: BufferGeometry; materials: ShaderMaterial[]; emphasis: ReturnType<typeof createPriceChartEmphasis>; dates: string[]; weights: Map<string, number> }
function attribute(geometry: BufferGeometry, name: string, values: readonly number[], size: number) {
  const current = geometry.getAttribute(name);
  if (!current || current.array.length !== values.length) geometry.setAttribute(name, new Float32BufferAttribute(values, size));
  else { (current.array as Float32Array).set(values); current.needsUpdate = true; }
}
function writeGeometry(geometry: BufferGeometry, positions: readonly number[], directions?: readonly number[], sides?: readonly number[]) {
  const count = positions.length / 3;
  // Release old native buffers before a topology change; the same geometry object is then reused.
  if (geometry.getAttribute('position')?.count !== count) geometry.dispose();
  attribute(geometry, 'position', positions, 3);
  attribute(geometry, 'strokeDirection', directions ?? Array(count * 2).fill(0), 2);
  attribute(geometry, 'strokeSide', sides ?? Array(count).fill(0), 1);
  attribute(geometry, 'emphasis', Array(count).fill(0), 1);
  attribute(geometry, 'pointBand', Array(count).fill(1), 1);
  attribute(geometry, 'selectedMarker', Array(count).fill(0), 1);
  attribute(geometry, 'visualOpacity', Array(count).fill(1), 1);
}
/** The shared host owns rendering. DOM owns exact date inspection and selection. */
export function PriceChartScene({ cells, selected, hovered, range, motionEnabled = false, lifecycle, onReadyChange }: { cells: readonly DatePriceCell[]; selected: string; hovered?: string; range?: PriceRange; motionEnabled?: boolean; lifecycle?: PriceChartLifecycle; onReadyChange?: (ready: boolean) => void }) {
  const invalidate = useThree(state => state.invalidate);
  const uniforms = useThemeUniforms(invalidate);
  const controller = usePriceChartLifecycle(cells, range, motionEnabled, selected, lifecycle);
  const latest = useRef({ cells, selected, hovered, motionEnabled, onReadyChange }); latest.current = { cells, selected, hovered, motionEnabled, onReadyChange };
  const [resources, setResources] = useState<Resources | null>(null);
  useEffect(() => {
    const buffer = (values: number[], directions?: number[], sides?: number[]) => { const next = new BufferGeometry(); writeGeometry(next, values, directions, sides); return next; };
    const grid = priceChartRibbon([-.65, 0, .65].map(y => [{ x: -.9, y }, { x: .9, y }])), guide = priceChartRibbon([[{ x: 0, y: -.82 }, { x: 0, y: .82 }]]);
    const dots = buffer([]);
    const viewport = new Vector4();
    let announced = false;
    const materialFor = (kind: number) => {
      const material = new ShaderMaterial({ uniforms: { ...uniforms, kind: { value: kind }, selectedX: { value: -2 }, viewport: { value: new Vector2(1, 1) }, pixelRatio: { value: 1 }, lineWidth: { value: kind >= 2 ? 1 : priceChartPresentation.lineWidth }, markerRadius: { value: priceChartPresentation.markerRadius }, selectedRadius: { value: priceChartPresentation.selectedRadius }, hoverGrowth: { value: priceChartPresentation.hoverGrowth }, ringWidth: { value: priceChartPresentation.ringWidth }, selectionRingWidth: { value: priceChartPresentation.selectionRingWidth }, reveal: { value: 0 }, revealStart: { value: -.9 }, revealEnd: { value: .9 }, curveOpacity: { value: 0 } }, vertexShader, fragmentShader, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
      material.onBeforeRender = renderer => {
        // Drei's portal size can retain its previous DOM rect after responsive reflow.
        // The view has already set this renderer viewport in CSS pixels before drawing.
        renderer.getViewport(viewport);
        material.uniforms['viewport']!.value.set(Math.max(1, viewport.z), Math.max(1, viewport.w));
        material.uniforms['pixelRatio']!.value = renderer.getPixelRatio();
        material.uniformsNeedUpdate = true;
        if (!announced) { announced = true; latest.current.onReadyChange?.(true); }
      };
      return material;
    };
    const next: Resources = {
      line: buffer([]), dots, grid: buffer(grid.positions, grid.directions, grid.sides), guide: buffer(guide.positions, guide.directions, guide.sides), dates: [], weights: new Map(),
      materials: [0, 1, 2, 3].map(materialFor),
      emphasis: createPriceChartEmphasis(0, () => {}),
    };
    setResources(next); invalidate();
    return () => { latest.current.onReadyChange?.(false); next.emphasis.dispose(); next.line.dispose(); next.dots.dispose(); next.grid.dispose(); next.guide.dispose(); next.materials.forEach(material => material.dispose()); };
  }, [uniforms, invalidate]);
  useLayoutEffect(() => {
    if (!resources) return;
    const update = (frame: PriceChartFrame) => {
      const props = latest.current, exiting = frame.phase === 'exiting', line = priceChartRibbon(frame.paths, frame.edgeOpacity);
      writeGeometry(resources.line, line.positions, line.directions, line.sides);
      attribute(resources.line, 'visualOpacity', line.opacities, 1);
      writeGeometry(resources.dots, frame.points.flatMap(point => [point.x, point.y, 0]));
      const dates = frame.points.map(point => point.date);
      if (JSON.stringify(dates) !== JSON.stringify(resources.dates)) {
        resources.emphasis.dispose(); resources.dates = dates;
        const weights = dates.map(date => resources.weights.get(date) ?? 0); resources.weights = new Map(dates.map((date, index) => [date, weights[index]!]));
        resources.emphasis = createPriceChartEmphasis(dates.length, (index, value) => { const field = resources.dots.getAttribute('emphasis'); field.setX(index, value); field.needsUpdate = true; resources.weights.set(resources.dates[index]!, value); invalidate(); }, undefined, weights);
      }
      attribute(resources.dots, 'pointBand', frame.points.map(point => { const band = priceBand(point.amountRial, frame); return band === 'low' ? 0 : band === 'high' ? 2 : 1; }), 1);
      attribute(resources.dots, 'selectedMarker', frame.points.map(point => !exiting && point.date === props.selected ? 1 : 0), 1);
      attribute(resources.dots, 'visualOpacity', frame.points.map(point => priceChartPointOpacity(frame, point)), 1);
      attribute(resources.dots, 'emphasis', dates.map(date => resources.weights.get(date) ?? 0), 1);
      const selectedIndex = props.cells.findIndex(cell => cell.date === props.selected), selectedPoint = !exiting && props.cells[selectedIndex]?.status === 'priced' ? frame.points.find(point => point.date === props.selected) : undefined;
      const x = selectedPoint?.x ?? (selectedIndex < 0 ? -2 : priceChartX(props.cells, selectedIndex));
      resources.materials.forEach((material, kind) => {
        material.uniforms['selectedX']!.value = x; material.uniforms['reveal']!.value = frame.reveal;
        material.uniforms['revealStart']!.value = frame.startX; material.uniforms['revealEnd']!.value = frame.endX;
        material.uniforms['curveOpacity']!.value = kind === 1 || kind >= 2 ? 1 : frame.opacity;
      });
      const guide = resources.guide.getAttribute('position'); for (let index = 0; index < guide.count; index++) guide.setX(index, x); guide.needsUpdate = true;
      frame.points.forEach((point, index) => resources.emphasis.target(index, !exiting && point.date === props.hovered ? 1 : 0, props.motionEnabled));
      invalidate();
    };
    update(controller.getSnapshot()); return controller.subscribe(() => update(controller.getSnapshot()));
  }, [resources, controller, cells, selected, hovered, motionEnabled, invalidate]);
  if (!resources) return null;
  return <group dispose={null}><mesh geometry={resources.grid} material={resources.materials[2]} renderOrder={0} frustumCulled={false} /><mesh geometry={resources.guide} material={resources.materials[3]} renderOrder={1} frustumCulled={false} /><mesh geometry={resources.line} material={resources.materials[0]} renderOrder={2} frustumCulled={false} /><points geometry={resources.dots} material={resources.materials[1]} renderOrder={3} frustumCulled={false} /></group>;
}
