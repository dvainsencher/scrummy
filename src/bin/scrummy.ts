#!/usr/bin/env node
import { realpathSync, writeSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { commandDescriptions, commands, isMutating, localCwdCommands } from "../cli/registry.js";
import { buildUsageText } from "../cli/usage.js";
import { generateRoadmapMarkdown } from "../cli/commands/roadmap.js";
import { sleepSync, withRoadmapLock } from "../storage/lock.js";
import { migrateRoadmapLayout } from "../storage/migrate.js";
import { assertCanonicalBranch, resolveRoadmapRoot } from "../storage/root.js";

export function isEntryPoint(argv1: string | undefined, moduleUrl: string): boolean {
  if (argv1 === undefined) {
    return false;
  }
  try {
    return realpathSync(argv1) === fileURLToPath(moduleUrl);
  } catch {
    return false;
  }
}

export interface MainIO {
  argv: string[];
  cwd: string;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  /** Synchronous stdout for commands that stream forever; throws when the reader is gone. */
  write?: (text: string) => void;
}

export function main(io: MainIO): number {
  const [commandName, ...args] = io.argv;
  const allowBranch = args.includes("--allow-branch");
  const rest = args.filter((arg) => arg !== "--allow-branch");

  if (commandName === undefined || commandName === "--help" || commandName === "-h") {
    io.stdout(`${buildUsageText(commands, commandDescriptions)}\n`);
    return 0;
  }

  const handler = commands[commandName];
  if (!handler) {
    io.stderr(`Unknown command: ${commandName}\n`);
    io.stderr(`Run "scrummy --help" for a list of commands.\n`);
    return 1;
  }

  try {
    // Mutating commands are read → modify → write-whole-file, so two of them overlapping
    // silently discards one. Serializing here — around the regen too, since that reads the
    // files back — is the single choke point that covers every command, present and future.
    const mutating = isMutating(commandName, rest);
    // Every worktree of a project shares one roadmap, so resolve once and thread the
    // canonical root through as the `cwd` every handler already takes. A few commands act
    // on the directory the user is actually in instead.
    const resolved = resolveRoadmapRoot(io.cwd);
    // `init` is exempt: a fresh repo has no config.json to name its main branch yet, and
    // init never overwrites an existing roadmap.
    if (mutating && commandName !== "init") {
      assertCanonicalBranch(resolved, process.env, { allowBranch });
    }
    const commandCwd = localCwdCommands.has(commandName) ? io.cwd : resolved.root;
    const runCommand = (): string | void => {
      if (mutating) {
        // Convert a pre-directory layout in one atomic step, under the lock, before any
        // command touches it. No-op once converted. See storage/migrate.ts.
        migrateRoadmapLayout(commandCwd);
      }
      const commandResult = handler(commandCwd, rest, { localCwd: io.cwd, env: process.env, write: io.write ?? io.stdout });
      if (mutating) {
        try {
          generateRoadmapMarkdown(commandCwd);
        } catch {
          // best-effort — mutation already committed, don't mask the success
        }
      }
      return commandResult;
    };
    const result = mutating ? withRoadmapLock(commandCwd, runCommand) : runCommand();
    if (result !== undefined) {
      io.stdout(`${result}\n`);
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`${message}\n`);
    return 1;
  }
}

// `watch` never yields to the event loop, so a closed pipe (EPIPE) would never be reported
// through process.stdout. Writing synchronously makes it throw, which ends the command.
export function writeStdoutSync(text: string): void {
  const buffer = Buffer.from(text);
  let offset = 0;
  while (offset < buffer.length) {
    try {
      offset += writeSync(1, buffer, offset);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EAGAIN") throw error;
      sleepSync(5); // non-blocking pipe is full; wait for the reader
    }
  }
}

if (isEntryPoint(process.argv[1], import.meta.url)) {
  process.exitCode = main({
    argv: process.argv.slice(2),
    cwd: process.cwd(),
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
    write: writeStdoutSync,
  });
}
