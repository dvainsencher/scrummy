import React, { useState } from "react";
import { Box, Text, render, useInput, useApp, useStdout } from "ink";
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

const CARD_HEIGHT = 5;
const FIXED_ROWS = 7;

const STATUS_COLORS: Record<IssueStatus, string> = {
  idea: "gray",
  ready: "cyan",
  doing: "yellow",
  done: "green",
};

export function clampScroll(offset: number, rowIndex: number, maxVisible: number): number {
  if (rowIndex < offset) return rowIndex;
  if (rowIndex >= offset + maxVisible) return rowIndex - maxVisible + 1;
  return offset;
}

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
  scrollOffset,
  maxVisible,
}: {
  status: IssueStatus;
  issues: IssueView[];
  focused: boolean;
  selectedRow: number;
  scrollOffset: number;
  maxVisible: number;
}) {
  const color = STATUS_COLORS[status];
  const visibleIssues = issues.slice(scrollOffset, scrollOffset + maxVisible);
  const hiddenAbove = scrollOffset;
  const hiddenBelow = Math.max(0, issues.length - scrollOffset - maxVisible);
  return (
    <Box flexDirection="column" width={26} marginRight={1}>
      <Box borderStyle="single" borderColor={focused ? "cyan" : undefined} paddingX={1}>
        <Text color={color} bold>{status.toUpperCase()}</Text>
        <Text dimColor> ({issues.length})</Text>
      </Box>
      {hiddenAbove > 0 && <Text dimColor>  ↑ {hiddenAbove} more</Text>}
      {visibleIssues.map((issue, i) => (
        <Card key={issue.id} issue={issue} selected={focused && (i + scrollOffset) === selectedRow} />
      ))}
      {hiddenBelow > 0 && <Text dimColor>  ↓ {hiddenBelow} more</Text>}
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
  maxVisibleCards?: number;
  initialScrollOffsets?: number[];
}

export function KanbanApp({ data: initialData, plan, cwd, maxVisibleCards: maxVisibleProp, initialScrollOffsets }: KanbanAppProps) {
  const [data, setData] = useState(initialData);
  const [showPicker, setShowPicker] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [nav, setNav] = useState<NavState>({ colIndex: 0, rowIndex: 0 });
  const [scrollOffsets, setScrollOffsets] = useState(initialScrollOffsets ?? [0, 0, 0, 0]);
  const [detail, setDetail] = useState<{ issue: IssueView; spec: string | null; log: ProgressEntry[] } | null>(null);
  const { exit } = useApp();
  const { stdout } = useStdout();

  const terminalRows = stdout?.rows ?? 24;
  const maxVisible = maxVisibleProp ?? Math.max(1, Math.floor((terminalRows - FIXED_ROWS) / CARD_HEIGHT));

  const focusedIssue = (): IssueView | null => {
    const status = ISSUE_STATUSES[nav.colIndex];
    if (!status) return null;
    return data.columns[status][nav.rowIndex] ?? null;
  };

  const updateScroll = (newNav: NavState, prevOffsets: number[]): number[] => {
    const newOffsets = [...prevOffsets];
    newOffsets[newNav.colIndex] = clampScroll(newOffsets[newNav.colIndex], newNav.rowIndex, maxVisible);
    return newOffsets;
  };

  const resetView = (newData: KanbanData) => {
    setData(newData);
    setNav({ colIndex: 0, rowIndex: 0 });
    setScrollOffsets([0, 0, 0, 0]);
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
      resetView(selectKanbanView(plan, null));
      return;
    }
    if (key.leftArrow) {
      const newNav = moveLeft(nav, data.columns);
      setNav(newNav);
      setScrollOffsets((prev) => updateScroll(newNav, prev));
      return;
    }
    if (key.rightArrow) {
      const newNav = moveRight(nav, data.columns);
      setNav(newNav);
      setScrollOffsets((prev) => updateScroll(newNav, prev));
      return;
    }
    if (key.upArrow) {
      const newNav = moveUp(nav, data.columns);
      setNav(newNav);
      setScrollOffsets((prev) => updateScroll(newNav, prev));
      return;
    }
    if (key.downArrow) {
      const newNav = moveDown(nav, data.columns);
      setNav(newNav);
      setScrollOffsets((prev) => updateScroll(newNav, prev));
      return;
    }
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
          resetView(selectKanbanView(plan ?? { sprints: data.allSprints, backlog: [] }, name));
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
            scrollOffset={scrollOffsets[colIdx] ?? 0}
            maxVisible={maxVisible}
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
  const plan = buildPlan(cwd, { done: true });
  const data = buildKanbanData(plan);
  render(<KanbanApp data={data} plan={plan} cwd={cwd} />);
}
