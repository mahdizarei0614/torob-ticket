import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera, PlaneGeometry, ShaderMaterial } from 'three';
import { useThemeUniforms } from './theme-uniforms';
import { useGraphics } from './graphics-provider';
import fragmentShader from './shaders/shared.glsl?raw';
const vertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
interface Resources { geometry: PlaneGeometry; material: ShaderMaterial; lastFrame?: number }
/** The lab owns one resource pair, shared by its views. Generic hosts do not allocate scene materials. */
export function useLabResources(broken: boolean) {
  const uniforms = useThemeUniforms();
  const { invalidate } = useGraphics();
  const [resources, setResources] = useState<Resources | null>(null);
  useEffect(() => {
    const next = { geometry: new PlaneGeometry(4, 4), material: new ShaderMaterial({
      uniforms: { ...uniforms, progress: { value: 0.7 } }, vertexShader,
      fragmentShader: broken ? `${fragmentShader}\nINTENTIONAL_LAB_SHADER_ERROR` : fragmentShader,
      depthTest: false, depthWrite: false, transparent: true, toneMapped: false,
    }) };
    setResources(next);
    invalidate();
    return () => { next.geometry.dispose(); next.material.dispose(); };
  }, [uniforms, broken, invalidate]);
  return resources;
}
function LabCamera({ x }: { x: number }) {
  const get = useThree(state => state.get);
  const set = useThree(state => state.set);
  const [camera] = useState(() => Object.assign(new OrthographicCamera(-1, 1, 1, -1, 0.1, 100), { manual: true }));
  useLayoutEffect(() => { camera.position.set(x, 0, 10); camera.updateMatrixWorld(); }, [camera, x]);
  useLayoutEffect(() => {
    const previous = get().camera;
    set({ camera });
    return () => set({ camera: previous });
  }, [camera, get, set]);
  return null;
}
export function LabScene({ resources, cameraX, moving }: { resources: Resources; cameraX: number; moving: boolean }) {
  useFrame((state, delta) => {
    if (resources.lastFrame === state.clock.elapsedTime) return;
    resources.lastFrame = state.clock.elapsedTime;
    if (moving && !matchMedia('(prefers-reduced-motion: reduce)').matches) resources.material.uniforms['progress']!.value = (resources.material.uniforms['progress']!.value + Math.min(delta, 0.05) * 0.04) % 1;
  });
  return <>
    <LabCamera x={cameraX} />
    <mesh geometry={resources.geometry} material={resources.material} dispose={null} />
  </>;
}
export function useLabScene(resources: Resources | null, cameraX: number, moving: boolean) {
  return useMemo(() => resources ? <LabScene resources={resources} cameraX={cameraX} moving={moving} /> : null, [resources, cameraX, moving]);
}
