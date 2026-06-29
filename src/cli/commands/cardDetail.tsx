import React, { useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import type { IssueView } from "../../reader/plan.js";
import type { ProgressEntry } from "../../domain/types.js";

const ENTRY_COLORS: Record<string, string> = {
  plan: "blue",
  verified: "green",
  pending: "yellow",
};

// Rows consumed by the fixed chrome: border(2) + paddingY(2) + title+margin(2) + status+margin(2) + footer+margin(2)
// plus 2 reserved for the ↑/↓ indicator lines that appear when content overflows (both may show simultaneously).
const FIXED_ROWS = 12;

interface ContentLine {
  text: string;
  color?: string;
  bold?: boolean;
  dimColor?: boolean;
}

interface CardDetailProps {
  issue: IssueView;
  spec: string | null;
  log: ProgressEntry[];
  onClose: () => void;
}

export function CardDetail({ issue, spec, log, onClose }: CardDetailProps) {
  const { stdout } = useStdout();
  const termRows = stdout?.rows ?? 24;
  const [scrollOffset, setScrollOffset] = useState(0);

  const contentLines: ContentLine[] = [];
  if (spec !== null) {
    contentLines.push({ text: "── spec ──", bold: true, dimColor: true });
    spec.split("\n").forEach((line) => contentLines.push({ text: line }));
  }
  if (log.length > 0) {
    if (spec !== null) contentLines.push({ text: "" });
    contentLines.push({ text: "── log ──", bold: true, dimColor: true });
    log.forEach((entry) =>
      contentLines.push({ text: `[${entry.type}] ${entry.message}`, color: ENTRY_COLORS[entry.type] ?? "white" })
    );
  }

  const maxContentLines = Math.max(1, termRows - FIXED_ROWS);
  const maxScroll = Math.max(0, contentLines.length - maxContentLines);

  useInput((_, key) => {
    if (key.upArrow) { setScrollOffset((o) => Math.max(0, o - 1)); return; }
    if (key.downArrow) { setScrollOffset((o) => Math.min(maxScroll, o + 1)); return; }
    if (key.escape || key.return) onClose();
  });

  const visibleLines = contentLines.slice(scrollOffset, scrollOffset + maxContentLines);
  const hiddenAbove = scrollOffset;
  const hiddenBelow = Math.max(0, contentLines.length - scrollOffset - maxContentLines);

  return (
    <Box flexDirection="column" borderStyle="double" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold>#{issue.id} </Text>
        <Text>{issue.title}</Text>
      </Box>
      <Box marginBottom={1}>
        <Text dimColor>status: </Text>
        <Text>{issue.status}</Text>
        <Text dimColor>  sprint: </Text>
        <Text>{issue.sprint || "(backlog)"}</Text>
      </Box>

      {hiddenAbove > 0 && <Text dimColor>  ↑ {hiddenAbove} more</Text>}
      <Box flexDirection="column">
        {visibleLines.map((line, i) => (
          <Text key={i} color={line.color} bold={line.bold} dimColor={line.dimColor}>
            {line.text}
          </Text>
        ))}
      </Box>
      {hiddenBelow > 0 && <Text dimColor>  ↓ {hiddenBelow} more</Text>}

      <Box marginTop={1}>
        <Text dimColor>↑↓ scroll   Esc / Enter  close</Text>
      </Box>
    </Box>
  );
}
