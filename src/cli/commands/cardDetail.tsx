import React from "react";
import { Box, Text, useInput } from "ink";
import type { IssueView } from "../../reader/plan.js";
import type { ProgressEntry } from "../../domain/types.js";

const ENTRY_COLORS: Record<string, string> = {
  plan: "blue",
  verified: "green",
  pending: "yellow",
};

interface CardDetailProps {
  issue: IssueView;
  spec: string | null;
  log: ProgressEntry[];
  onClose: () => void;
}

export function CardDetail({ issue, spec, log, onClose }: CardDetailProps) {
  useInput((_, key) => {
    if (key.escape || key.return) onClose();
  });

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

      {spec !== null && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold dimColor>── spec ──</Text>
          <Text>{spec}</Text>
        </Box>
      )}

      {log.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold dimColor>── log ──</Text>
          {log.map((entry, i) => (
            <Box key={i} marginBottom={0}>
              <Text color={ENTRY_COLORS[entry.type] ?? "white"}>[{entry.type}] </Text>
              <Text>{entry.message}</Text>
            </Box>
          ))}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>Esc / Enter  close</Text>
      </Box>
    </Box>
  );
}
