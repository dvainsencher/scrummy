export interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | true>;
}

export function parseArgs(args: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | true> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const name = arg.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[name] = next;
        i++;
      } else {
        flags[name] = true;
      }
    } else {
      positionals.push(arg);
    }
  }

  return { positionals, flags };
}

export function requirePositional(parsed: ParsedArgs, index: number, label: string): string {
  const value = parsed.positionals[index];
  if (value === undefined) {
    throw new Error(`Missing required argument: ${label}`);
  }
  return value;
}

export function requireIntPositional(parsed: ParsedArgs, index: number, label: string): number {
  const raw = requirePositional(parsed, index, label);
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`Expected ${label} to be an integer, got "${raw}"`);
  }
  return value;
}
