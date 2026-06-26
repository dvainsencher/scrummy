import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { SprintGroup } from "../../reader/plan.js";

interface SprintPickerProps {
  sprints: SprintGroup[];
  selected: string | null;
  onSelect: (name: string) => void;
  onCancel: () => void;
}

export function SprintPicker({ sprints, selected, onSelect, onCancel }: SprintPickerProps) {
  const [cursor, setCursor] = useState(() => {
    const idx = sprints.findIndex((s) => s.name === selected);
    return idx >= 0 ? idx : 0;
  });

  useInput((_, key) => {
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1));
      return;
    }
    if (key.downArrow) {
      setCursor((c) => Math.min(sprints.length - 1, c + 1));
      return;
    }
    if (key.return) {
      const sprint = sprints[cursor];
      if (sprint) onSelect(sprint.name);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="double" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold>Select sprint</Text>
      </Box>
      {sprints.map((s, i) => (
        <Box key={s.name}>
          <Text color={i === cursor ? "cyan" : undefined} bold={i === cursor}>
            {i === cursor ? "▶ " : "  "}
            {s.name}
            {s.status === "active" && <Text color="green"> (active)</Text>}
            {s.status === "done" && <Text dimColor> (done)</Text>}
            {s.status === "planned" && <Text dimColor> (planned)</Text>}
          </Text>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text dimColor>↑↓ navigate  Enter select  Esc cancel</Text>
      </Box>
    </Box>
  );
}
