import { Copy } from "./Copy";
import Link from "next/link";
import { Mark } from "./Mark";
import Switchboard from "./Switchboard";
import { AGENTS, type AgentId } from "./scenarios";

const INSTALL = "npx -y agent-cowork-memory setup";
const GITHUB = "https://github.com/rxthlessbeats/agent-cowork-memory";
const NPM = "https://www.npmjs.com/package/agent-cowork-memory";
const ORDER: AgentId[] = ["claude", "codex", "cursor", "opencode"];

const RELAY = ["briefs the team", "holds rateLimit.ts", "writes the tests", "updates the docs"];

const VERBS = [
  {
    word: "Continue",
    body: "Every agent can see every chat in the project. Start in Codex, pick it up in Cursor, with nothing pasted across.",
    say: "Use ACM to continue from Codex.",
  },
  {
    word: "Delegate",
    body: "One agent briefs the others. Each one claims the files it edits so they never collide, then reports back.",
    say: "Tell codex to write plan.md, and claude to write packing.md.",
  },
  {
    word: "Remember",
    body: "Track a task, record a decision, and find it again later, whichever agent you happen to be in.",
    say: "Use ACM to remember we chose Postgres over SQLite.",
  },
];

const MODES: Record<AgentId, string> = {
  claude: "Safe actions run on their own. A denied one comes back to you as needs_approval.",
  codex: "Approves its own safe steps. Anything riskier waits for you.",
  cursor: "Auto-review runs safe actions and stops on the rest.",
  opencode: "No auto-review mode, so it approves anything not explicitly denied.",
};

function Index({ n, label }: { n: string; label: string }) {
  return (
    <p className="idx">
      <span className="idx-n">{n}</span>
      <span className="idx-rule" />
      <span>{label}</span>
    </p>
  );
}

export default function Page() {
  return (
    <>
      <div className="grain" aria-hidden="true" />
      <nav className="nav">
        <a href="#top" className="logo">
          <b className="logo-word">acm<span className="logo-cursor" aria-hidden="true">_</span></b>
          <span className="logo-name">agent cowork memory</span>
        </a>
        <div className="nav-links">
          <a className="desktop-link" href="#demo">Demo</a>
          <a className="desktop-link" href="#how">How</a>
          <Link href="/docs">Docs</Link>
          <a className="desktop-link" href={GITHUB}>GitHub ↗</a>
        </div>
        <a className="nav-cta" href="#install">
          Install
        </a>
      </nav>

      <main id="top">
        <header className="hero">
          <p className="hero-eyebrow">
            <span className="pulse" aria-hidden="true" />
            MCP server + CLI for coding agents<span className="hide-sm"> · v0.3.0</span>
          </p>
          <div className="hero-top">
            <h1 className="hero-title">
              <span className="ln">One chat,</span>
              <span className="ln"><span className="title-gradient">your</span> agents,</span>
              <span className="ln">no copy-paste.</span>
            </h1>
            <ol className="relay" aria-hidden="true">
              <span className="relay-line">
                <span className="relay-packet" />
              </span>
              {ORDER.map((a, i) => (
                <li key={a} className="relay-node" data-agent={a} style={{ "--i": i } as React.CSSProperties}>
                  <span className="relay-dot">
                    <Mark agent={a} size={16} />
                  </span>
                  <span>
                    <b>{AGENTS[a].name}</b>
                    <small>{RELAY[i]}</small>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="hero-foot">
            <p className="hero-lede">
              Tired of copying a chat into the next agent? Pick up the same task where you left off, or tell one
              agent to put the others to work.
            </p>
            <div className="hero-install">
              <Copy text={INSTALL} />
              <a className="hero-demo" href="#demo">
                Watch a delegation <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>

        </header>

        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {[0, 1].map((k) => (
              <span key={k}>
                {ORDER.map((a) => (
                  <span key={a} className="marquee-item" data-agent={a}>
                    {AGENTS[a].name}
                    <Mark agent={a} size={28} />
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>

        <section id="demo" className="section demo">
          <Index n="01" label="Interactive demo" />
          <div className="demo-head">
            <h2 className="h2">
              Ask one.
              <br />
              <span className="title-accent">Watch</span> the team work.
            </h2>
            <p className="demo-note">
              Follow a simulated run with Claude Code, Codex, Cursor and OpenCode. Switch to Herdr to see the same
              work in its terminal layout, or click a pane to look closer.
            </p>
          </div>
          <Switchboard />
        </section>

        <section id="how" className="section verbs">
          <Index n="02" label="What it does" />
          {VERBS.map((v, i) => (
            <article key={v.word} className="verb">
              <span className="verb-n">0{i + 1}</span>
              <h3 className="verb-word">
                <span>{v.word}</span>
                <span className="verb-hover" aria-hidden="true">{v.word}</span>
              </h3>
              <p>{v.body}</p>
              <q>{v.say}</q>
            </article>
          ))}
        </section>

        <section className="section agents">
          <Index n="03" label="Works with" />
          <div className="agents-grid">
            {ORDER.map((a) => (
              <article key={a} className="agent" data-agent={a}>
                <Mark agent={a} size={40} />
                <h3>{AGENTS[a].name}</h3>
                <code>{AGENTS[a].mode}</code>
                <p>{MODES[a]}</p>
              </article>
            ))}
          </div>
          <p className="agents-compatibility">
            These are the agents supported today and featured in the demo. More agent integrations are planned.
          </p>
          <p className="agents-note">
            With <a href="https://herdr.dev">herdr</a> installed, every delegated agent gets its own pane you can
            watch: <code>herdr session attach acm</code>
          </p>
        </section>

        <footer id="install" className="foot">
          <Index n="04" label="Install" />
          <div className="foot-grid">
            <h2 className="foot-title">
              Stop pasting
              <br />
              chats <span className="title-accent">around.</span>
            </h2>
            <div className="foot-install">
              <Copy text={INSTALL} className="cmd-xl" />
              <dl className="foot-alt">
                <dt>manual</dt>
                <dd>
                  <Copy text="npx -y agent-cowork-memory mcp --harness claude" />
                </dd>
              </dl>
              <p className="foot-note">Needs Node 24 or newer. Setup adds ACM to every agent it finds. Restart them afterwards. <Link href="/docs#setup">Read the setup guide.</Link></p>
            </div>
          </div>
          <div className="foot-links">
            <a href={GITHUB}>GitHub ↗</a>
            <a href={NPM}>npm ↗</a>
            <Link href="/docs">Docs</Link>
            <span>MIT license</span>
            <span>Node 24+</span>
          </div>
        </footer>
      </main>
    </>
  );
}
