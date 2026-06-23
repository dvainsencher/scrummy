import { buildPlan } from "../../reader/plan.js";

export function status(cwd: string): string {
  const plan = buildPlan(cwd, { done: true });
  const active = plan.sprints.find((sprint) => sprint.active);
  if (!active) {
    return "no active sprint";
  }

  const done = active.issues.filter((issue) => issue.status === "done").length;
  const base = `${active.name} ${done}/${active.issues.length}`;

  const current =
    active.issues.find((issue) => issue.status === "doing") ??
    active.issues.find((issue) => issue.status !== "done");

  return current ? `${base} → #${current.id} ${current.title}` : base;
}
