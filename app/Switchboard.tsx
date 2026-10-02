"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Mark } from "./Mark";
import { AGENTS, SCENARIOS, WORKERS, type AgentId, type Scenario, type Step, type Worker } from "./scenarios";

type Entry =
  | { k: "user" | "say" | "brief"; text: string }
  | { k: "line"; text: string; tone?: "ok" | "err" | "dim" }
  | { k: "tool"; name: string; args: string }
  | { k: "edit"; file: string; diff: string }
  | { k: "delegate"; items: [Worker, string][] }
  | { k: "wait" }
  | { k: "alert"; worker: Worker; ask: string; ok: boolean };

type Status = "idle" | "working" | "needs_approval" | "done";
type Wire = "idle" | "out" | "live" | "alert" | "back" | "done";
type Lock = { by: Worker; diff?: string; released?: boolean };
type Phase = "typing" | "ready" | "running" | "done";

const STEPS: [string, string][] = [
  ["Ask", "You ask Claude. One prompt, three jobs."],
  ["Brief", "Claude briefs each agent through acm · delegate."],
  ["Claim", "Each agent claims its files in the ledger, then works."],
  ["Report", "Results flow back into Claude's chat."],
  ["Summary", "Claude sums it up. Nothing was copy-pasted."],
];

const EMPTY_LOGS = (): Record<AgentId, Entry[]> => ({ claude: [], codex: [], cursor: [], opencode: [] });
const ALL = <T,>(v: T) => ({ codex: v, cursor: v, opencode: v });
const CANCEL = Symbol("cancel");
// Per-agent token pace (ms), so the three workers visibly stream at different speeds.
const PACE: Record<AgentId, number> = { claude: 26, codex: 34, cursor: 42, opencode: 30 };

