export type Worker = "codex" | "cursor" | "opencode";
export type AgentId = "claude" | Worker;

export type Step =
  | { t: "say"; text: string }
  | { t: "tool"; name: string; args: string }
  | { t: "line"; text: string; tone?: "ok" | "err" | "dim" }
  | { t: "hold"; files: string[] }
  | { t: "edit"; file: string; diff: string }
  | { t: "wait"; ms: number }
  | { t: "approve"; ask: string };

export type Scenario = {
  id: string;
  label: string;
  prompt: string;
  files: string[];
  intro: string;
  briefs: Record<Worker, string>;
  workers: Record<Worker, Step[]>;
  summary: string;
};

export const AGENTS: Record<AgentId, { name: string; mode: string }> = {
  claude: { name: "Claude Code", mode: "--permission-mode auto" },
  codex: { name: "Codex", mode: "--approve-for-me" },
  cursor: { name: "Cursor", mode: "--auto-review" },
  opencode: { name: "OpenCode", mode: "--auto" },
};

export const WORKERS: Worker[] = ["codex", "cursor", "opencode"];

export const SCENARIOS: Scenario[] = [
  {
    id: "ratelimit",
    label: "Rate-limit login",
    prompt:
      "Tell codex to add rate limiting to /api/login, cursor to write the tests for it, and opencode to update the API docs.",
    files: [
      "src/middleware/rateLimit.ts",
      "src/routes/login.ts",
      "tests/login.rateLimit.test.ts",
      "docs/api/auth.md",
    ],
    intro:
      "Three separate pieces of work, three agents. I'll brief each one, give them their own files, and wait.",
    briefs: {
      codex: "Add a sliding-window limiter to POST /api/login: 5 tries / 15 min per IP + username.",
      cursor: "Cover the limiter: allowed, blocked, window reset, and the Retry-After header.",
      opencode: "Document the 429 response and the Retry-After header in docs/api/auth.md.",
    },
    workers: {
      codex: [
        { t: "say", text: "Reading src/routes/login.ts. There's no middleware chain yet, so I'll add one." },
        { t: "hold", files: ["src/middleware/rateLimit.ts", "src/routes/login.ts"] },
        { t: "say", text: "Keying on ip + lowercased username, so one attacker can't lock out every account." },
        { t: "edit", file: "src/middleware/rateLimit.ts", diff: "+48" },
        { t: "edit", file: "src/routes/login.ts", diff: "+3 −1" },
        { t: "line", text: "$ npm run typecheck", tone: "dim" },
        { t: "line", text: "✓ 0 errors", tone: "ok" },
      ],
      cursor: [
        { t: "say", text: "Waiting on codex's limiter signature, so I'll start with the fixtures." },
        { t: "hold", files: ["tests/login.rateLimit.test.ts"] },
        { t: "wait", ms: 900 },
        { t: "say", text: "Faking the clock with vi.useFakeTimers() to test the 15-minute window." },
        { t: "edit", file: "tests/login.rateLimit.test.ts", diff: "+74" },
        { t: "line", text: "$ npx vitest run tests/login", tone: "dim" },
        { t: "line", text: "✓ 4 passed (312ms)", tone: "ok" },
      ],
      opencode: [
        { t: "say", text: "Found the auth docs. Adding a Rate limits section after Errors." },
        { t: "hold", files: ["docs/api/auth.md"] },
        { t: "edit", file: "docs/api/auth.md", diff: "+21 −2" },
        { t: "say", text: "Added a curl example that shows the 429 and the Retry-After: 900 header." },
      ],
    },
    summary:
      "All three are done. Codex added the limiter (5 tries per 15 min, keyed on IP + username). Cursor's 4 tests pass. OpenCode documented the 429. No two agents touched the same file.",
  },
  {
    id: "checkout",
    label: "Fix flaky checkout",
    prompt:
      "Have codex fix the flaky checkout test and add the missing index, cursor refactor the cart reducer, and opencode bump the outdated deps.",
    files: [
      "tests/checkout.test.ts",
      "db/migrations/0042_orders_idx.sql",
      "src/store/cart.ts",
      "package.json",
    ],
    intro:
      "Codex takes the flaky test and the migration, Cursor the reducer, OpenCode the deps. Starting all three.",
    briefs: {
      codex: "checkout.test.ts fails ~1 in 5 runs. Find why. Add the orders(user_id) index it needs.",
      cursor: "Split the cart reducer into pure helpers. No behaviour change, keep the snapshot tests green.",
      opencode: "Bump outdated minor/patch deps. Skip majors. Run the test suite after.",
    },
    workers: {
      codex: [
        { t: "say", text: "The test seeds orders without awaiting the insert, so it races the read." },
        { t: "hold", files: ["tests/checkout.test.ts", "db/migrations/0042_orders_idx.sql"] },
        { t: "edit", file: "tests/checkout.test.ts", diff: "+2 −2" },
        { t: "edit", file: "db/migrations/0042_orders_idx.sql", diff: "+3" },
        { t: "line", text: "$ npm run db:migrate", tone: "dim" },
        { t: "approve", ask: "run npm run db:migrate on the dev database" },
        { t: "line", text: "✓ 0042_orders_idx applied", tone: "ok" },
        { t: "line", text: "✓ checkout.test.ts: 20/20 runs green", tone: "ok" },
      ],
      cursor: [
        { t: "say", text: "The reducer is a 180-line switch. Pulling each case into a named helper." },
        { t: "hold", files: ["src/store/cart.ts"] },
        { t: "edit", file: "src/store/cart.ts", diff: "+64 −97" },
        { t: "line", text: "$ npx vitest run src/store", tone: "dim" },
        { t: "line", text: "✓ 11 passed, snapshots unchanged", tone: "ok" },
      ],
      opencode: [
        { t: "say", text: "7 outdated packages: 5 minor or patch, 2 major. Skipping the majors as briefed." },
        { t: "hold", files: ["package.json"] },
        { t: "edit", file: "package.json", diff: "+5 −5" },
        { t: "line", text: "$ npm test", tone: "dim" },
        { t: "line", text: "✓ 142 passed", tone: "ok" },
      ],
    },
    summary:
      "Done. The flake was an un-awaited seed insert. Codex fixed it and applied the index after you approved. Cursor cut the reducer by 33 lines with snapshots unchanged. OpenCode bumped 5 deps and left vite 7 and zod 4 for you to decide.",
  },
];
