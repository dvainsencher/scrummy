import type { CommandHandler } from "./registry.js";

export function buildUsageText(
  commands: Record<string, CommandHandler>,
  descriptions: Record<string, string>,
): string {
  const lines = ["Usage: pauta <command> [args]", "", "Commands:"];
  for (const name of Object.keys(commands).sort()) {
    lines.push(`  ${name.padEnd(20)}${descriptions[name] ?? ""}`);
  }
  return lines.join("\n");
}
