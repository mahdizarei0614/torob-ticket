import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, ShaderMaterial, Vector2, Vector4 } from 'three';
import { priceBand, priceChartGeometry, priceChartPresentation, priceChartX, type PriceRange } from '@torob-ticket/ui';
import type { DatePriceCell } from '@torob-ticket/contracts';
import { useThemeUniforms } from '../theme-uniforms';
import { createPriceChartEmphasis, priceChartRibbon } from './price-chart-drawing';
import fragmentShader from '../shaders/price-chart.frag.glsl?raw';
import vertexShader from '../shaders/price-chart.vert.glsl?raw';
interface Resources { line: BufferGeometry; dots: BufferGeometry; grid: BufferGeometry; guide: BufferGeometry; materials: ShaderMaterial[]; emphasis: ReturnType<typeof createPriceChartEmphasis> }
/** The shared host owns rendering. DOM owns exact date inspection and selection. */
export function PriceChartScene({ cells, selected, hovered, range, motionEnabled = false }: { cells: readonly DatePriceCell[]; selected: string; hovered?: string; range?: PriceRange; motionEnabled?: boolean }) {
  const invalidate = useThree(state => state.invalidate);
  const uniforms = useThemeUniforms(invalidate);
  const geometry = useMemo(() => priceChartGeometry(cells, range), [cells, range]);
  const [resources, setResources] = useState<Resources | null>(null);
  useEffect(() => {
    const buffer = (values: number[], directions?: number[], sides?: number[]) => {
      const next = new BufferGeometry(), count = values.length / 3;
      next.setAttribute('position', new Float32BufferAttribute(values, 3));
      next.setAttribute('strokeDirection', new Float32BufferAttribute(directions ?? Array(count * 2).fill(0), 2));
      next.setAttribute('strokeSide', new Float32BufferAttribute(sides ?? Array(count).fill(0), 1));
      next.setAttribute('emphasis', new Float32BufferAttribute(Array(count).fill(0), 1));
      next.setAttribute('pointBand', new Float32BufferAttribute(Array(count).fill(1), 1));
      return next;
    };
    const line = priceChartRibbon(geometry.paths), grid = priceChartRibbon([-.65, 0, .65].map(y => [{ x: -.9, y }, { x: .9, y }])), guide = priceChartRibbon([[{ x: 0, y: -.82 }, { x: 0, y: .82 }]]);
    const dots = buffer(geometry.points.flatMap(point => [point.x, point.y, 0]));
    dots.setAttribute('pointBand', new Float32BufferAttribute(geometry.points.map(point => { const band = priceBand(point.amountRial, geometry); return band === 'low' ? 0 : band === 'high' ? 2 : 1; }), 1));
    const viewport = new Vector4();
    const materialFor = (kind: number) => {
      const material = new ShaderMaterial({ uniforms: { ...uniforms, kind: { value: kind }, selectedX: { value: -2 }, viewport: { value: new Vector2(1, 1) }, pixelRatio: { value: 1 }, lineWidth: { value: kind >= 2 ? 1 : priceChartPresentation.lineWidth }, markerRadius: { value: priceChartPresentation.markerRadius }, selectedRadius: { value: priceChartPresentation.selectedRadius }, hoverGrowth: { value: priceChartPresentation.hoverGrowth }, ringWidth: { value: priceChartPresentation.ringWidth }, selectionRingWidth: { value: priceChartPresentation.selectionRingWidth } }, vertexShader, fragmentShader, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
      material.onBeforeRender = renderer => {
        // Drei's portal size can retain its previous DOM rect after responsive reflow.
        // The view has already set this renderer viewport in CSS pixels before drawing.
        renderer.getViewport(viewport);
        material.uniforms['viewport']!.value.set(Math.max(1, viewport.z), Math.max(1, viewport.w));
        material.uniforms['pixelRatio']!.value = renderer.getPixelRatio();
        material.uniformsNeedUpdate = true;
      };
      return material;
    };
    const next: Resources = {
      line: buffer(line.positions, line.directions, line.sides), dots, grid: buffer(grid.positions, grid.directions, grid.sides), guide: buffer(guide.positions, guide.directions, guide.sides),
      materials: [0, 1, 2, 3].map(materialFor),
      emphasis: createPriceChartEmphasis(geometry.points.length, (index, value) => { const attribute = dots.getAttribute('emphasis'); attribute.setX(index, value); attribute.needsUpdate = true; invalidate(); }),
    };
    setResources(next); invalidate();
    return () => { next.emphasis.dispose(); next.line.dispose(); next.dots.dispose(); next.grid.dispose(); next.guide.dispose(); next.materials.forEach(material => material.dispose()); };
  }, [geometry, uniforms, invalidate]);
  useLayoutEffect(() => {
    if (!resources) return;
    const selectedIndex = cells.findIndex(cell => cell.date === selected), x = selectedIndex < 0 ? -2 : priceChartX(cells, selectedIndex);
    resources.materials.forEach(material => {
      material.uniforms['selectedX']!.value = x;
    });
    const guide = resources.guide.getAttribute('position');
    for (let index = 0; index < guide.count; index++) guide.setX(index, x);
    guide.needsUpdate = true;
    geometry.points.forEach((point, index) => resources.emphasis.target(index, point.date === hovered ? 1 : 0, motionEnabled));
    invalidate();
  }, [resources, geometry, cells, selected, hovered, motionEnabled, invalidate]);
  if (!resources) return null;
  return <group dispose={null}><mesh geometry={resources.grid} material={resources.materials[2]} renderOrder={0} frustumCulled={false} /><mesh geometry={resources.guide} material={resources.materials[3]} renderOrder={1} frustumCulled={false} /><mesh geometry={resources.line} material={resources.materials[0]} renderOrder={2} frustumCulled={false} /><points geometry={resources.dots} material={resources.materials[1]} renderOrder={3} frustumCulled={false} /></group>;
}
