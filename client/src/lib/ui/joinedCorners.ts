const CORNERS = {
  md: ["rounded-md", "rounded-b-md", "rounded-t-md", ""],
  panel: ["rounded-panel", "rounded-b-panel", "rounded-t-panel", ""],
} as const;

export const joinedCorners = (above: boolean, below: boolean, size: keyof typeof CORNERS = "md"): string =>
  CORNERS[size][(above ? 1 : 0) + (below ? 2 : 0)];
