// Test-only helper: a standalone process that runs one mutating CLI command, but only
// after a barrier file appears. The barrier is what makes the race real — every worker
// is already booted and spinning when it's released, so they collide inside the
// read-modify-write instead of being accidentally serialized by process startup jitter.
//
// Spawned by concurrency.test.ts. Not reachable from the CLI.
import fs from "node:fs";
import { main } from "../bin/scrummy.js";

const [cwd, barrierPath, ...argv] = process.argv.slice(2);

if (cwd === undefined || barrierPath === undefined) {
  process.stderr.write("usage: raceWorker <cwd> <barrierPath> <command> [args...]\n");
  process.exit(2);
}

// Signal "loaded and ready", then spin until released. Busy-wait rather than a watcher:
// this runs for a few milliseconds at most and must not yield to an event loop turn that
// would reintroduce the startup skew the barrier exists to remove.
fs.writeFileSync(`${barrierPath}.ready.${process.pid}`, "");
while (!fs.existsSync(barrierPath)) {
  // spin
}

process.exitCode = main({
  argv,
  cwd,
  stdout: () => {},
  stderr: (text) => process.stderr.write(text),
});
