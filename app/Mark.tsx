import type { AgentId } from "./scenarios";

// One geometric glyph per agent, drawn in the agent's signal colour.
const SHAPES: Record<AgentId, React.ReactNode> = {
  claude: (
    <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" />
    </g>
  ),
  codex: <path d="M12 2.5 21.5 12 12 21.5 2.5 12z" fill="currentColor" />,
  cursor: <path d="M12 3 21.5 20.5h-19z" fill="currentColor" />,
  opencode: <rect x="4" y="4" width="16" height="16" fill="currentColor" />,
};

export function Mark({ agent, size = 14 }: { agent: AgentId; size?: number }) {
  return (
    <svg
      className="mark"
      data-agent={agent}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {SHAPES[agent]}
    </svg>
  );
}
