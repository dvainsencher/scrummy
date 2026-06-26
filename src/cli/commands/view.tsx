import React, { useState } from "react";
import { Box, Text, render, useInput, useApp } from "ink";
import fs from "node:fs";
import type { IssueView, Plan } from "../../reader/plan.js";
import type { IssueStatus, ProgressEntry } from "../../domain/types.js";
import { ISSUE_STATUSES } from "../../domain/types.js";
import { buildPlan } from "../../reader/plan.js";
import { specFilePath } from "../../storage/paths.js";
import { readProgress } from "../../storage/progressStore.js";
import { buildKanbanData, selectKanbanView, type KanbanData } from "./kanban.js";
import { SprintPicker } from "./sprintPicker.js";
import { moveLeft, moveRight, moveUp, moveDown, type NavState } from "./navigation.js";
import { CardDetail } from "./cardDetail.js";

const STATUS_COLORS: Record<IssueStatus, string> = {
  idea: "gray",
  ready: "cyan",
  doing: "yellow",
  done: "green",
};

function Card({ issue, selected }: { issue: IssueView; selected: boolean }) {
  const badge = STATUS_COLORS[issue.status];
  const indicators = [issue.hasSpec ? "S" : "", issue.hasLog ? "L" : ""].filter(Boolean).join(" ");
  return (
    <Box
      flexDirection="column"
      borderStyle={selected ? "double" : "single"}
      borderColor={selected ? "cyan" : undefined}
      paddingX={1}
      marginBottom={1}
      width={24}
    >
      <Box>
        <Text bold dimColor>#{issue.id} </Text>
        <Text color={badge}>[{issue.status}]</Text>
      </Box>
      <Text wrap="wrap">{issue.title}</Text>
      {issue.sprint ? <Text dimColor>{issue.sprint}</Text> : null}
      {indicators ? <Text dimColor>{indicators}</Text> : null}
    </Box>
  );
}

function Column({
  status,
  issues,
  focused,
  selectedRow,
}: {
  status: IssueStatus;
  issues: IssueView[];
  focused: boolean;
  selectedRow: number;
}) {
  const color = STATUS_COLORS[status];
  return (
    <Box flexDirection="column" width={26} marginRight={1}>
      <Box borderStyle="single" borderColor={focused ? "cyan" : undefined} paddingX={1}>
        <Text color={color} bold>{status.toUpperCase()}</Text>
        <Text dimColor> ({issues.length})</Text>
      </Box>
      {issues.map((issue, i) => (
        <Card key={issue.id} issue={issue} selected={focused && i === selectedRow} />
      ))}
    </Box>
  );
}

const HELP_TEXT = [
  "Q / Esc  quit",
  "S        sprint picker",
  "B        backlog",
  "←→       move between columns",
  "↑↓       move between cards",
  "Enter    open card detail",
  "?        toggle this help",
].join("   ");

interface KanbanAppProps {
  data: KanbanData;
  plan?: Plan;
  cwd?: string;
}

export function KanbanApp({ data: initialData, plan, cwd }: KanbanAppProps) {
  const [data, setData] = useState(initialData);
  const [showPicker, setShowPicker] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [nav, setNav] = useState<NavState>({ colIndex: 0, rowIndex: 0 });
  const [detail, setDetail] = useState<{ issue: IssueView; spec: string | null; log: ProgressEntry[] } | null>(null);
  const { exit } = useApp();

  const focusedIssue = (): IssueView | null => {
    const status = ISSUE_STATUSES[nav.colIndex];
    if (!status) return null;
    return data.columns[status][nav.rowIndex] ?? null;
  };

  useInput((input, key) => {
    if (detail !== null) return;
    if (showPicker) return;
    if (input === "q" || input === "Q" || key.escape) {
      exit();
      return;
    }
    if (input === "?") {
      setShowHelp((h) => !h);
      return;
    }
    if (input === "s" || input === "S") {
      if (data.allSprints.length > 0) setShowPicker(true);
      return;
    }
    if ((input === "b" || input === "B") && plan) {
      setData(selectKanbanView(plan, null));
      setNav({ colIndex: 0, rowIndex: 0 });
      return;
    }
    if (key.leftArrow) { setNav((n) => moveLeft(n, data.columns)); return; }
    if (key.rightArrow) { setNav((n) => moveRight(n, data.columns)); return; }
    if (key.upArrow) { setNav((n) => moveUp(n, data.columns)); return; }
    if (key.downArrow) { setNav((n) => moveDown(n, data.columns)); return; }
    if (key.return) {
      const issue = focusedIssue();
      if (issue) {
        const spec = (cwd && issue.hasSpec)
          ? (() => { try { return fs.readFileSync(specFilePath(cwd, issue.id), "utf8"); } catch { return null; } })()
          : null;
        const log = (cwd && issue.hasLog)
          ? readProgress(cwd).filter((e) => e.issueId === issue.id)
          : [];
        setDetail({ issue, spec, log });
      }
    }
  });

  if (detail !== null) {
    return (
      <CardDetail
        issue={detail.issue}
        spec={detail.spec}
        log={detail.log}
        onClose={() => setDetail(null)}
      />
    );
  }

  if (showPicker) {
    return (
      <SprintPicker
        sprints={data.allSprints}
        selected={data.sprintName}
        onSelect={(name) => {
          setData(selectKanbanView(plan ?? { sprints: data.allSprints, backlog: [] }, name));
          setNav({ colIndex: 0, rowIndex: 0 });
          setShowPicker(false);
        }}
        onCancel={() => setShowPicker(false)}
      />
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>scrummy kanban</Text>
        {data.sprintName !== null && (
          <>
            <Text dimColor> — sprint: </Text>
            <Text color="cyan">{data.sprintName}</Text>
          </>
        )}
        {data.sprintName === null && <Text dimColor> — backlog</Text>}
      </Box>
      <Box flexDirection="row">
        {ISSUE_STATUSES.map((status, colIdx) => (
          <Column
            key={status}
            status={status}
            issues={data.columns[status]}
            focused={nav.colIndex === colIdx}
            selectedRow={nav.rowIndex}
          />
        ))}
      </Box>
      <Box marginTop={1}>
        {showHelp
          ? <Text dimColor>{HELP_TEXT}</Text>
          : <Text dimColor>Q quit  S sprints  B backlog  ←→↑↓ navigate  Enter detail  ? help</Text>}
      </Box>
    </Box>
  );
}

export function view(cwd: string): void {
  const plan = buildPlan(cwd, {});
  const data = buildKanbanData(plan);
  render(<KanbanApp data={data} plan={plan} cwd={cwd} />);
}
