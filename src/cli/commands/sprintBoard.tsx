import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { SprintStatus } from "../../domain/types.js";
import type { SprintGroup } from "../../reader/plan.js";
import { groupSprintsByStatus, SPRINT_COLUMN_ORDER } from "./kanban.js";
import { moveLeft, moveRight, moveUp, moveDown, clampScroll, type NavState } from "./navigation.js";

// Enforced card footprint: border-top + name + goal + counts + border-bottom = 5 (the bordered
// rows), plus marginBottom = 1, so the rendered footprint EQUALS SPRINT_CARD_HEIGHT by construction.
// Every variable row truncates to one line, so maxVisible can never drift from reality (the #66 class).
const SPRINT_CARD_HEIGHT = 6;
// Non-card rows: title(1) + margin(1) + col-header(3) + footer-margin(1) + footer(1) = 7. The
// maxVisible formula subtracts 2 more for the up/down scroll indicator lines that appear while scrolling.
const FIXED_ROWS = 7;
const MIN_COL_WIDTH = 16;
const COLUMN_GAP = 1;

const COLUMN_COLORS: Record<SprintStatus, string> = {
  active: "yellow",
  planned: "cyan",
  done: "green",
};

/**
 * Pure layout derivation from terminal size (mirrors view.tsx's computeLayout for the issue
 * board). maxVisible is exact because SPRINT_CARD_HEIGHT is an enforced invariant; columnWidth
 * fills the terminal width across the three state columns (clamped to MIN_COL_WIDTH).
 */
export function computeSprintLayout(rows: number, cols: number): {
  maxVisible: number;
  columnWidth: number;
  cardWidth: number;
} {
  const maxVisible = Math.max(1, Math.floor((rows - FIXED_ROWS - 2) / SPRINT_CARD_HEIGHT));
  const columnWidth = Math.max(
    MIN_COL_WIDTH,
    Math.floor(cols / SPRINT_COLUMN_ORDER.length) - COLUMN_GAP,
  );
  return { maxVisible, columnWidth, cardWidth: columnWidth - 2 };
}

// The board is always fed a plan built with { done: true } (see buildViewData), so
// sprint.issues includes done issues — these counts are over the full issue set, matching
// the derived status. A done-filtered plan would under-count and show a done sprint as 0/0.
function doneTotal(sprint: SprintGroup): { done: number; total: number } {
  const total = sprint.issues.length;
  const done = sprint.issues.filter((i) => i.status === "done").length;
  return { done, total };
}

function SprintCard({ sprint, selected, width }: { sprint: SprintGroup; selected: boolean; width: number }) {
  const { done, total } = doneTotal(sprint);
  return (
    <Box
      flexDirection="column"
      borderStyle={selected ? "double" : "single"}
      borderColor={selected ? "cyan" : undefined}
      paddingX={1}
      marginBottom={1}
      width={width}
      height={SPRINT_CARD_HEIGHT - 1}
      flexShrink={0}
    >
      <Text bold wrap="truncate-end">{sprint.name}</Text>
      <Text dimColor wrap="truncate-end">{sprint.goal || " "}</Text>
      <Text dimColor wrap="truncate-end">{done}/{total} done</Text>
    </Box>
  );
}

