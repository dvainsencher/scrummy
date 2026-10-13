import { claimState, parseLease } from "../../domain/claims.js";
import type { Issue } from "../../domain/types.js";
import { assertIssueExists, assertSprintExists } from "../../domain/validation.js";
import { readIssues, writeIssues } from "../../storage/issuesStore.js";
import { readSprints } from "../../storage/sprintsStore.js";
import { buildPlan } from "../../reader/plan.js";

export interface ClaimOptions {
  agent: string;
  lease?: string;
  steal?: boolean;
  /** Injectable clock for tests. */
  now?: number;
}

function replaceIssue(cwd: string, issues: Issue[], updated: Issue): void {
  writeIssues(cwd, issues.map((issue) => (issue.id === updated.id ? updated : issue)));
}

function withoutClaim(issue: Issue): Issue {
  const { assignee, claimedAt, leaseUntil, ...rest } = issue;
  return rest;
}

function holdsLive(issue: Issue, now: number): boolean {
  return claimState(issue, now) === "held";
}

function applyClaim(issue: Issue, options: ClaimOptions, now: number): Issue {
  const sameHolder = issue.assignee === options.agent;
  const stamp = new Date(now).toISOString();
  return {
    ...issue,
    status: "doing",
    assignee: options.agent,
    claimedAt: sameHolder && issue.claimedAt ? issue.claimedAt : stamp,
    leaseUntil: new Date(now + parseLease(options.lease)).toISOString(),
    updatedAt: stamp,
  };
}

function claimIn(cwd: string, issues: Issue[], id: number, options: ClaimOptions): Issue {
  assertIssueExists(issues, id);
  const now = options.now ?? Date.now();
  const issue = issues.find((i) => i.id === id)!;
  if (issue.status === "done") {
    throw new Error(`Issue #${id} is done — nothing to claim`);
  }
  if (holdsLive(issue, now) && issue.assignee !== options.agent && !options.steal) {
    throw new Error(
      `Issue #${id} is claimed by ${issue.assignee} until ${issue.leaseUntil}. ` +
        `Use --steal to take it over.`,
    );
  }
  const claimed = applyClaim(issue, options, now);
  replaceIssue(cwd, issues, claimed);
  return claimed;
}

export function claimIssue(cwd: string, id: number, options: ClaimOptions): string {
  const claimed = claimIn(cwd, readIssues(cwd), id, options);
  return `Claimed issue #${id} for ${claimed.assignee} until ${claimed.leaseUntil}`;
}

export function releaseIssue(cwd: string, id: number, options: ClaimOptions): string {
  const issues = readIssues(cwd);
  assertIssueExists(issues, id);
  const now = options.now ?? Date.now();
  const issue = issues.find((i) => i.id === id)!;
  if (holdsLive(issue, now) && issue.assignee !== options.agent && !options.steal) {
    throw new Error(`Issue #${id} is claimed by ${issue.assignee}. Use --steal to release it anyway.`);
  }
  if (!issue.assignee) {
    return `Issue #${id} is not claimed`;
  }
  // Released work is available again, so a `doing` issue goes back to `ready` — otherwise
  // `next` would never offer it to anyone.
  const released = withoutClaim(issue);
  replaceIssue(cwd, issues, {
    ...released,
    status: issue.status === "doing" ? "ready" : issue.status,
    updatedAt: new Date(now).toISOString(),
  });
  return `Released issue #${id}`;
}

export function renewIssue(cwd: string, id: number, options: ClaimOptions): string {
  const issues = readIssues(cwd);
  assertIssueExists(issues, id);
  const issue = issues.find((i) => i.id === id)!;
  if (!issue.assignee) {
    throw new Error(`Issue #${id} is not claimed — use "claim" first`);
  }
  if (issue.assignee !== options.agent) {
    throw new Error(`Issue #${id} is claimed by ${issue.assignee}, not ${options.agent}`);
  }
  const now = options.now ?? Date.now();
  const renewed = { ...issue, leaseUntil: new Date(now + parseLease(options.lease)).toISOString() };
  replaceIssue(cwd, issues, renewed);
  return `Renewed issue #${id} until ${renewed.leaseUntil}`;
}

export interface NextOptions extends ClaimOptions {
  sprint?: string;
  claim?: boolean;
}

/**
 * First `ready` unclaimed issue (or `doing` one whose lease expired): active sprints first, then by sprint position, then the
 * backlog; within a group by id. With `claim` it claims it in the same call, which is what
 * makes it safe for a pool of agents (the whole command runs under the roadmap lock).
 */
export function nextIssue(cwd: string, options: NextOptions): string {
  if (options.sprint !== undefined) {
    assertSprintExists(readSprints(cwd), options.sprint);
  }
  const now = options.now ?? Date.now();
  const plan = buildPlan(cwd, { sprint: options.sprint });
  const candidates = [...plan.sprints.flatMap((group) => group.issues), ...plan.backlog];
  // An abandoned `doing` issue (its lease ran out) is offered again; that's what leases are for.
  const found = candidates.find((issue) => {
    const state = claimState(issue, now);
    return (issue.status === "ready" && state !== "held") || (issue.status === "doing" && state === "expired");
  });
  if (!found) {
    throw new Error(
      options.sprint ? `No ready unclaimed issue in sprint "${options.sprint}"` : "No ready unclaimed issue",
    );
  }
  if (options.claim) {
    claimIn(cwd, readIssues(cwd), found.id, options);
    return `#${found.id} ${found.title} (claimed by ${options.agent})`;
  }
  return `#${found.id} ${found.title}`;
}
