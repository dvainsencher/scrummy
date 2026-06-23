import { describe, expect, it } from "vitest";
import type { Plan } from "./plan.js";
import { renderJson, renderPretty } from "./render.js";

function plan(overrides: Partial<Plan> = {}): Plan {
  return { backlog: [], sprints: [], ...overrides };
}

describe("renderJson", () => {
  it("returns the plan data itself, structured", () => {
    const p = plan({
      backlog: [
        {
          id: 1,
          title: "Dark mode",
          status: "idea",
          sprint: "",
          createdAt: "",
          updatedAt: "",
          hasSpec: false,
          hasLog: false,
        },
      ],
    });
    expect(JSON.parse(renderJson(p))).toEqual(p);
  });
});

describe("renderPretty", () => {
  it("shows BACKLOG with a count and each issue", () => {
    const p = plan({
      backlog: [
        {
          id: 12,
          title: "Rework auth",
          status: "ready",
          sprint: "",
          createdAt: "",
          updatedAt: "",
          hasSpec: true,
          hasLog: true,
        },
        {
          id: 15,
          title: "Dark mode",
          status: "idea",
          sprint: "",
          createdAt: "",
          updatedAt: "",
          hasSpec: false,
          hasLog: false,
        },
      ],
    });
    const out = renderPretty(p);
    expect(out).toContain("BACKLOG (2)");
    expect(out).toContain("#12");
    expect(out).toContain("ready");
    expect(out).toContain("Rework auth");
    expect(out).toContain("[spec]");
    expect(out).toContain("[log]");
    expect(out).toContain("#15");
    expect(out).toContain("Dark mode");
  });

  it("shows an empty backlog as BACKLOG (0) with no issue lines", () => {
    expect(renderPretty(plan())).toContain("BACKLOG (0)");
  });

  it("omits the backlog section entirely when filtered to a single sprint", () => {
    const out = renderPretty(plan({ filteredBySprint: "foundation" }));
    expect(out).not.toContain("BACKLOG");
  });

  it("marks the active sprint with a leading marker, others without", () => {
    const p = plan({
      sprints: [
        { name: "auth-hardening", position: 10, status: "active", goal: "g", notes: "", active: true, issues: [] },
        { name: "onboarding", position: 20, status: "planned", goal: "g2", notes: "", active: false, issues: [] },
      ],
    });
    const out = renderPretty(p);
    expect(out).toContain("▶ SPRINT auth-hardening");
    expect(out).toContain("(active)");
    expect(out).toContain("SPRINT onboarding");
    expect(out).toContain("(planned)");
    expect(out).not.toContain("▶ SPRINT onboarding");
  });

  it("shows each sprint's goal and its issues", () => {
    const p = plan({
      sprints: [
        {
          name: "foundation",
          position: 10,
          status: "planned",
          goal: "build the mechanical layer",
          notes: "",
          active: false,
          issues: [
            {
              id: 3,
              title: "Rotate signing keys",
              status: "doing",
              sprint: "foundation",
              createdAt: "",
              updatedAt: "",
              hasSpec: false,
              hasLog: false,
            },
          ],
        },
      ],
    });
    const out = renderPretty(p);
    expect(out).toContain("goal: build the mechanical layer");
    expect(out).toContain("#3");
    expect(out).toContain("doing");
    expect(out).toContain("Rotate signing keys");
  });
});
