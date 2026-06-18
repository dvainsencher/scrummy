#!/usr/bin/env node
import { commands } from "../cli/registry.js";

function main(): void {
  const [commandName, ...rest] = process.argv.slice(2);
  const handler = commands[commandName];

  if (!handler) {
    process.stderr.write(`Unknown command: ${commandName ?? "(none)"}\n`);
    process.exitCode = 1;
    return;
  }

  try {
    const result = handler(process.cwd(), rest);
    if (result !== undefined) {
      process.stdout.write(`${result}\n`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

main();
