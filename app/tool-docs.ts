// Argument names follow the v0.3.0 MCP server. ACM knows the chat; repo_path is optional.
export const TOOL_DOCS = [
  {
    name: "context",
    description: "Your thread, its timeline, the project's notes, open threads, recent jobs, and held files.",
    call: 'context(hold=["src/routes/login.ts"])',
    result: "thread  login limiter\nheld   src/routes/login.ts\nstale  1 note to re-check",
    params: [
      ["repo_path", "Optional. The project folder. Defaults to the folder the agent started ACM in."],
      ["hold", "Optional. Repo-relative paths to claim, added to what you hold. [] releases yours."],
      ["thread", "Optional. Join that thread, from open threads or your brief."],
      ["done", "Optional. true closes your thread."],
    ],
    detail:
      "Call before working and again before editing a file. After the first call, notes include only what is new. A path in busy belongs to someone else; leave it. stale lists notes whose files changed: re-check each with note_add.",
  },
  {
    name: "note_add",
    description: "Saves a note every agent sees, and shows notes it may contradict.",
    call: 'note_add(text="Chose Postgres over SQLite", tier="long")',
    result: "saved · long\ncheck  1 note on the same topic",
    params: [
      ["text", "Required. The note to share with the project."],
      ["tier", 'Optional. "short" (default, kept 7 days) or "long" for decisions and conventions.'],
      ["supersedes", "Optional. The note this one replaces, confirms, or corrects."],
      ["repo_path", "Optional. The project folder."],
    ],
    detail:
      "If the result has check, those notes are on the same topic. When yours makes one false, call again with supersedes set to its id. Job results are saved already; do not copy them into notes.",
  },
  {
    name: "note_search",
    description: "Finds notes and delegated jobs' results.",
    call: 'note_search(query="database")',
    result: '1 note\n  "Chose Postgres over SQLite"  long',
    params: [
      ["query", "Required. Text to search for."],
      ["repo_path", "Optional. The project folder."],
    ],
    detail: "Search before asking someone to repeat a decision. Results include notes and the results of delegated jobs.",
  },
  {
    name: "chats",
    description: "Lists recent chats from every agent in the project, and marks the ones ACM started.",
    call: "chats(limit=20)",
    result: 'codex   12m  "rate limit login"   job\ncursor   2h  "fix cart reducer"',
    params: [
      ["limit", "Optional. Maximum chats to return; defaults to 20."],
      ["repo_path", "Optional. The project folder."],
    ],
    detail:
      "Returns the agent, chat id, last update, folder, thread, first message, and job when ACM started the chat. Pass the chat the user picks to resume.",
  },
  {
    name: "resume",
    description: "Asks which chat to continue when there are several, then reads it and joins its thread.",
    call: 'resume(source="codex")',
    result: "2 chats from codex. Which one?\n  1  rate limit login · 12m\n  2  flaky checkout · 3h",
    params: [
      ["source", "Optional. One agent: codex, cursor, claude, or opencode."],
      ["chat", "Optional. The chat id the user chose."],
      ["repo_path", "Optional. The project folder."],
    ],
    detail:
      "If the result contains choose, show the choices and wait. Call resume again with that chat id. Never choose for them. A resolved chat returns its recent messages and puts you on that chat's thread.",
  },
  {
    name: "delegate",
    description: "Starts other agents with a brief, in Herdr panes or in the background, and waits.",
    call: 'delegate(\n  summary="Add rate limiting to login",\n  tasks=[{\n    "to": "codex",\n    "task": "Add the login limiter",\n    "done_when": "Login returns 429 after 5 attempts"\n  }]\n)',
    result: "codex   started\ncursor  busy · one agent per kind per folder",
    params: [
      ["summary", "Required. The problem, understandable without this chat."],
      ["tasks", "Required. Briefs with to and task. done_when, context, and wait are optional."],
      ["repo_path", "Optional. The project folder."],
    ],
    detail:
      "Targets are codex, claude, cursor, and opencode, one of each kind per folder. A busy agent comes back busy: ask whether to wait or reassign, and never choose. If the result has next, keep calling delegate_wait. Copy the card at the start of the result into the reply.",
  },
  {
    name: "delegate_wait",
    description: "Keeps waiting on this chat's delegated agents.",
    call: "delegate_wait()",
    result: "codex   done\ncursor  needs_approval · run the migration",
    params: [["repo_path", "Optional. The project folder."]],
    detail:
      "Waits up to 45 seconds more and reports each job. Call again while jobs are running. For needs_approval, bring the action back to the user. For blocked, tell them what needs an answer in the agent's Herdr pane. Copy the card into the reply.",
  },
];