export default function Switchboard() {
  const [view, setView] = useState<"switchboard" | "herdr">("switchboard");
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<Phase>("typing");
  const [logs, setLogs] = useState(EMPTY_LOGS);
  const [status, setStatus] = useState<Record<Worker, Status>>(ALL("idle"));
  const [wire, setWire] = useState<Record<Worker, Wire>>(ALL("idle"));
  const [locks, setLocks] = useState<Record<string, Lock>>({});
  const [focus, setFocus] = useState<Worker | null>(null);
  const [visible, setVisible] = useState(false);
  const [announce, setAnnounce] = useState("");

  const run = useRef(0);
  const approve = useRef<(() => void) | null>(null);
  const reduced = useRef(false);
  const frame = useRef<HTMLDivElement>(null);
  const scen: Scenario = SCENARIOS[idx];

  useEffect(() => {
    reduced.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { threshold: 0.1 });
    if (frame.current) io.observe(frame.current);
    return () => {
      io.disconnect();
      run.current++;
      approve.current?.();
    };
  }, []);

  // Sleep that rejects if a newer run has started, which cancels the whole chain.
  const sleep = useCallback((ms: number) => {
    const id = run.current;
    return new Promise<void>((res, rej) =>
      setTimeout(() => (id === run.current ? res() : rej(CANCEL)), reduced.current ? 0 : ms),
    );
  }, []);

  const reset = useCallback((i: number) => {
    run.current++;
    approve.current?.();
    approve.current = null;
    setIdx(i);
    setTyped("");
    setPhase("typing");
    setLogs(EMPTY_LOGS());
    setStatus(ALL("idle"));
    setWire(ALL("idle"));
    setLocks({});
    setFocus(null);
  }, []);

  // Type the preset prompt into the composer once the demo is on screen.
  useEffect(() => {
    if (!visible || phase !== "typing") return;
    const id = run.current;
    const text = SCENARIOS[idx].prompt;
    let i = 0;
    const tick = () => {
      if (id !== run.current) return;
      i = reduced.current ? text.length : Math.min(text.length, i + 1 + (Math.random() * 2) | 0);
      setTyped(text.slice(0, i));
      if (i < text.length) setTimeout(tick, 18 + Math.random() * 30);
      else setPhase("ready");
    };
    const t = setTimeout(tick, 400);
    return () => clearTimeout(t);
  }, [visible, phase, idx]);

  const push = (a: AgentId, e: Entry) => setLogs((l) => ({ ...l, [a]: [...l[a], e] }));

  const stream = async (a: AgentId, k: "say" | "brief", text: string) => {
    push(a, { k, text: "" });
    const tokens = text.match(/\s*\S{1,5}/g) ?? [text];
    let out = "";
    for (const tok of tokens) {
      out += tok;
      const now = out;
      setLogs((l) => {
        const arr = l[a].slice();
        arr[arr.length - 1] = { k, text: now };
        return { ...l, [a]: arr };
      });
      await sleep(PACE[a] + Math.random() * PACE[a]);
    }
  };

  const doStep = async (w: Worker, s: Step) => {
    switch (s.t) {
      case "say":
        return stream(w, "say", s.text);
      case "line":
        push(w, s.tone ? { k: "line", text: s.text, tone: s.tone } : { k: "line", text: s.text });
        return sleep(s.tone === "dim" ? 700 : 350);
      case "hold":
        push(w, { k: "tool", name: "context", args: `hold=[${s.files.map((f) => `"${f.split("/").pop()}"`).join(", ")}]` });
        setLocks((l) => ({ ...l, ...Object.fromEntries(s.files.map((f) => [f, { by: w }])) }));
        return sleep(550);
      case "edit":
        push(w, { k: "edit", file: s.file, diff: s.diff });
        setLocks((l) => ({ ...l, [s.file]: { by: w, diff: s.diff } }));
        return sleep(500);
      case "wait":
        return sleep(s.ms);
      case "approve": {
        setStatus((x) => ({ ...x, [w]: "needs_approval" }));
        setWire((x) => ({ ...x, [w]: "alert" }));
        setAnnounce(`${AGENTS[w].name} needs approval`);
        push(w, { k: "line", text: `✕ auto mode denied: ${s.ask}`, tone: "err" });
        push("claude", { k: "alert", worker: w, ask: s.ask, ok: false });
        const id = run.current;
        await new Promise<void>((res) => (approve.current = res));
        if (id !== run.current) throw CANCEL;
        setLogs((l) => ({
          ...l,
          claude: l.claude.map((e) => (e.k === "alert" && e.worker === w ? { ...e, ok: true } : e)),
        }));
        setStatus((x) => ({ ...x, [w]: "working" }));
        setWire((x) => ({ ...x, [w]: "live" }));
        push(w, { k: "line", text: "← approved via claude", tone: "dim" });
        return sleep(600);
      }
    }
  };

  const runWorker = async (w: Worker, i: number) => {
    await sleep(400 + i * 520);
    setStatus((x) => ({ ...x, [w]: "working" }));
    setWire((x) => ({ ...x, [w]: "live" }));
    await stream(w, "brief", scen.briefs[w]);
    await sleep(350);
    for (const s of scen.workers[w]) await doStep(w, s);
    setLocks((l) =>
      Object.fromEntries(Object.entries(l).map(([f, v]) => [f, v.by === w ? { ...v, released: true } : v])),
    );
    setStatus((x) => ({ ...x, [w]: "done" }));
    setWire((x) => ({ ...x, [w]: "back" }));
    setAnnounce(`${AGENTS[w].name} is done`);
  };

  const start = async () => {
    if (phase !== "ready") return;
    const id = ++run.current;
    setPhase("running");
    setAnnounce("Claude is delegating");
    try {
      push("claude", { k: "user", text: scen.prompt });
      await sleep(600);
      await stream("claude", "say", scen.intro);
      await sleep(300);
      push("claude", { k: "delegate", items: WORKERS.map((w) => [w, scen.briefs[w]]) });
      setWire(ALL("out"));
      await sleep(900);
      push("claude", { k: "wait" });
      await Promise.all(WORKERS.map(runWorker));
      await sleep(1000);
      setWire(ALL("done"));
      await stream("claude", "say", scen.summary);
      if (id === run.current) {
        setPhase("done");
        setAnnounce("All agents done. Claude posted a summary.");
      }
    } catch (e) {
      if (e !== CANCEL) throw e;
    }
  };

  const startRef = useRef(start);
  startRef.current = start;
  useEffect(() => {
    if (phase !== "ready") return;
    const onKey = (e: KeyboardEvent) => {
      const r = frame.current?.getBoundingClientRect();
      const onScreen = r && r.top < innerHeight && r.bottom > 0;
      const typing = (e.target as HTMLElement).closest?.("button, a, input, textarea");
      if (e.key === "Enter" && onScreen && !typing) startRef.current();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [phase]);

  const doneCount = WORKERS.filter((w) => status[w] === "done").length;
  const step =
    phase === "done" || WORKERS.every((w) => wire[w] === "done")
      ? 4
      : doneCount === WORKERS.length
        ? 3
        : Object.keys(locks).length
          ? 2
          : logs.claude.some((e) => e.k === "delegate")
            ? 1
            : 0;
  const blocked = WORKERS.find((w) => status[w] === "needs_approval");
  const caption = blocked
    ? `${AGENTS[blocked].name} hit a guarded action. Approve it from Claude's chat.`
    : STEPS[step][1];

  const composer = (
    <div className="composer">
      <div className="composer-text" aria-label="Demo prompt" role="textbox" aria-readonly="true">
        {(phase === "typing" || phase === "ready") && typed}
        {phase === "typing" && <span className="caret" />}
        {phase === "running" && <span className="composer-busy">Claude is working · {doneCount}/{WORKERS.length} agents done</span>}
        {phase === "done" && <span className="composer-busy">Run complete. Try the other prompt or replay.</span>}
      </div>
      {phase === "done" ? (
        <button className="send" onClick={() => reset(idx)}>Replay <span aria-hidden="true">↻</span></button>
      ) : (
        <button className="send" onClick={start} disabled={phase !== "ready"} data-armed={phase === "ready"}>
          Send <kbd aria-hidden="true">⏎</kbd>
        </button>
      )}
    </div>
  );

  return (
    <div
      className="sb"
      ref={frame}
      data-phase={phase}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
    >
      <div className="demo-view-tabs" role="tablist" aria-label="Demo view" onKeyDown={onTabKey}>
        {(["switchboard", "herdr"] as const).map((v) => (
          <button key={v} id={`view-${v}`} role="tab" aria-selected={view === v} aria-controls="demo-panel"
            tabIndex={view === v ? 0 : -1} onClick={() => setView(v)}>
            {v === "herdr" ? "Herdr TUI" : "Switchboard"}
          </button>
        ))}
        <span>Simulated demo</span>
      </div>
      <div className="sb-presets" role="group" aria-label="Preset prompts">
        {SCENARIOS.map((s, i) => (
          <button
            key={s.id}
            aria-pressed={i === idx}
            className="chip"
            onClick={() => i !== idx && reset(i)}
          >
            <span className="chip-n">0{i + 1}</span>
            {s.label}
          </button>
        ))}
        <p className="sb-caption" data-alert={!!blocked} key={caption}>
          {caption}
        </p>
        <ol className="steps" aria-label="Progress">
          {STEPS.map(([label], i) => (
            <li key={label} data-state={i < step ? "past" : i === step ? "now" : "next"} aria-current={i === step ? "step" : undefined}>
              <span>0{i + 1}</span>
              {label}
            </li>
          ))}
        </ol>
      </div>

      <div id="demo-panel" role="tabpanel" aria-labelledby={`view-${view}`}>
      {view === "herdr" ? (
        <Herdr key={scen.id} logs={logs} status={status} phase={phase} doneCount={doneCount} composer={composer} onApprove={() => approve.current?.()} />
      ) : (
      <div className="sb-grid">
        <section className="pane pane-claude" aria-label="Claude Code, the orchestrator">
          <PaneHead agent="claude" role="orchestrator" state={phase === "running" ? "working" : phase === "done" ? "done" : "idle"} />
          <Log entries={logs.claude} agent="claude" status={status} doneCount={doneCount} onApprove={() => approve.current?.()} />
          {composer}
        </section>

        <Wires wire={wire} focus={focus} />

        <div className="workers">
          {WORKERS.map((w) => (
            <section
              key={w}
              className="pane pane-worker"
              data-agent={w}
              data-status={status[w]}
              data-focus={focus === w ? "on" : focus ? "off" : undefined}
              aria-label={`${AGENTS[w].name}, ${status[w].replace("_", " ")}`}
            >
              <button className="pane-hit" onClick={() => setFocus(focus === w ? null : w)} aria-expanded={focus === w}>
                <PaneHead agent={w} role={AGENTS[w].mode} state={status[w]} />
              </button>
              <Log entries={logs[w]} agent={w} status={status} doneCount={doneCount} />
            </section>
          ))}
        </div>
      </div>

      )}
      </div>

      <div className="ledger" aria-label="File claims ledger">
        <div className="ledger-label">
          <span>ledger</span>
          <small>file claims</small>
        </div>
        {scen.files.map((f) => {
          const l = locks[f];
          return (
            <div key={f} className="ledger-row" data-agent={l?.by} data-state={l ? (l.released ? "released" : "held") : "free"}>
              <code className="ledger-file">
                <span>{f.slice(0, f.lastIndexOf("/") + 1)}</span>
                {f.slice(f.lastIndexOf("/") + 1)}
              </code>
              <span className="ledger-who">
                {l ? (
                  <>
                    <Mark agent={l.by} size={10} />
                    {l.released ? "released" : "held"} · {l.by}
                    {l.diff && <Diff d={l.diff} />}
                  </>
                ) : (
                  "free"
                )}
              </span>
            </div>
          );
        })}
      </div>
      <p className="sr" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}

// Demo views use the standard arrow, Home and End keyboard controls.
function onTabKey(e: React.KeyboardEvent<HTMLDivElement>) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
  const tabs = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const i = tabs.indexOf(e.target as HTMLButtonElement);
  const next = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1
    : (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  e.preventDefault();
  tabs[next].focus();
  tabs[next].click();
}

function Herdr({ logs, status, phase, doneCount, composer, onApprove }: {
  logs: Record<AgentId, Entry[]>;
  status: Record<Worker, Status>;
  phase: Phase;
  doneCount: number;
  composer: React.ReactNode;
  onApprove: () => void;
}) {
  const [focused, setFocused] = useState<AgentId>("claude");
  const agents: AgentId[] = ["claude", ...WORKERS];
  const states: Record<AgentId, Status> = { ...status, claude: phase === "running" ? "working" : phase === "done" ? "done" : "idle" };
  const select = (a: AgentId) => {
    setFocused(a);
    const pane = document.getElementById(`herdr-pane-${a}`);
    pane?.focus({ preventScroll: true });
    if (matchMedia("(max-width: 900px)").matches) pane?.scrollIntoView({ block: "nearest" });
  };

  return (
    <div className="herdr" aria-label="Herdr terminal workspace">
      <aside className="herdr-sidebar" aria-label="Workspace and agents">
        <div className="herdr-spaces">
          <p className="herdr-sidebar-title">spaces</p>
          <button className="herdr-space" onClick={() => select("claude")}>
            <span className="herdr-dot" data-state={states.claude} aria-hidden="true">●</span>
            <span><strong>acme-api</strong><small>main</small></span>
          </button>
        </div>
        <div className="herdr-agents">
          <p className="herdr-sidebar-title"><span>agents</span><span>grouped</span></p>
          {agents.map((a) => (
            <button key={a} className="herdr-agent" aria-pressed={focused === a} data-state={states[a]} data-agent={a}
              onClick={() => select(a)}>
              <span className="herdr-dot" data-state={states[a]} aria-hidden="true">{states[a] === "idle" ? "○" : states[a] === "needs_approval" ? "◉" : "●"}</span>
              <span><strong>{a === "claude" ? "acme-api" : a}</strong><small>{states[a] === "needs_approval" ? "blocked" : states[a]} · {a}</small></span>
            </button>
          ))}
        </div>
      </aside>
      <div className="herdr-main">
        <div className="herdr-tabs" role="tablist" aria-label="Herdr terminals">
          <button id="terminal-acm" role="tab" aria-selected="true" aria-controls="herdr-panes"
            onClick={() => select("claude")}>acm</button>
        </div>
        <div id="herdr-panes" className="herdr-panes" role="tabpanel" aria-labelledby="terminal-acm">
          {agents.map((a) => (
            <section key={a} id={`herdr-pane-${a}`} className="herdr-pane" tabIndex={-1} data-title={a} data-focused={focused === a} data-agent={a}
              aria-label={`${AGENTS[a].name} terminal`} onPointerDown={() => setFocused(a)} onFocus={() => setFocused(a)}>
              <div className="herdr-terminal-intro">
                {a === "claude" && (
                  <svg className="herdr-claude-art" width="54" height="36" viewBox="0 0 18 6" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">
                    <path fill="currentColor" d="M3 0h12v1H3z M3 1h2v1H3z M6 1h6v1H6z M13 1h2v1h-2z M1 2h16v1H1z M3 3h12v1H3z M4 4h1v1H4z M6 4h1v1H6z M11 4h1v1h-1z M13 4h1v1h-1z" />
                  </svg>
                )}
                <div><strong>{AGENTS[a].name}</strong><span>~/acme-api</span></div>
              </div>
              <Log entries={logs[a]} agent={a} status={status} doneCount={doneCount} onApprove={onApprove} />
              {a === "claude" ? composer : (
                <div className="herdr-terminal-prompt"><span aria-hidden="true">›</span> {states[a] === "working" ? "Working…" : states[a] === "needs_approval" ? "Waiting for approval in Claude's chat" : states[a] === "done" ? "Task complete" : "Waiting for a brief"}</div>
              )}
              <div className="herdr-terminal-status">{AGENTS[a].mode} <span>· {states[a].replace("_", " ")}</span></div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function Diff({ d }: { d: string }) {
  return (
    <b className="diff">
      {d.split(" ").map((p) => (
        <span key={p} data-sign={p[0]}>
          {p}
        </span>
      ))}
    </b>
  );
}

function PaneHead({ agent, role, state }: { agent: AgentId; role: string; state: Status | "idle" }) {
  return (
    <header className="pane-head" data-agent={agent}>
      <Mark agent={agent} />
      <strong>{AGENTS[agent].name}</strong>
      <span className="pane-role">{role}</span>
      <span className="pane-state" data-state={state}>
        <i />
        {state.replace("_", " ")}
      </span>
    </header>
  );
}

function Log({
  entries,
  agent,
  status,
  doneCount,
  onApprove,
}: {
  entries: Entry[];
  agent: AgentId;
  status: Record<Worker, Status>;
  doneCount: number;
  onApprove?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && follow.current) el.scrollTop = el.scrollHeight;
  });
  return (
    <div className="log" ref={ref} data-agent={agent} tabIndex={0} role="region" aria-label={`${AGENTS[agent].name} transcript`}
      onScroll={(e) => { const el = e.currentTarget; follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
      {entries.length === 0 && (
        <p className="log-empty">{agent === "claude" ? "~/acme-api · main" : "idle · waiting for a brief"}</p>
      )}
      {entries.map((e, i) => {
        switch (e.k) {
          case "user":
            return (
              <p key={i} className="e-user">
                <span aria-hidden="true">›</span> {e.text}
              </p>
            );
          case "say":
            return (
              <p key={i} className="e-say">
                {e.text}
              </p>
            );
          case "brief":
            return (
              <p key={i} className="e-brief">
                <span>← brief from claude</span>
                {e.text}
              </p>
            );
          case "line":
            return (
              <p key={i} className="e-line" data-tone={e.tone}>
                {e.text}
              </p>
            );
          case "tool":
            return (
              <p key={i} className="e-tool">
                <i>●</i> acm · {e.name}
                <span>({e.args})</span>
              </p>
            );
          case "edit":
            return (
              <p key={i} className="e-edit">
                <span aria-hidden="true">✎</span> {e.file} <Diff d={e.diff} />
              </p>
            );
          case "delegate":
            return (
              <div key={i} className="e-delegate">
                <p className="e-tool">
                  <i>●</i> acm · delegate<span>(tasks={e.items.length} · herdr panes)</span>
                </p>
                <ul>
                  {e.items.map(([w, b]) => (
                    <li key={w} data-agent={w}>
                      <Mark agent={w} size={10} />
                      <b>{w}</b>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          case "wait":
            return (
              <div key={i} className="e-wait" data-done={doneCount === WORKERS.length}>
                <p className="e-tool">
                  <i>●</i> acm · delegate_wait<span>({doneCount}/{WORKERS.length} done)</span>
                </p>
                <div className="e-wait-row">
                  {WORKERS.map((w) => (
                    <span key={w} data-agent={w} data-status={status[w]}>
                      <Mark agent={w} size={9} />
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            );
          case "alert":
            return (
              <div key={i} className="e-alert" data-ok={e.ok}>
                <p>
                  <b>{e.ok ? "approved" : "needs_approval"}</b> · {e.worker} wants to {e.ask}
                </p>
                {!e.ok && (
                  <button className="approve" onClick={onApprove}>
                    Approve
                  </button>
                )}
              </div>
            );
        }
      })}
    </div>
  );
}

// SVG wires from Claude's port to each worker card, measured from the live layout.
function Wires({ wire, focus }: { wire: Record<Worker, Wire>; focus: Worker | null }) {
  const self = useRef<SVGSVGElement & HTMLDivElement>(null);
  const [paths, setPaths] = useState<Record<Worker, { d: string; x: number; y: number }> | null>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const root = self.current?.parentElement;
    if (!root) return;
    const measure = () => {
      const r = root.getBoundingClientRect();
      const c = root.querySelector(".pane-claude")!.getBoundingClientRect();
      const cards = [...root.querySelectorAll<HTMLElement>(".pane-worker")];
      if (getComputedStyle(root).display !== "grid" || c.right >= cards[0].getBoundingClientRect().left) {
        return setPaths(null);
      }
      const x1 = c.right - r.left;
      const y1 = c.top - r.top + c.height * 0.42;
      const next = {} as Record<Worker, { d: string; x: number; y: number }>;
      cards.forEach((el, i) => {
        const b = el.getBoundingClientRect();
        const x2 = b.left - r.left;
        const y2 = b.top - r.top + 22;
        const dx = (x2 - x1) * 0.55;
        next[WORKERS[i]] = { d: `M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`, x: x2, y: y2 };
      });
      setOrigin({ x: x1, y: y1 });
      setBox({ w: r.width, h: r.height });
      setPaths(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    root.querySelectorAll(".pane-worker").forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [focus]);

  if (!paths) return <div className="wires" ref={self} aria-hidden="true" />;
  return (
    <svg className="wires" ref={self} width={box.w} height={box.h} viewBox={`0 0 ${box.w} ${box.h}`} aria-hidden="true">
      {WORKERS.map((w) => (
        <g key={w} data-agent={w} data-wire={wire[w]}>
          <path className="w-base" d={paths[w].d} />
          <path className="w-live" d={paths[w].d} pathLength={1} />
          <path key={wire[w]} className="w-comet" d={paths[w].d} pathLength={1} />
          <circle className="w-port" cx={paths[w].x} cy={paths[w].y} r="3.5" />
        </g>
      ))}
      <circle className="w-port w-origin" cx={origin.x} cy={origin.y} r="4.5" />
    </svg>
  );
}
