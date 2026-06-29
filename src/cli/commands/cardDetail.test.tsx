import { describe, expect, it, beforeAll } from "vitest";
import { render } from "ink-testing-library";
import { act } from "react";
import React from "react";
import { CardDetail } from "./cardDetail.js";
import type { IssueView } from "../../reader/plan.js";
import type { ProgressEntry } from "../../domain/types.js";

beforeAll(() => { (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true; });

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

  it("starts with spec visible from the top (first line, not bottom)", () => {
    const issue = makeIssue({ id: 1 });
    // 30-line spec exceeds the default 24-row terminal minus fixed chrome
    const spec = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}`).join("\n");
    const { lastFrame } = render(<CardDetail issue={issue} spec={spec} log={[]} onClose={() => {}} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Line 1");
    expect(frame).not.toContain("Line 30");
  });

  it("scrolls down on ↓ arrow key", () => {
    const issue = makeIssue({ id: 1 });
    const spec = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}`).join("\n");
    const { lastFrame, stdin } = render(<CardDetail issue={issue} spec={spec} log={[]} onClose={() => {}} />);

    // Before: spec header visible, Line 30 not visible
    expect(lastFrame() ?? "").toContain("── spec ──");
    expect(lastFrame() ?? "").not.toContain("Line 30");

    // Scroll all the way down
    for (let i = 0; i < 25; i++) act(() => stdin.write("\x1B[B"));

    const after = lastFrame() ?? "";
    expect(after).toContain("Line 30");
    expect(after).not.toContain("── spec ──");
  });

  it("scrolls back up on ↑ arrow key after scrolling down", () => {
    const issue = makeIssue({ id: 1 });
    const spec = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}`).join("\n");
    const { lastFrame, stdin } = render(<CardDetail issue={issue} spec={spec} log={[]} onClose={() => {}} />);

    // Scroll down to bottom
    for (let i = 0; i < 25; i++) act(() => stdin.write("\x1B[B"));
    expect(lastFrame() ?? "").not.toContain("── spec ──");

    // Scroll back up to top
    for (let i = 0; i < 25; i++) act(() => stdin.write("\x1B[A"));
    expect(lastFrame() ?? "").toContain("── spec ──");
  });

  it("shows ↓ more indicator when content overflows below", () => {
    const issue = makeIssue({ id: 1 });
    const spec = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}`).join("\n");
    const { lastFrame } = render(<CardDetail issue={issue} spec={spec} log={[]} onClose={() => {}} />);
    expect(lastFrame() ?? "").toMatch(/↓.*more/);
  });

  it("shows no scroll indicators when content fits within viewport", () => {
    const issue = makeIssue({ id: 1 });
    const spec = "Short spec\nLine 2";
    const { lastFrame } = render(<CardDetail issue={issue} spec={spec} log={[]} onClose={() => {}} />);
    const frame = lastFrame() ?? "";
    expect(frame).not.toMatch(/↑.*more/);
    expect(frame).not.toMatch(/↓.*more/);
  });

  it("clamps scroll offset at boundaries (no overscroll)", () => {
    const issue = makeIssue({ id: 1 });
    const spec = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}`).join("\n");
    const { lastFrame, stdin } = render(<CardDetail issue={issue} spec={spec} log={[]} onClose={() => {}} />);

    // Scroll way past the bottom — should clamp
    for (let i = 0; i < 100; i++) act(() => stdin.write("\x1B[B"));
    const atBottom = lastFrame() ?? "";
    expect(atBottom).toContain("Line 30");

    // Scroll way past the top — should clamp
    for (let i = 0; i < 100; i++) act(() => stdin.write("\x1B[A"));
    const atTop = lastFrame() ?? "";
    expect(atTop).toContain("── spec ──");
    expect(atTop).toContain("Line 1");
  });

  it("shows ↑ more indicator when scrolled past content above", () => {
    const issue = makeIssue({ id: 1 });
    const spec = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}`).join("\n");
    const { lastFrame, stdin } = render(<CardDetail issue={issue} spec={spec} log={[]} onClose={() => {}} />);
    act(() => stdin.write("\x1B[B"));
    expect(lastFrame() ?? "").toMatch(/↑.*more/);
  });
});
