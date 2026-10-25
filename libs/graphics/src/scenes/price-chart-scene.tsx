import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, ShaderMaterial } from 'three';
import { priceChartGeometry } from '@torob-ticket/ui';
import type { DatePriceCell } from '@torob-ticket/contracts';
import { useThemeUniforms } from '../theme-uniforms';
import fragmentShader from '../shaders/price-chart.frag.glsl?raw';
const vertexShader = `varying float vX; uniform float pointSize; uniform float selectedX; void main() { vX = position.x; gl_Position = vec4(position.xy, 0., 1.); gl_PointSize = abs(position.x - selectedX) < 0.005 ? pointSize * 1.7 : pointSize; }`;
interface Resources { line: BufferGeometry; dots: BufferGeometry; grid: BufferGeometry; materials: ShaderMaterial[] }
/** Flat clip-space chart; shared host owns the only context. DOM owns every interaction. */
export function PriceChartScene({ cells, selected }: { cells: readonly DatePriceCell[]; selected: string }) {
  const invalidate = useThree(state => state.invalidate);
  const uniforms = useThemeUniforms(invalidate);
  const [resources, setResources] = useState<Resources | null>(null);
  useEffect(() => {
    const geometry = priceChartGeometry(cells);
    const buffer = (values: number[]) => { const next = new BufferGeometry(); next.setAttribute('position', new Float32BufferAttribute(values, 3)); return next; };
    const next: Resources = { line: buffer(geometry.edges), dots: buffer(geometry.points.flatMap(point => [point.x, point.y, 0])), grid: buffer([-.9,-.65,0,.9,-.65,0,-.9,0,0,.9,0,0,-.9,.65,0,.9,.65,0]), materials: [0,1,2].map(kind => new ShaderMaterial({ uniforms: { ...uniforms, kind: { value: kind }, selectedX: { value: geometry.points.find(point => point.date === selected)?.x ?? -2 }, pointSize: { value: 6 } }, vertexShader, fragmentShader, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })) };
    setResources(next); invalidate();
    return () => { next.line.dispose(); next.dots.dispose(); next.grid.dispose(); next.materials.forEach(material => material.dispose()); };
  }, [cells, uniforms, invalidate]);
  useEffect(() => { if (!resources) return; const x = priceChartGeometry(cells).points.find(point => point.date === selected)?.x ?? -2; resources.materials.forEach(material => { material.uniforms['selectedX']!.value = x; }); invalidate(); }, [selected, cells, resources, invalidate]);
  if (!resources) return null;
  return <group dispose={null}><lineSegments geometry={resources.grid} material={resources.materials[2]} frustumCulled={false} /><lineSegments geometry={resources.line} material={resources.materials[0]} frustumCulled={false} /><points geometry={resources.dots} material={resources.materials[1]} frustumCulled={false} /></group>;
}
