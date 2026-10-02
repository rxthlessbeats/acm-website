# acm-website

Landing page for [agent-cowork-memory](https://github.com/rxthlessbeats/agent-cowork-memory), with a simulated delegation demo in Switchboard and Herdr TUI views. The four current integrations are demo participants; more integrations are planned.

```sh
npm install
npm run dev     # http://localhost:3000
SITE_URL=https://your.domain npm run build   # static export in out/
```

Demo scripts live in `app/scenarios.ts`: add a preset there, no UI changes needed.
The `/docs` page covers setup, workflows and all eight MCP tools. Tool examples and argument descriptions live in `app/tool-docs.ts`.

With Playwright, Chromium and `@axe-core/playwright` available, run `npm run check:demo` against the dev server. If those tools are installed elsewhere, set `NODE_PATH` to their `node_modules` directory. Set `ACM_URL` to test another server and `ACM_SCREENSHOTS` to save review screenshots.
