import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import { CardDetail } from "./cardDetail.js";
import type { IssueView } from "../../reader/plan.js";
import type { ProgressEntry } from "../../domain/types.js";

function makeIssue(overrides: Partial<IssueView> & { id: number }): IssueView {
  return {
    title: `Issue ${overrides.id}`,
    status: "ready",
    sprint: "s1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    hasSpec: false,
    hasLog: false,
    ...overrides,
  };
}

describe("CardDetail", () => {
  it("renders the issue id, title, status, and sprint", () => {
    const issue = makeIssue({ id: 7, title: "Write tests", status: "doing", sprint: "sprint-x" });
    const { lastFrame } = render(<CardDetail issue={issue} spec={null} log={[]} onClose={() => {}} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("#7");
    expect(frame).toContain("Write tests");
    expect(frame).toContain("doing");
    expect(frame).toContain("sprint-x");
  });

  it("renders spec content when provided", () => {
    const issue = makeIssue({ id: 1 });
    const { lastFrame } = render(
      <CardDetail issue={issue} spec="## Goal\nBuild the thing." log={[]} onClose={() => {}} />
    );
    expect(lastFrame() ?? "").toContain("Build the thing.");
  });

  it("renders log entries", () => {
    const issue = makeIssue({ id: 2 });
    const log: ProgressEntry[] = [
      { issueId: 2, type: "plan", message: "Started planning", createdAt: "2026-01-01T00:00:00.000Z" },
      { issueId: 2, type: "verified", message: "Tests green", createdAt: "2026-01-02T00:00:00.000Z" },
    ];
    const { lastFrame } = render(<CardDetail issue={issue} spec={null} log={log} onClose={() => {}} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Started planning");
    expect(frame).toContain("Tests green");
  });

  it("shows a close hint", () => {
    const issue = makeIssue({ id: 1 });
    const { lastFrame } = render(<CardDetail issue={issue} spec={null} log={[]} onClose={() => {}} />);
    expect(lastFrame() ?? "").toMatch(/esc|close/i);
  });
});
