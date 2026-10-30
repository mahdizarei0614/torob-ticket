import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Camera, Color, Mesh, PlaneGeometry, Scene, ShaderMaterial, Vector4, WebGLRenderTarget, type WebGLRenderer } from 'three';
import { installMapBloom, MAP_BLOOM_SCENE_KEY } from './map-bloom';
import { MAP_VEHICLE_FOREGROUND_LAYER, setMapVehicleForeground } from './map-foreground';

const effect = vi.hoisted(() => ({ initialize: null as ((renderer: WebGLRenderer) => void) | null, update: null as ((renderer: WebGLRenderer) => void) | null, updates: 0, disposed: 0 }));
vi.mock('postprocessing', async () => {
  const { Scene, Camera, Texture } = await import('three');
  return { BloomEffect: class {
    texture = new Texture();luminanceMaterial = { threshold: 0 };
    initialize(renderer: WebGLRenderer) { effect.initialize?.(renderer); }
    setSize() { /* Resource allocation is covered by the actual browser. */ }
    update(renderer: WebGLRenderer) {
      effect.updates++;effect.update?.(renderer);
      const blur = new Scene();blur.name = 'blur';renderer.render(blur, new Camera());
    }
    dispose() { effect.disposed++;this.texture.dispose(); }
  } };
});

interface Draw { phase: string; names: string[]; target: WebGLRenderTarget | null; cameraMask: number; autoClear: boolean; background: unknown; shaderHandler: unknown; physicalViewport: number[]; physicalScissor: number[]; physicalTest: boolean }
function harness() {
  const state = { target: null as WebGLRenderTarget | null, cubeFace: 0, mipmap: 0,
    viewport: new Vector4(8,9,160,140), scissor: new Vector4(12,14,140,110), scissorTest: true,
    physicalViewport: new Vector4(12,13,240,210), physicalScissor: new Vector4(18,21,210,165), physicalTest: true,
    color: new Color(.1,.2,.3), alpha: .4, failPhase: '' };
  const draws: Draw[] = [], clears: (WebGLRenderTarget | null)[] = [];
  const scene = new Scene();scene.name = 'map';scene.userData[MAP_BLOOM_SCENE_KEY] = true;scene.background = new Color(.2,.3,.4);
  const camera = new Camera();camera.layers.enable(5);
  const mesh = (name: string) => { const object = new Mesh(new PlaneGeometry(1,1), new ShaderMaterial({ depthTest: false, depthWrite: false, transparent: true }));object.name = name;scene.add(object);return object; };
  const route = mesh('route'), dots = mesh('dots'), head = mesh('head'), wagon1 = mesh('wagon1'), wagon2 = mesh('wagon2');
  setMapVehicleForeground(head, true);setMapVehicleForeground(wagon1, true, 1);setMapVehicleForeground(wagon2, true, 2);
  const canvas = document.createElement('canvas'), handler = vi.fn();
  const renderer = {
    domElement: canvas, autoClear: true, autoClearColor: true, autoClearDepth: false, autoClearStencil: true,
    xr: { enabled: true }, debug: { onShaderError: handler, checkShaderErrors: true },
    getPixelRatio: () => 1.5,
    getRenderTarget: () => state.target, getActiveCubeFace: () => state.cubeFace, getActiveMipmapLevel: () => state.mipmap,
    setRenderTarget: vi.fn((target: WebGLRenderTarget | null, face = 0, mipmap = 0) => {
      state.target = target;state.cubeFace = face;state.mipmap = mipmap;
      if (target) { state.physicalViewport.copy(target.viewport);state.physicalScissor.copy(target.scissor);state.physicalTest = target.scissorTest; }
      else { state.physicalViewport.copy(state.viewport).multiplyScalar(1.5).floor();state.physicalScissor.copy(state.scissor).multiplyScalar(1.5).floor();state.physicalTest = state.scissorTest; }
    }),
    getViewport: (value: Vector4) => value.copy(state.viewport), getCurrentViewport: (value: Vector4) => value.copy(state.physicalViewport),
    setViewport: (value: Vector4) => { state.viewport.copy(value);state.physicalViewport.copy(value).multiplyScalar(1.5).floor(); },
    getScissor: (value: Vector4) => value.copy(state.scissor), setScissor: (value: Vector4) => { state.scissor.copy(value);state.physicalScissor.copy(value).multiplyScalar(1.5).floor(); },
    getScissorTest: () => state.scissorTest, setScissorTest: (value: boolean) => { state.scissorTest = value;state.physicalTest = value; },
    getClearColor: (value: Color) => value.copy(state.color), getClearAlpha: () => state.alpha,
    setClearColor: (value: Color | number, alpha = 1) => { state.color.set(value);state.alpha = alpha; },
    clear: vi.fn(() => clears.push(state.target)),
    getContext: () => ({ SCISSOR_BOX: 0x0c10, SCISSOR_TEST: 0x0c11, getParameter: (key: number) => key === 0x0c10 ? state.physicalScissor.toArray() : state.physicalTest }),
    render: vi.fn((object: Scene, current: Camera) => {
      const members: Mesh[] = [];object.traverseVisible(child => { if ((child as Mesh).isMesh && child.layers.test(current.layers)) members.push(child as Mesh); });
      const phase = object === scene ? current.layers.isEnabled(MAP_VEHICLE_FOREGROUND_LAYER) ? 'foreground' : state.target?.texture.name === 'TorobTicket.MapBloom.Source' ? 'source' : 'base' : object.name === 'blur' ? 'blur' : 'composite';
      draws.push({ phase, names: members.sort((a,b) => a.renderOrder - b.renderOrder).map(item => item.name || 'quad'), target: state.target, cameraMask: current.layers.mask, autoClear: renderer.autoClear, background: object.background, shaderHandler: renderer.debug.onShaderError,
        physicalViewport: state.physicalViewport.toArray(), physicalScissor: state.physicalScissor.toArray(), physicalTest: state.physicalTest });
      if (phase === state.failPhase) throw new Error(phase + ' failed');
    }),
  };
  const snapshot = () => ({ target: state.target, cubeFace: state.cubeFace, mipmap: state.mipmap, viewport: state.viewport.toArray(), scissor: state.scissor.toArray(), scissorTest: state.scissorTest,
    physicalViewport: state.physicalViewport.toArray(), physicalScissor: state.physicalScissor.toArray(), physicalTest: state.physicalTest,
    color: state.color.toArray(), alpha: state.alpha, autoClear: renderer.autoClear, autoClearColor: renderer.autoClearColor, autoClearDepth: renderer.autoClearDepth, autoClearStencil: renderer.autoClearStencil,
    xr: renderer.xr.enabled, shaderHandler: renderer.debug.onShaderError, checkShaderErrors: renderer.debug.checkShaderErrors, cameraMask: camera.layers.mask, background: scene.background });
  return { renderer: renderer as unknown as WebGLRenderer, mock: renderer, scene, camera, state, draws, clears, snapshot, route, dots, head, wagon1, wagon2, handler };
}
const cleanup: (() => void)[] = [];
beforeEach(() => { effect.initialize = null;effect.update = null;effect.updates = 0;effect.disposed = 0; });
afterEach(() => { cleanup.splice(0).forEach(dispose => dispose()); });
function install(h: ReturnType<typeof harness>, allowed = true) { const failed = vi.fn(), controller = installMapBloom(h.renderer, () => allowed, failed);cleanup.push(() => controller.dispose());return { controller, failed }; }

