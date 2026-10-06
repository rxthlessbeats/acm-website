import type { Metadata } from "next";
import Link from "next/link";
import { Copy } from "../Copy";
import { Tools } from "../Tools";
import { TOOL_DOCS } from "../tool-docs";

export const metadata: Metadata = {
  title: "Docs · ACM",
  description: "Set up Agent Cowork Memory, continue work across agents, delegate tasks, and use all seven MCP tools.",
  openGraph: {
    title: "Docs · ACM",
    description: "Setup, workflows and the ACM MCP tool reference.",
  },
};

export default function Docs() {
  return (
    <>
      <nav className="nav" aria-label="Main navigation">
        <Link href="/" className="logo">
          <b className="logo-word">acm<span className="logo-cursor" aria-hidden="true">_</span></b>
          <span className="logo-name">agent cowork memory</span>
        </Link>
        <div className="nav-links">
          <Link href="/" className="desktop-link">Home</Link>
          <Link href="/docs" aria-current="page">Docs</Link>
          <a className="desktop-link" href="https://github.com/rxthlessbeats/agent-cowork-memory">GitHub ↗</a>
        </div>
        <Link href="/#demo" className="nav-cta">Try the demo</Link>
      </nav>
      <main className="docs">
        <header className="docs-header">
          <p className="idx">Documentation</p>
          <h1>Keep the work moving.</h1>
          <p>Set up ACM once. Continue a chat in another agent, share a decision, or put the team to work.</p>
        </header>
        <div className="docs-layout">
          <nav className="docs-index" aria-label="On this page">
            <a href="#setup">Setup</a>
            <a href="#workflows">Everyday use</a>
            <a href="#tools">MCP tools</a>
            {TOOL_DOCS.map((t) => <a key={t.name} href={`#${t.name}`}><code>{t.name}</code></a>)}
            <Link href="/#demo">Back to the demo</Link>
          </nav>
          <div className="docs-content">
            <section id="setup" className="doc-section">
              <h2>Setup</h2>
              <p>You need <a href="https://nodejs.org">Node 24</a> or newer. Run:</p>
              <Copy text="npx agent-cowork-memory setup" />
              <p>Setup adds ACM to Cursor, and to Codex, Claude Code, and OpenCode when they are installed. It says which it skipped. Installed one later? Run setup again. Restart your agents, and ACM is available in every project. Each agent starts ACM through npx, which runs the latest release when the npm registry answers within 3 seconds.</p>
              <p>Coming from 0.2? 0.3 starts a fresh database (<code>~/.agent-cowork-memory/acm.sqlite3</code>). 0.2&apos;s notes stay in <code>state.sqlite3</code>, untouched, and are not carried over.</p>
              <h3>Watch delegated work in Herdr</h3>
              <p>With <a href="https://herdr.dev/">Herdr</a> installed, delegated agents get their own terminal panes. Attach to ACM&apos;s session:</p>
              <Copy text="herdr session attach acm" />
              <p>Without Herdr, delegated agents run in the background and ACM still reports their results.</p>
            </section>

            <section id="workflows" className="doc-section">
              <h2>Everyday use</h2>
              <p>Ask your agent in plain language. It calls the tools for you.</p>
              <h3>Continue another chat</h3>
              <blockquote>Use ACM to continue from Codex.</blockquote>
              <p>If several chats match, pick one from the list your agent shows. It reads that chat and joins its thread.</p>
              <h3>Delegate work</h3>
              <blockquote>Tell codex to add rate limiting to /api/login, cursor to write the tests, and opencode to update the docs.</blockquote>
              <p>Each agent gets a brief, claims the files it edits and reports back. ACM supports one agent of each kind per folder. The demo uses the current four integrations; that is not a permanent limit on compatibility.</p>
              <p>If a job needs approval, the delegating agent brings the requested action back to you. If it asks a question in a Herdr pane, answer there. ACM&apos;s <code>delegate_wait</code> tool reports those states; it does not approve actions.</p>
              <h3>Remember a decision</h3>
              <blockquote>Use ACM to remember we chose Postgres over SQLite.</blockquote>
              <p>Later, ask an agent to search ACM for the database decision. Durable notes use the long tier; short progress notes expire after seven days by default.</p>
            </section>

            <section id="tools" className="doc-section doc-tools">
              <h2>MCP tools</h2>
              <p>The seven tools below are calls your agent makes. ACM already knows which chat it is in, and <code>repo_path</code> defaults to the project folder. Preview results are abbreviated for readability.</p>
              <Tools />
            </section>

            {TOOL_DOCS.map((t) => (
              <section key={t.name} id={t.name} className="doc-section doc-tool">
                <h2><code>{t.name}</code><a href={`#${t.name}`} aria-label={`Link to ${t.name}`}>#</a></h2>
                <p>{t.description}</p>
                <p>{t.detail}</p>
                <div className="doc-table-scroll" role="region" aria-label={`${t.name} arguments`} tabIndex={0}>
                  <table>
                    <caption className="sr">{t.name} arguments</caption>
                    <thead><tr><th scope="col">Argument</th><th scope="col">Use</th></tr></thead>
                    <tbody>{t.params.map(([name, use]) => <tr key={name}><th scope="row"><code>{name}</code></th><td>{use}</td></tr>)}</tbody>
                  </table>
                </div>
                <pre tabIndex={0} role="region" aria-label={`${t.name} example`}><code>{t.call}</code></pre>
              </section>
            ))}
            <footer className="docs-footer">
              <Link href="/#demo">Try a delegation</Link>
              <a href="https://github.com/rxthlessbeats/agent-cowork-memory">Source and releases ↗</a>
            </footer>
          </div>
        </div>
      </main>
    </>
  );
}
