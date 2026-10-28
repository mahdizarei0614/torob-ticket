import { expect, it, vi } from 'vitest';
import { createGpuFrameTimer } from './gpu-frame-timer';
function fixture() {
  let query = 0; let nested = false, disjoint = false, available = false;
  const gl = { QUERY_RESULT_AVAILABLE: 3, QUERY_RESULT: 4, CURRENT_QUERY: 5,
    getExtension: () => ({ TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 }), isContextLost: () => false,
    getParameter: () => disjoint, getQuery: () => nested ? {} : null,
    createQuery: () => ({ id: ++query }), beginQuery: vi.fn(), endQuery: vi.fn(), deleteQuery: vi.fn(),
    getQueryParameter: vi.fn((_query, kind) => kind === 3 ? available : 2500000),
  } as unknown as WebGL2RenderingContext;
  return { gl, timer: createGpuFrameTimer(gl), availability: (value: boolean) => { available = value; }, nested: (value: boolean) => { nested = value; }, disjoint: (value: boolean) => { disjoint = value; } };
}
it('reads only available non-disjoint GPU results and reports milliseconds without waiting', () => {
  const f = fixture(); for (let i = 0; i < 12; i++) { f.timer.begin(); f.timer.end(); }
  expect(f.timer.poll()).toEqual([]); expect(f.gl.getQueryParameter).toHaveBeenCalledTimes(1);
  f.availability(true); expect(f.timer.poll()).toEqual([2.5]); expect(f.gl.deleteQuery).toHaveBeenCalledOnce();
  f.timer.dispose(); expect(f.gl.deleteQuery).toHaveBeenCalledOnce();
});
it('skips another owner query, bounds pending queries and discards disjoint timings', () => {
  const f = fixture(); f.nested(true); for (let i = 0; i < 24; i++) { f.timer.begin(); f.timer.end(); } expect(f.gl.beginQuery).not.toHaveBeenCalled();
  f.nested(false); for (let i = 0; i < 120; i++) { f.timer.begin(); f.timer.end(); } expect(f.gl.beginQuery).toHaveBeenCalledTimes(6);
  f.disjoint(true); expect(f.timer.poll()).toEqual([]); expect(f.gl.deleteQuery).toHaveBeenCalledTimes(6);
  f.timer.dispose(); f.timer.begin(); expect(f.gl.beginQuery).toHaveBeenCalledTimes(6);
});
