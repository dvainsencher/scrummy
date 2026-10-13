import React, { useState, useEffect, useRef } from "react";
import { Box, Text, render, useInput, useApp, useStdout } from "ink";
import fs from "node:fs";
import type { IssueView, Plan } from "../../reader/plan.js";
import type { IssueStatus, ProgressEntry } from "../../domain/types.js";
import { ISSUE_STATUSES } from "../../domain/types.js";
import { specFilePath } from "../../storage/paths.js";
import { readProgress } from "../../storage/progressStore.js";
import { buildKanbanData, selectKanbanView, type KanbanData } from "./kanban.js";
import { buildViewData, refreshViewData, fingerprint } from "./viewRefresh.js";
import { SprintBoard } from "./sprintBoard.js";
import { moveLeft, moveRight, moveUp, moveDown, clampScroll, type NavState } from "./navigation.js";
import { CardDetail } from "./cardDetail.js";

// Enforced total card footprint: border-top + id/status + title + sprint-name + indicators + border-bottom + marginBottom = 7.
// The Card Box sets height={CARD_HEIGHT - 1} (the 6 bordered rows) plus marginBottom={1}, so the rendered
// footprint EQUALS CARD_HEIGHT by construction — a layout invariant, not an estimate. Combined with
// truncate-end on every variable row, maxVisible can never drift from reality (the #66 bug class).
const CARD_HEIGHT = 7;
// Non-card rows: title(1) + margin(1) + col-header(3) + footer-margin(1) + footer(1) = 7.
// The maxVisible formula subtracts 2 more for the up/down scroll indicator lines that appear while scrolling.
const FIXED_ROWS = 7;
// Minimum readable column width; below this the board no longer fills the terminal but stays usable.
const MIN_COL_WIDTH = 16;
// Horizontal gap between columns (Column marginRight).
const COLUMN_GAP = 1;

/**
 * Pure layout derivation from terminal size. Exported for unit testing (like clampScroll).
 * maxVisible is exact because CARD_HEIGHT is an enforced invariant; columnWidth fills the
 * terminal width across the four status columns (clamped to MIN_COL_WIDTH on narrow terminals).
 */
export function computeLayout(rows: number, cols: number): { maxVisible: number; columnWidth: number; cardWidth: number } {
  const maxVisible = Math.max(1, Math.floor((rows - FIXED_ROWS - 2) / CARD_HEIGHT));
  const columnWidth = Math.max(MIN_COL_WIDTH, Math.floor(cols / ISSUE_STATUSES.length) - COLUMN_GAP);
  const cardWidth = columnWidth - 2;
  return { maxVisible, columnWidth, cardWidth };
}

const STATUS_COLORS: Record<IssueStatus, string> = {
  idea: "gray",
  ready: "cyan",
  doing: "yellow",
  done: "green",
};

function Card({ issue, selected, width }: { issue: IssueView; selected: boolean; width: number }) {
  const badge = STATUS_COLORS[issue.status];
  const indicators = [issue.hasSpec ? "S" : "", issue.hasLog ? "L" : ""].filter(Boolean).join(" ");
  return (
    <Box
      flexDirection="column"
      borderStyle={selected ? "double" : "single"}
      borderColor={selected ? "cyan" : undefined}
      paddingX={1}
      marginBottom={1}
      width={width}
      height={CARD_HEIGHT - 1}
      flexShrink={0}
    >
      <Box>
        <Text bold dimColor>#{issue.id} </Text>
        <Text color={badge}>[{issue.status}]</Text>
      </Box>
      <Text wrap="truncate-end">{issue.title}</Text>
      <Text dimColor wrap="truncate-end">{issue.sprint || " "}</Text>
      <Text dimColor wrap="truncate-end">{indicators || " "}</Text>
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
  columnWidth,
  cardWidth,
}: {
  status: IssueStatus;
  issues: IssueView[];
  focused: boolean;
  selectedRow: number;
  scrollOffset: number;
  maxVisible: number;
  columnWidth: number;
  cardWidth: number;
}) {
  const color = STATUS_COLORS[status];
  const visibleIssues = issues.slice(scrollOffset, scrollOffset + maxVisible);
  const hiddenAbove = scrollOffset;
  const hiddenBelow = Math.max(0, issues.length - scrollOffset - maxVisible);
  return (
    <Box flexDirection="column" width={columnWidth} marginRight={COLUMN_GAP} flexShrink={0}>
      <Box borderStyle="single" borderColor={focused ? "cyan" : undefined} paddingX={1}>
        <Text color={color} bold>{status.toUpperCase()}</Text>
        <Text dimColor> ({issues.length})</Text>
      </Box>
      {hiddenAbove > 0 && <Text dimColor>  ↑ {hiddenAbove} more</Text>}
      {visibleIssues.map((issue, i) => (
        <Card key={issue.id} issue={issue} selected={focused && (i + scrollOffset) === selectedRow} width={cardWidth} />
      ))}
      {hiddenBelow > 0 && <Text dimColor>  ↓ {hiddenBelow} more</Text>}
    </Box>
  );
}

