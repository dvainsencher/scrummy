#!/usr/bin/env node
import { commandDescriptions, commands } from "../cli/registry.js";
import { buildUsageText } from "../cli/usage.js";

export interface MainIO {
  argv: string[];
  cwd: string;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

export function main(io: MainIO): number {
  const [commandName, ...rest] = io.argv;

  if (commandName === undefined || commandName === "--help" || commandName === "-h") {
    io.stdout(`${buildUsageText(commands, commandDescriptions)}\n`);
    return 0;
  }

  const handler = commands[commandName];
  if (!handler) {
    io.stderr(`Unknown command: ${commandName}\n`);
    io.stderr(`Run "pauta --help" for a list of commands.\n`);
    return 1;
  }

  try {
    const result = handler(io.cwd, rest);
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

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main({
    argv: process.argv.slice(2),
    cwd: process.cwd(),
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  });
}
