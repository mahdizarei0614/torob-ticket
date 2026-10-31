import { expect, it, vi } from 'vitest';
import { createGpuFrameTimer } from './gpu-frame-timer';
function fixture() {
  let query = 0; let nested = false, disjoint = false, available = false;
  const gl = { QUERY_RESULT_AVAILABLE: 3, QUERY_RESULT: 4, CURRENT_QUERY: 5,
    getExtension: () => ({ TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 }), isContextLost: () => false,
    getParameter: vi.fn(() => disjoint), getQuery: vi.fn(() => nested ? {} : null),
    createQuery: () => ({ id: ++query }), beginQuery: vi.fn(), endQuery: vi.fn(), deleteQuery: vi.fn(),
    getQueryParameter: vi.fn((_query, kind) => kind === 3 ? available : 2500000),
  } as unknown as WebGL2RenderingContext;
  return { gl, timer: createGpuFrameTimer(gl), availability: (value: boolean) => { available = value; }, nested: (value: boolean) => { nested = value; }, disjoint: (value: boolean) => { disjoint = value; } };
}
it('does not query the driver while no GPU timing result is pending', () => {
  const f = fixture();for(let i=0;i<180;i++)expect(f.timer.poll()).toEqual([]);
  expect(f.gl.getParameter).not.toHaveBeenCalled();expect(f.gl.getQueryParameter).not.toHaveBeenCalled();
  for(let i=0;i<12;i++){f.timer.begin(i*16.7);f.timer.end();}f.availability(true);
  expect(f.timer.poll()).toEqual([2.5]);expect(f.gl.getParameter).toHaveBeenCalledOnce();
  for(let i=0;i<180;i++)f.timer.poll();expect(f.gl.getParameter).toHaveBeenCalledOnce();f.timer.dispose();
});
it('reads only available non-disjoint GPU results and reports milliseconds without waiting', () => {
  const f = fixture(); for (let i = 0; i < 12; i++) { f.timer.begin(i*16.7); f.timer.end(); }
  expect(f.timer.poll()).toEqual([]); expect(f.gl.getQueryParameter).toHaveBeenCalledTimes(1);
  f.availability(true); expect(f.timer.poll()).toEqual([2.5]); expect(f.gl.deleteQuery).toHaveBeenCalledOnce();
  f.timer.dispose(); expect(f.gl.deleteQuery).toHaveBeenCalledOnce();
});
it('skips another owner query, bounds pending queries and discards disjoint timings', () => {
  const f = fixture(); f.nested(true); for (let i = 0; i < 24; i++) { f.timer.begin(i*16.7); f.timer.end(); } expect(f.gl.beginQuery).not.toHaveBeenCalled();
  f.nested(false); for (let i = 0; i < 120; i++) { f.timer.begin(i*16.7); f.timer.end(); } expect(f.gl.beginQuery).toHaveBeenCalledTimes(6);
  f.disjoint(true); expect(f.timer.poll()).toEqual([]); expect(f.gl.deleteQuery).toHaveBeenCalledTimes(6);
  f.timer.dispose(); f.timer.begin(); expect(f.gl.beginQuery).toHaveBeenCalledTimes(6);
});

it.each([30,60,120])('collects sparse fresh GPU evidence at%ifps using existing frame timestamps', hz => {
  const f=fixture();f.availability(true);let results=0;
  for(let i=0;i<hz*2;i++){results+=f.timer.poll().length;f.timer.begin(i*1000/hz);f.timer.end();}
  results+=f.timer.poll().length;expect(results).toBeGreaterThanOrEqual(8);expect(results).toBeLessThanOrEqual(10);f.timer.dispose();
});
it('keeps driver checks sparse when another owner holds the elapsed query',()=>{
  const f=fixture();f.nested(true);for(let i=0;i<240;i++){f.timer.begin(i*1000/120);f.timer.end();}
  expect(f.gl.getQuery).toHaveBeenCalledTimes(10);expect(f.gl.beginQuery).not.toHaveBeenCalled();f.timer.dispose();
});