describe('map vehicle foreground composition', () => {
  it('draws head and both wagons exactly once after base, vehicle-free bloom source and additive glow', () => {
    const h = harness(), before = h.snapshot(), { controller, failed } = install(h);
    h.renderer.render(h.scene, h.camera);
    expect(h.draws.map(draw => draw.phase)).toEqual(['base','source','blur','composite','foreground']);
    expect(h.draws[0]!.names).toEqual(['route','dots']);expect(h.draws[1]!.names).toEqual(['route','dots']);
    expect(h.draws.at(-1)!.names).toEqual(['wagon2','wagon1','head']);expect(h.draws.at(-1)).toMatchObject({ autoClear: false, background: null, shaderHandler: h.handler });
    expect(h.clears).toHaveLength(1);expect(h.clears[0]?.texture.name).toBe('TorobTicket.MapBloom.Source');
    expect(h.snapshot()).toEqual(before);expect(failed).not.toHaveBeenCalled();expect(controller.inspect().draws).toBe(1);
  });
  it.each(['unsupported','zero-strength','untagged'] as const)('keeps vehicles in the final pass when bloom is %s', reason => {
    const h = harness();if (reason === 'zero-strength') h.renderer.domElement.style.setProperty('--scene-bloom-intensity','0');if (reason === 'untagged') delete h.scene.userData[MAP_BLOOM_SCENE_KEY];
    const before = h.snapshot();install(h, reason !== 'unsupported');h.renderer.render(h.scene,h.camera);
    expect(h.draws.map(draw => draw.phase)).toEqual(['base','foreground']);expect(h.draws.at(-1)!.names).toEqual(['wagon2','wagon1','head']);
    expect(h.snapshot()).toEqual(before);expect(h.clears).toEqual([]);expect(effect.updates).toBe(0);
  });
  it('still renders foreground once after bloom fails and restores all mutable output state before the vehicle draw', () => {
    const h = harness(), before = h.snapshot(), { failed } = install(h);
    effect.update = renderer => {
      renderer.setViewport(new Vector4(99,98,40,30));renderer.setScissor(new Vector4(1,1,2,2));renderer.setScissorTest(false);
      renderer.setClearColor(0,.9);renderer.autoClearColor = false;renderer.autoClearDepth = true;renderer.autoClearStencil = false;renderer.xr.enabled = false;renderer.debug.checkShaderErrors = false;
      throw new Error('effect failed');
    };
    h.renderer.render(h.scene,h.camera);
    expect(h.draws.map(draw => draw.phase)).toEqual(['base','source','foreground']);expect(h.draws.at(-1)!.names).toEqual(['wagon2','wagon1','head']);
    expect(h.draws.at(-1)).toMatchObject({ target: null, background: null, autoClear: false, shaderHandler: h.handler, physicalViewport: before.physicalViewport, physicalScissor: before.physicalScissor, physicalTest: before.physicalTest });
    expect(h.snapshot()).toEqual(before);expect(failed).toHaveBeenCalledExactlyOnceWith('effect-unavailable');expect(effect.disposed).toBe(1);
  });
  it.each(['source','composite'] as const)('treats a %s failure as a bloom failure while leaving vehicle rendering available', phase => {
    const h = harness(), before = h.snapshot(), { failed } = install(h);h.state.failPhase = phase;
    h.renderer.render(h.scene,h.camera);expect(h.draws.at(-1)!.phase).toBe('foreground');expect(h.snapshot()).toEqual(before);expect(failed).toHaveBeenCalledExactlyOnceWith('effect-unavailable');
  });
  it.each(['base','foreground'] as const)('propagates an ordinary %s error without misclassifying it as bloom failure and restores state', phase => {
    const h = harness(), before = h.snapshot(), { failed } = install(h);h.state.failPhase = phase;
    expect(() => h.renderer.render(h.scene,h.camera)).toThrow(phase + ' failed');expect(h.snapshot()).toEqual(before);expect(failed).not.toHaveBeenCalled();
    h.state.failPhase = '';h.renderer.render(h.scene,h.camera);expect(h.draws.at(-1)!.phase).toBe('foreground');
  });
  it('preserves target face/mipmap and physical rectangles without modifying its configured rectangles', () => {
    const h = harness(), target = new WebGLRenderTarget(200,180);target.texture.name = 'external';target.viewport.set(0,0,200,180);target.scissor.set(0,0,200,180);target.scissorTest = false;
    h.state.target = target;h.state.cubeFace = 3;h.state.mipmap = 2;h.state.physicalViewport.set(10,20,80,70);h.state.physicalScissor.set(12,22,60,50);h.state.physicalTest = true;
    const before = h.snapshot();install(h);h.renderer.render(h.scene,h.camera);
    expect(h.draws.map(draw => draw.phase)).toEqual(['base','foreground']);expect(h.draws.at(-1)).toMatchObject({ target, physicalViewport: before.physicalViewport, physicalScissor: before.physicalScissor, physicalTest: before.physicalTest });expect(h.snapshot()).toEqual(before);
    expect(target.viewport.toArray()).toEqual([0,0,200,180]);expect(target.scissor.toArray()).toEqual([0,0,200,180]);expect(target.scissorTest).toBe(false);expect(effect.updates).toBe(0);target.dispose();
  });
  it('does not revive invisible wagons or force a deliberately masked-out vehicle into view', () => {
    const h = harness();h.wagon2.visible = false;install(h,false);h.renderer.render(h.scene,h.camera);expect(h.draws.at(-1)!.names).toEqual(['wagon1','head']);
    h.draws.length = 0;h.camera.layers.set(5);h.renderer.render(h.scene,h.camera);expect(h.draws.map(draw => draw.phase)).toEqual(['base']);expect(h.draws[0]!.names).toEqual([]);
  });
  it('leaves ordinary scenes untouched and restores the original render method on disposal', () => {
    const h = harness();delete h.scene.userData[MAP_BLOOM_SCENE_KEY];[h.head,h.wagon1,h.wagon2].forEach((object,index) => setMapVehicleForeground(object,false,index));
    const original = h.renderer.render, before = h.snapshot(), { controller } = install(h);h.renderer.render(h.scene,h.camera);
    expect(h.draws.map(draw => draw.phase)).toEqual(['base']);expect(h.draws[0]!.names).toEqual(['route','dots','wagon2','wagon1','head']);expect(h.snapshot()).toEqual(before);
    controller.dispose();expect(h.renderer.render).toBe(original);
  });
});
