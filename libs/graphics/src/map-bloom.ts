import { BloomEffect } from 'postprocessing';
import { Camera, Color, CustomBlending, HalfFloatType, Mesh, OneFactor, OneMinusSrcAlphaFactor, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector4, WebGLRenderTarget, type Object3D, type WebGLRenderer } from 'three';
import { bloomTargetSize } from './bloom-policy';
import { createMapEdgeFadeUniforms, updateMapEdgeFadeUniforms } from './scenes/map-edge-fade';
import edgeFade from './shaders/map-edge-fade.glsl?raw';

export const MAP_BLOOM_SCENE_KEY = 'torobTicketMapBloom';
/** Postprocess only a tagged Drei virtual scene. Neither canvas size nor sibling views change. */
export function installMapBloom(renderer: WebGLRenderer, allowed: () => boolean, failed: (reason: string) => void) {
  const original = renderer.render;
  let nested = false, disposed = false, draws = 0;
  let source: WebGLRenderTarget | undefined, bloom: BloomEffect | undefined, quad: Mesh<PlaneGeometry, ShaderMaterial> | undefined;
  const copyScene = new Scene(), copyCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const feather = createMapEdgeFadeUniforms();
  let strength = .22, threshold = .025;
  const refreshStyle = () => {
    const style = getComputedStyle(renderer.domElement);
    const number = (key: string, fallback: number) => { const value = Number.parseFloat(style.getPropertyValue(key)); return Number.isFinite(value) ? value : fallback; };
    strength = Math.max(0, Math.min(.5, number('--scene-bloom-intensity', .22)));
    threshold = Math.max(0, number('--scene-bloom-threshold', .025));
    if (bloom) bloom.luminanceMaterial.threshold = threshold;
  };
  const release = () => {
    source?.dispose(); bloom?.dispose();
    if (quad) { copyScene.remove(quad); quad.geometry.dispose(); quad.material.dispose(); }
    source = undefined; bloom = undefined; quad = undefined;
  };
  const ensure = (width: number, height: number) => {
    const size = bloomTargetSize(width, height, renderer.getPixelRatio());
    if (!source) {
      source = new WebGLRenderTarget(size.width, size.height, { type: HalfFloatType, depthBuffer: false, stencilBuffer: false });
      source.texture.name = 'TorobTicket.MapBloom.Source';
      bloom = new BloomEffect({ mipmapBlur: true, levels: 4, radius: .4, luminanceThreshold: threshold, luminanceSmoothing: .04 });
      bloom.initialize(renderer, true, HalfFloatType);
      const material = new ShaderMaterial({
        uniforms: { ...feather, glow: { value: bloom.texture }, strength: { value: strength } },
        vertexShader: 'varying vec2 vMapUv; void main(){vMapUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader: `${edgeFade}\nuniform sampler2D glow; uniform float strength;
          void main(){
            gl_FragColor=vec4(texture2D(glow,vMapUv).rgb,1.);
            #include <colorspace_fragment>
            gl_FragColor.rgb*=strength*mapEdgeOpacity();
            gl_FragColor.a=clamp(max(max(gl_FragColor.r,gl_FragColor.g),gl_FragColor.b),0.,1.);
          }`,
        transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
        blending: CustomBlending, blendSrc: OneFactor, blendDst: OneFactor,
        blendSrcAlpha: OneFactor, blendDstAlpha: OneMinusSrcAlphaFactor,
      });
      quad = new Mesh(new PlaneGeometry(2, 2), material); quad.frustumCulled = false; copyScene.add(quad);
      bloom.setSize(size.width, size.height);
    } else if (source.width !== size.width || source.height !== size.height) {
      source.setSize(size.width, size.height); bloom!.setSize(size.width, size.height);
    }
    quad!.material.uniforms['strength']!.value = strength;
    updateMapEdgeFadeUniforms(feather, { width, height }, true);
  };
  const wrapped = function (scene: Object3D, camera: Camera) {
    // The normal map draw is unchanged. Bloom adds emitted light, avoiding a second
    // color conversion/base-alpha composite for the map and leaving charts untouched.
    original.call(renderer, scene, camera);
    if (nested || disposed || !scene.userData[MAP_BLOOM_SCENE_KEY] || !allowed() || strength <= 0) return;
    const target = renderer.getRenderTarget();
    if (target) return;
    const viewport = renderer.getViewport(new Vector4()), scissor = renderer.getScissor(new Vector4());
    const scissorTest = renderer.getScissorTest(), autoClear = renderer.autoClear;
    const clearColor = renderer.getClearColor(new Color()).clone(), clearAlpha = renderer.getClearAlpha();
    const shaderError = renderer.debug.onShaderError;
    nested = true;
    try {
      renderer.debug.onShaderError = () => { throw new Error('Map bloom shader unavailable'); };
      ensure(viewport.z, viewport.w);
      renderer.setRenderTarget(source!); renderer.setScissorTest(false);
      renderer.setClearColor(0, 0); renderer.autoClear = false; renderer.clear(true, true, true);
      original.call(renderer, scene, camera);
      bloom!.update(renderer, source!, 0);
      renderer.setRenderTarget(target); renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(scissorTest);
      renderer.autoClear = false;
      original.call(renderer, copyScene, copyCamera); draws++;
    } catch {
      release(); failed('effect-unavailable');
    } finally {
      renderer.debug.onShaderError = shaderError;
      renderer.setRenderTarget(target); renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(scissorTest);
      renderer.setClearColor(clearColor, clearAlpha); renderer.autoClear = autoClear; nested = false;
    }
  };
  renderer.render = wrapped; refreshStyle();
  return {
    refreshStyle,
    release,
    inspect: () => ({ draws, width: source?.width ?? 0, height: source?.height ?? 0, strength }),
    dispose() { disposed = true; if (renderer.render === wrapped) renderer.render = original; release(); },
  };
}
