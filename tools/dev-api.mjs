import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { replaceTscAliasPaths } from 'tsc-alias';

// Unlike watching emitted JavaScript, this watches the complete TypeScript
// dependency graph, including shared libraries and newly imported source files.
export function watchApi({ project = 'apps/api/tsconfig.build.json', outDir = '.dev/api', entry = 'apps/api/src/main.js', polling = process.env.TOROBTICKET_DEV_POLLING === 'true' } = {}) {
  const configFile = resolve(project);
  const output = resolve(outDir);
  const report = ts.createDiagnosticReporter(ts.sys, true);
  let child;
  let revision = 0;
  let closed = false;
  let queue = Promise.resolve();
  // Watch the parent directory so editor save-by-replacement does not leave
  // imported files attached to an inode that Docker Desktop has retired.
  const host = ts.createWatchCompilerHost(configFile, { outDir: output, noEmitOnError: true }, ts.sys, ts.createEmitAndSemanticDiagnosticsBuilderProgram, report, diagnostic => {
    console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
  }, polling
    ? { watchFile: ts.WatchFileKind.DynamicPriorityPolling, watchDirectory: ts.WatchDirectoryKind.DynamicPriorityPolling }
    : { watchFile: ts.WatchFileKind.UseFsEventsOnParentDirectory, watchDirectory: ts.WatchDirectoryKind.UseFsEvents });

  async function stopChild() {
    if (!child || child.exitCode !== null || child.signalCode !== null) { child = undefined; return; }
    const running = child;
    const exited = once(running, 'exit');
    running.kill('SIGTERM');
    const timeout = setTimeout(() => running.kill('SIGKILL'), 5000);
    timeout.unref();
    try { await exited; } finally { clearTimeout(timeout); if (child === running) child = undefined; }
  }

  host.afterProgramCreate = builder => {
    const current = ++revision;
    const diagnostics = ts.getPreEmitDiagnostics(builder.getProgram());
    for (const diagnostic of diagnostics) report(diagnostic);
    if (diagnostics.some(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)) {
      console.error('API compilation failed; keeping the last successful server.');
      return;
    }
    const emitted = builder.emit();
    for (const diagnostic of emitted.diagnostics) report(diagnostic);
    if (emitted.emitSkipped) return;
    queue = queue.then(async () => {
      await replaceTscAliasPaths({ configFile, outDir: output });
      if (closed || current !== revision) return;
      await stopChild();
      if (closed || current !== revision) return;
      console.log('API compilation complete; starting server.');
      child = spawn(process.execPath, [resolve(output, entry)], { stdio: 'inherit', env: process.env });
      child.on('error', error => console.error(`API process failed: ${error.message}`));
    }).catch(error => console.error(`API reload failed: ${error.message}`));
  };
  const watch = ts.createWatchProgram(host);
  return {
    async close() {
      closed = true;
      ++revision;
      watch.close();
      await queue;
      await stopChild();
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [project, outDir, entry] = process.argv.slice(2);
  const running = watchApi({ ...(project && { project }), ...(outDir && { outDir }), ...(entry && { entry }) });
  let closing = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    if (closing) return;
    closing = true;
    void running.close().catch(error => { console.error(error); process.exitCode = 1; });
  });
}