const HELP_TEXT = [
  "Q / Esc  quit",
  "S        sprint board",
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
  /** @internal test injection — overrides terminal-height-based calculation */
  maxVisibleCards?: number;
  /** @internal test injection — preset scroll positions */
  initialScrollOffsets?: number[];
  /** @internal test injection — poll interval for on-disk changes; 0 disables */
  refreshIntervalMs?: number;
}

const REFRESH_INTERVAL_MS = 1000;

export function KanbanApp({ data: initialData, plan: initialPlan, cwd, maxVisibleCards: maxVisibleProp, initialScrollOffsets, refreshIntervalMs = REFRESH_INTERVAL_MS }: KanbanAppProps) {
  const [data, setData] = useState(initialData);
  const [plan, setPlan] = useState(initialPlan);
  // Which view (sprint name, or null = backlog) the user is looking at, so a refresh can re-select it.
  // `undefined` = the default view (active sprint, else backlog), which keeps following the plan.
  const [viewSprint, setViewSprint] = useState<string | null | undefined>(undefined);
  const [showSprintBoard, setShowSprintBoard] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [nav, setNav] = useState<NavState>(() => {
    const firstNonEmpty = ISSUE_STATUSES.findIndex((s) => (initialData.columns[s]?.length ?? 0) > 0);
    return { colIndex: firstNonEmpty < 0 ? 0 : firstNonEmpty, rowIndex: 0 };
  });
  const [scrollOffsets, setScrollOffsets] = useState(initialScrollOffsets ?? ISSUE_STATUSES.map(() => 0));
  const [detail, setDetail] = useState<{ issue: IssueView; spec: string | null; log: ProgressEntry[] } | null>(null);
  const { exit } = useApp();
  const { stdout } = useStdout();

  // Track terminal size reactively so the board re-flows on resize.
  const [dims, setDims] = useState({ rows: stdout?.rows ?? 24, cols: stdout?.columns ?? 80 });
  useEffect(() => {
    if (!stdout) return;
    const onResize = () => setDims({ rows: stdout.rows ?? 24, cols: stdout.columns ?? 80 });
    stdout.on("resize", onResize);
    return () => { stdout.off("resize", onResize); };
  }, [stdout]);

  const { maxVisible: layoutMaxVisible, columnWidth, cardWidth } = computeLayout(dims.rows, dims.cols);
  const maxVisible = maxVisibleProp ?? layoutMaxVisible;

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
    setViewSprint(newData.sprintName);
    const firstNonEmpty = ISSUE_STATUSES.findIndex((s) => (newData.columns[s]?.length ?? 0) > 0);
    setNav({ colIndex: firstNonEmpty < 0 ? 0 : firstNonEmpty, rowIndex: 0 });
    setScrollOffsets(ISSUE_STATUSES.map(() => 0));
  };

  // Latest values for the polling closure, which outlives any single render.
  const live = useRef({ data, nav, viewSprint, maxVisible });
  live.current = { data, nav, viewSprint, maxVisible };

  useEffect(() => {
    if (!cwd || refreshIntervalMs <= 0) return;
    let last = fingerprint(cwd);
    const timer = setInterval(() => {
      const current = fingerprint(cwd);
      if (current === last) return;
      const fresh = refreshViewData(cwd);
      if (!fresh) return; // caught mid-write; fingerprint unchanged so we retry next tick
      last = current;
      const { data: old, nav: oldNav, viewSprint: sprint, maxVisible: mv } = live.current;
      const newData = sprint === undefined ? buildKanbanData(fresh.plan) : selectKanbanView(fresh.plan, sprint);
      // Keep the cursor on the same issue if it still exists in the view, else clamp in place.
      const followed = ISSUE_STATUSES.flatMap((status, colIndex) =>
        newData.columns[status].map((issue, rowIndex) => ({ id: issue.id, colIndex, rowIndex })));
      const focusedId = old.columns[ISSUE_STATUSES[oldNav.colIndex]!]?.[oldNav.rowIndex]?.id;
      const hit = followed.find((f) => f.id === focusedId);
      const colIndex = hit?.colIndex ?? oldNav.colIndex;
      const colLen = newData.columns[ISSUE_STATUSES[colIndex]!].length;
      const newNav = { colIndex, rowIndex: hit?.rowIndex ?? Math.max(0, Math.min(oldNav.rowIndex, colLen - 1)) };
      setPlan(fresh.plan);
      setData(newData);
      if (sprint !== undefined) setViewSprint(newData.sprintName);
      setNav(newNav);
      setScrollOffsets((prev) => {
        const next = prev.map((offset, i) => {
          const len = newData.columns[ISSUE_STATUSES[i]!].length;
          return Math.max(0, Math.min(offset, Math.max(0, len - mv)));
        });
        next[newNav.colIndex] = clampScroll(next[newNav.colIndex]!, newNav.rowIndex, mv);
        return next;
      });
    }, refreshIntervalMs);
    return () => clearInterval(timer);
  }, [cwd, refreshIntervalMs]);

  const columnCounts = (): number[] => ISSUE_STATUSES.map((s) => data.columns[s].length);

  useInput((input, key) => {
    if (detail !== null) return;
    if (showSprintBoard) return;
    if (input === "q" || input === "Q" || key.escape) {
      exit();
      return;
    }
    if (input === "?") {
      setShowHelp((h) => !h);
      return;
    }
    if (input === "s" || input === "S") {
      if (data.allSprints.length > 0) setShowSprintBoard(true);
      return;
    }
    if ((input === "b" || input === "B") && plan) {
      resetView(selectKanbanView(plan, null));
      return;
    }
    if (key.leftArrow) {
      const newNav = moveLeft(nav, columnCounts());
      setNav(newNav);
      setScrollOffsets((prev) => updateScroll(newNav, prev));
      return;
    }
    if (key.rightArrow) {
      const newNav = moveRight(nav, columnCounts());
      setNav(newNav);
      setScrollOffsets((prev) => updateScroll(newNav, prev));
      return;
    }
    if (key.upArrow) {
      const newNav = moveUp(nav, columnCounts());
      setNav(newNav);
      setScrollOffsets((prev) => updateScroll(newNav, prev));
      return;
    }
    if (key.downArrow) {
      const newNav = moveDown(nav, columnCounts());
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

  if (showSprintBoard) {
    return (
      <SprintBoard
        sprints={data.allSprints}
        selected={data.sprintName}
        rows={dims.rows}
        cols={dims.cols}
        onSelect={(name) => {
          resetView(selectKanbanView(plan ?? { sprints: data.allSprints, backlog: [] }, name));
          setShowSprintBoard(false);
        }}
        onCancel={() => setShowSprintBoard(false)}
      />
    );
  }

  return (
    <Box flexDirection="column" height={dims.rows} width={dims.cols}>
      <Box marginBottom={1} flexShrink={0}>
        <Text bold>scrummy kanban</Text>
        {data.sprintName !== null && (
          <>
            <Text dimColor> — sprint: </Text>
            <Text color="cyan">{data.sprintName}</Text>
          </>
        )}
        {data.sprintName === null && <Text dimColor> — backlog</Text>}
      </Box>
      <Box flexDirection="row" flexGrow={1}>
        {ISSUE_STATUSES.map((status, colIdx) => (
          <Column
            key={status}
            status={status}
            issues={data.columns[status]}
            focused={nav.colIndex === colIdx}
            selectedRow={nav.rowIndex}
            scrollOffset={scrollOffsets[colIdx] ?? 0}
            maxVisible={maxVisible}
            columnWidth={columnWidth}
            cardWidth={cardWidth}
          />
        ))}
      </Box>
      <Box marginTop={1} flexShrink={0}>
        {showHelp
          ? <Text dimColor>{HELP_TEXT}</Text>
          : <Text dimColor>Q quit  S sprint board  B backlog  ←→↑↓ navigate  Enter detail  ? help</Text>}
      </Box>
    </Box>
  );
}

export { buildViewData };

export function view(cwd: string): void {
  const { plan, data } = buildViewData(cwd);
  render(<KanbanApp data={data} plan={plan} cwd={cwd} />);
}
