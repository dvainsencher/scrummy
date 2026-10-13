import path from "node:path";
import type { Issue } from "./types.js";

export const DEFAULT_LEASE_MS = 2 * 60 * 60 * 1000;

const UNIT_MS = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

/** Parse a lease like `90s`, `30m`, `2h` or `1d`. Undefined means the default. */
export function parseLease(raw: string | undefined): number {
  if (raw === undefined) {
    return DEFAULT_LEASE_MS;
  }
  const match = /^([1-9]\d*)([smhd])$/.exec(raw);
  if (!match) {
    throw new Error(`Invalid lease "${raw}" — expected a whole number plus s, m, h or d (e.g. 30m, 2h)`);
  }
  return Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS];
}

export type ClaimState = "free" | "held" | "expired";

export function claimState(
  issue: Partial<Pick<Issue, "assignee" | "leaseUntil">>,
  now: number = Date.now(),
): ClaimState {
  if (!issue.assignee) {
    return "free";
  }
  return issue.leaseUntil !== undefined && Date.parse(issue.leaseUntil) > now ? "held" : "expired";
}

/** Who is acting: `--as`, then SCRUMMY_AGENT, then the name of the directory the command ran in. */
export function resolveAgent(
  flag: string | true | undefined,
  env: Record<string, string | undefined>,
  localCwd: string,
): string {
  if (typeof flag === "string" && flag !== "") {
    return flag;
  }
  return env.SCRUMMY_AGENT || path.basename(localCwd);
}
