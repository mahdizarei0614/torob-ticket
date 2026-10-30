import { BloomEffect } from 'postprocessing';
import { Camera, Color, CustomBlending, HalfFloatType, Mesh, OneFactor, OneMinusSrcAlphaFactor, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector4, WebGLRenderTarget, type Object3D, type WebGLRenderer } from 'three';
import { bloomTargetSize } from './bloom-policy';
import { createMapEdgeFadeUniforms, updateMapEdgeFadeUniforms } from './scenes/map-edge-fade';
import edgeFade from './shaders/map-edge-fade.glsl?raw';
import { hasMapVehicleForeground, MAP_VEHICLE_FOREGROUND_LAYER, MAP_VEHICLE_FOREGROUND_MASK } from './map-foreground';

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
    if (nested || disposed) return original.call(renderer, scene, camera);
    const foreground = hasMapVehicleForeground(scene);
    const glowing = Boolean(scene.userData[MAP_BLOOM_SCENE_KEY] && allowed() && strength > 0);
    if (!foreground && !glowing) return original.call(renderer, scene, camera);
    const target = renderer.getRenderTarget();
    const cubeFace = renderer.getActiveCubeFace(), mipmap = renderer.getActiveMipmapLevel();
    const viewport = renderer.getViewport(new Vector4()), scissor = renderer.getScissor(new Vector4());
    const scissorTest = renderer.getScissorTest(), autoClear = renderer.autoClear;
    const autoClearColor = renderer.autoClearColor, autoClearDepth = renderer.autoClearDepth, autoClearStencil = renderer.autoClearStencil;
    const clearColor = renderer.getClearColor(new Color()).clone(), clearAlpha = renderer.getClearAlpha();
    const shaderError = renderer.debug.onShaderError, checkShaderErrors = renderer.debug.checkShaderErrors;
    const xr = renderer.xr.enabled, layerMask = camera.layers.mask;
    const mapScene = (scene as Scene).isScene ? scene as Scene : undefined, background = mapScene?.background ?? null;
    const physicalViewport = target ? renderer.getCurrentViewport(new Vector4()) : undefined;
    const raw = target ? renderer.getContext() : undefined;
    const physicalScissor = raw ? new Vector4().fromArray(raw.getParameter(raw.SCISSOR_BOX)) : undefined;
    const physicalScissorTest = raw ? Boolean(raw.getParameter(raw.SCISSOR_TEST)) : false;
    const restoreOutput = () => {
      if (target) {
        // A bound target can have a physical rectangle different from both its
        // configured rectangle and the canvas's logical viewport. Preserve all.
        const configuredViewport = target.viewport.clone(), configuredScissor = target.scissor.clone(), configuredTest = target.scissorTest;
        try {
          target.viewport.copy(physicalViewport!);target.scissor.copy(physicalScissor!);target.scissorTest = physicalScissorTest;
          renderer.setRenderTarget(target, cubeFace, mipmap);
        } finally { target.viewport.copy(configuredViewport);target.scissor.copy(configuredScissor);target.scissorTest = configuredTest; }
      } else {
        renderer.setRenderTarget(target, cubeFace, mipmap);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);
      }
      renderer.debug.onShaderError = shaderError;renderer.debug.checkShaderErrors = checkShaderErrors;
      renderer.setClearColor(clearColor, clearAlpha);renderer.xr.enabled = xr;
      renderer.autoClearColor = autoClearColor;renderer.autoClearDepth = autoClearDepth;renderer.autoClearStencil = autoClearStencil;
    };
    let baseDrawn = false;
    nested = true;
    try {
      // Draw vehicles only once, after the base and any additive bloom. Their
      // glass alpha must not be doubled or emitted into the bloom source.
      if (foreground) camera.layers.mask = layerMask & ~MAP_VEHICLE_FOREGROUND_MASK;
      original.call(renderer, scene, camera);
      baseDrawn = true;
      if (glowing && !target) {
        try {
          renderer.debug.onShaderError = () => { throw new Error('Map bloom shader unavailable'); };
          renderer.xr.enabled = false;
          ensure(viewport.z, viewport.w);
          renderer.setRenderTarget(source!);renderer.setScissorTest(false);
          renderer.setClearColor(0, 0);renderer.autoClear = false;renderer.clear(true, true, true);
          original.call(renderer, scene, camera);
          bloom!.update(renderer, source!, 0);
          restoreOutput();renderer.autoClear = false;renderer.xr.enabled = false;
          renderer.debug.onShaderError = () => { throw new Error('Map bloom shader unavailable'); };
          original.call(renderer, copyScene, copyCamera);draws++;
        } catch {
          release();failed('effect-unavailable');
        }
      }
    } finally {
      try {
        restoreOutput();
        if (baseDrawn && foreground && (layerMask & (1 | MAP_VEHICLE_FOREGROUND_MASK))) {
          camera.layers.set(MAP_VEHICLE_FOREGROUND_LAYER);renderer.autoClear = false;
          // Three can redraw a Scene.background even when autoClear is false.
          if (mapScene) mapScene.background = null;
          original.call(renderer, scene, camera);
        }
      } finally {
        if (mapScene) mapScene.background = background;
        camera.layers.mask = layerMask;
        try { restoreOutput(); } finally { renderer.autoClear = autoClear;nested = false; }
      }
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
