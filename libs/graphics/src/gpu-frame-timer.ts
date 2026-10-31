interface TimerExtension { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number }
/** Never waits for the GPU, and never nests another owner's elapsed query. */
export function createGpuFrameTimer(gl: WebGL2RenderingContext) {
  const extension = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension | null;
  const pending: WebGLQuery[] = [];
  let active: WebGLQuery | null = null, attemptedAt = -Infinity, disposed = false;
  return {
    available: Boolean(extension),
    poll() {
      if (!extension || disposed || pending.length === 0 || gl.isContextLost()) return [];
      if (gl.getParameter(extension.GPU_DISJOINT_EXT)) { for (const query of pending.splice(0)) gl.deleteQuery(query); return []; }
      const values: number[] = [];
      while (pending[0] && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
        const query = pending.shift()!;
        const nanoseconds = Number(gl.getQueryParameter(query, gl.QUERY_RESULT)); gl.deleteQuery(query);
        if (Number.isFinite(nanoseconds) && nanoseconds >= 0) values.push(nanoseconds / 1e6);
      }
      return values;
    },
    begin(time = performance.now()) {
      // Keep enough fresh results at30Hz without over-querying faster displays.
      // This uses the existing host timestamp; it never schedules a frame.
      if (!extension || disposed || !Number.isFinite(time) || time - attemptedAt < 200) return;
      attemptedAt = time;
      if (gl.isContextLost() || pending.length >= 6 || active || gl.getQuery(extension.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) return;
      const query = gl.createQuery();
      if (query) { gl.beginQuery(extension.TIME_ELAPSED_EXT, query); active = query; }
    },
    end() { if (extension && active) { gl.endQuery(extension.TIME_ELAPSED_EXT); pending.push(active); active = null; } },
    dispose() {
      if (disposed) return;
      if (active && extension && !gl.isContextLost()) gl.endQuery(extension.TIME_ELAPSED_EXT);
      if (active) gl.deleteQuery(active);
      for (const query of pending.splice(0)) gl.deleteQuery(query);
      active = null; disposed = true;
    },
  };
}