function SprintColumn({
  status,
  sprints,
  focused,
  selectedRow,
  scrollOffset,
  maxVisible,
  columnWidth,
  cardWidth,
}: {
  status: SprintStatus;
  sprints: SprintGroup[];
  focused: boolean;
  selectedRow: number;
  scrollOffset: number;
  maxVisible: number;
  columnWidth: number;
  cardWidth: number;
}) {
  const visible = sprints.slice(scrollOffset, scrollOffset + maxVisible);
  const hiddenAbove = scrollOffset;
  const hiddenBelow = Math.max(0, sprints.length - scrollOffset - maxVisible);
  return (
    <Box flexDirection="column" width={columnWidth} marginRight={COLUMN_GAP} flexShrink={0}>
      <Box borderStyle="single" borderColor={focused ? "cyan" : undefined} paddingX={1}>
        <Text color={COLUMN_COLORS[status]} bold>{status.toUpperCase()}</Text>
        <Text dimColor> ({sprints.length})</Text>
      </Box>
      {hiddenAbove > 0 && <Text dimColor>  ↑ {hiddenAbove} more</Text>}
      {visible.map((sprint, i) => (
        <SprintCard
          key={sprint.name}
          sprint={sprint}
          selected={focused && i + scrollOffset === selectedRow}
          width={cardWidth}
        />
      ))}
      {hiddenBelow > 0 && <Text dimColor>  ↓ {hiddenBelow} more</Text>}
    </Box>
  );
}

interface SprintBoardProps {
  sprints: SprintGroup[];
  selected: string | null;
  onSelect: (name: string) => void;
  onCancel: () => void;
  rows: number;
  cols: number;
  /** @internal test injection — overrides terminal-height-based calculation */
  maxVisibleCards?: number;
  /** @internal test injection — preset scroll positions */
  initialScrollOffsets?: number[];
}

/**
 * Sprint-overview board: sprints laid out in three columns by derived state —
 * ACTIVE | PLANNED | DONE. Structural layout pinned to the terminal (fixed header/footer,
 * bounded card heights, per-column scroll) so the header never scrolls off and the selected
 * card is always visible. Enter drills into the selected sprint's issue board.
 */
export function SprintBoard({
  sprints,
  selected,
  onSelect,
  onCancel,
  rows,
  cols,
  maxVisibleCards,
  initialScrollOffsets,
}: SprintBoardProps) {
  const columns = groupSprintsByStatus(sprints);
  const counts = SPRINT_COLUMN_ORDER.map((s) => columns[s].length);

  const { maxVisible: layoutMaxVisible, columnWidth, cardWidth } = computeSprintLayout(rows, cols);
  const maxVisible = maxVisibleCards ?? layoutMaxVisible;

  const [nav, setNav] = useState<NavState>(() => {
    const firstNonEmpty = counts.findIndex((n) => n > 0);
    return { colIndex: firstNonEmpty < 0 ? 0 : firstNonEmpty, rowIndex: 0 };
  });
  const [scrollOffsets, setScrollOffsets] = useState(
    initialScrollOffsets ?? SPRINT_COLUMN_ORDER.map(() => 0),
  );

  const focusedSprint = (): SprintGroup | undefined =>
    columns[SPRINT_COLUMN_ORDER[nav.colIndex]]?.[nav.rowIndex];

  const applyNav = (newNav: NavState) => {
    setNav(newNav);
    setScrollOffsets((prev) => {
      const next = [...prev];
      next[newNav.colIndex] = clampScroll(next[newNav.colIndex] ?? 0, newNav.rowIndex, maxVisible);
      return next;
    });
  };

  useInput((_, key) => {
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.leftArrow) return applyNav(moveLeft(nav, counts));
    if (key.rightArrow) return applyNav(moveRight(nav, counts));
    if (key.upArrow) return applyNav(moveUp(nav, counts));
    if (key.downArrow) return applyNav(moveDown(nav, counts));
    if (key.return) {
      const sprint = focusedSprint();
      if (sprint) onSelect(sprint.name);
    }
  });

  return (
    <Box flexDirection="column" height={rows} width={cols}>
      <Box marginBottom={1} flexShrink={0}>
        <Text bold>scrummy sprints</Text>
        <Text dimColor> — by state</Text>
      </Box>
      <Box flexDirection="row" flexGrow={1}>
        {SPRINT_COLUMN_ORDER.map((status, colIdx) => (
          <SprintColumn
            key={status}
            status={status}
            sprints={columns[status]}
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
        <Text dimColor>←→↑↓ navigate  Enter open sprint  Esc back</Text>
      </Box>
    </Box>
  );
}
