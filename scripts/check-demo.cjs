// Run against a running site, with Playwright and axe available in NODE_PATH.
const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const base = process.env.ACM_URL || "http://127.0.0.1:3000";
const screenshots = process.env.ACM_SCREENSHOTS;
const workers = ["codex", "cursor", "opencode"];
const tools = ["chats", "resume", "attach", "context", "note_add", "note_search", "delegate", "delegate_wait"];

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    async function capture(name, selector) {
      if (!screenshots) return;
      fs.mkdirSync(screenshots, { recursive: true });
      await (selector ? page.locator(selector) : page).screenshot({ path: path.join(screenshots, `${name}.png`) });
    }
    async function load(route = "/") {
      const response = await page.goto(base + route, { waitUntil: "networkidle" });
      assert.equal(response.status(), 200, route);
      await page.evaluate(() => document.fonts.ready);
    }
    async function ready() {
      await page.locator(".sb").scrollIntoViewIfNeeded();
      await page.waitForSelector('.sb[data-phase="ready"]', { timeout: 15000 });
    }
    async function finished() {
      await page.waitForSelector('.sb[data-phase="done"]', { timeout: 60000 });
      assert.equal(await page.locator('.ledger-row[data-state="released"]').count(), 4);
      assert.match(await page.locator(".steps [aria-current]").innerText(), /Summary/);
    }
    async function audit(label) {
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .options({ rules: { "label-content-name-mismatch": { enabled: true } } }).analyze();
      assert.deepEqual(result.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), [], label);
    }

    await load();
    assert.equal(await page.locator("#tools").count(), 0, "tool reference moved off homepage");
    assert.equal((await page.locator("h1").innerText()).replace(/\s+/g, " "), "One chat, your agents, no copy-paste.");
    assert.match(await page.locator("h1").evaluate(el => getComputedStyle(el).fontFamily), /JetBrains/);
    assert.equal(await page.locator("h1").evaluate(el => getComputedStyle(el).fontStyle), "normal");
    assert.ok(await page.locator("h1").evaluate(el => parseFloat(getComputedStyle(el).fontSize) <= 112), "smaller hero");
    await page.waitForTimeout(1500);
    await capture("hero-desktop");
    await ready();
    await page.locator("#view-switchboard").focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator("#view-herdr").getAttribute("aria-selected"), "true");
    await page.keyboard.press("Home");
    assert.equal(await page.locator("#view-switchboard").getAttribute("aria-selected"), "true");
    await page.locator(".send").click();
    await page.waitForSelector('.ledger-row[data-state="held"]', { timeout: 25000 });
    await page.locator("#view-herdr").click();
    assert.equal(await page.locator(".sb").getAttribute("data-phase"), "running", "switch keeps run");
    assert.equal(await page.locator('.herdr-tabs [role="tab"]').count(), 1, "one shared workspace tab");
    assert.equal(await page.locator("#terminal-acm").innerText(), "acm");
    assert.equal(await page.locator(".herdr-pane:visible").count(), 4, "all four agents share the tab");
    assert.equal(await page.locator("svg.herdr-claude-art:visible").count(), 1, "Claude character renders without font glyphs");
    await capture("herdr-working", ".herdr");
    await finished();
    await capture("herdr-desktop", ".herdr");
    assert.match(await page.locator('.herdr-pane[data-agent="claude"] .log').innerText(), /All three are done/);
    assert.ok(await page.locator('.herdr-pane[data-agent="claude"] .log').evaluate(el => el.scrollHeight - el.scrollTop - el.clientHeight < 3), "summary stays in view");
    for (const w of workers) {
      await page.locator(`.herdr-agent[data-agent="${w}"]`).click();
      assert.equal(await page.locator(".herdr-pane:visible").count(), 4);
      const pane = page.locator(`.herdr-pane[data-agent="${w}"]`);
      assert.equal(await pane.getAttribute("data-focused"), "true");
      assert.match(await pane.locator(".herdr-terminal-prompt").innerText(), /Task complete/);
      assert.ok((await pane.locator(".e-edit").count()) > 0, `${w} work appears`);
    }
    await page.locator("#terminal-acm").click();
    await audit("Herdr desktop accessibility");
    await page.locator("#view-switchboard").click();
    assert.equal(await page.locator('.pane-worker[data-status="done"]').count(), 3);
    await page.locator(".send").click();
    assert.equal(await page.locator(".ledger-row[data-state='free']").count(), 4, "replay releases old state");
    console.log("PASS normal playback, shared views, four panes, replay and accessibility");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await load();
    await ready();
    await page.locator(".chip").nth(1).click();
    await ready();
    await page.locator("#view-herdr").click();
    await page.locator(".send").click();
    await page.waitForSelector(".approve");
    assert.equal(await page.locator('.herdr-agent[data-state="needs_approval"]').count(), 1);
    await page.locator("#view-switchboard").click();
    await page.locator(".approve").click();
    await finished();
    assert.match(await page.locator('.pane-claude .log').innerText(), /after you approved/);

    // Reset while approval is pending, then run again: no stale worker may write into it.
    await page.locator(".send").click();
    await ready();
    await page.locator(".send").click();
    await page.waitForSelector(".approve");
    await page.locator("#view-herdr").click();
    await page.locator('.herdr-agent[data-agent="cursor"]').click();
    await page.locator(".chip").first().click();
    await ready();
    assert.equal(await page.locator('.herdr-pane[data-agent="claude"]').getAttribute("data-focused"), "true", "new scenario restores composer");
    await page.locator(".send").click();
    await finished();
    assert.equal(await page.locator(".approve").count(), 0);
    console.log("PASS approval across views, reduced motion and reset during approval");

    await page.locator('.nav-links a[href="/docs"]').click();
    await page.waitForURL("**/docs");
    assert.equal(await page.locator(".doc-tool").count(), tools.length);
    for (const name of tools) {
      await page.locator(".tools-list button").filter({ has: page.locator("code", { hasText: new RegExp(`^${name}$`) }) }).click();
      assert.equal(await page.locator(".tool-preview b").innerText(), name);
      assert.ok(await page.locator(`#${name} tbody tr`).count() > 0);
      assert.ok(await page.locator(`#${name} > pre`).innerText());
    }
    await page.locator(".tool-usage-link").click();
    assert.equal(new URL(page.url()).hash, "#delegate_wait");
    await audit("Docs accessibility");
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await capture("docs-desktop");

    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ["/", "/docs"]) {
        await load(route);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${route} overflow at ${width}px`);
        assert.ok(await page.locator('.nav-links a[href="/docs"]').isVisible(), "Docs reachable on mobile");
        if (width === 390) await capture(route === "/" ? "hero-mobile" : "docs-mobile");
        if (route === "/") {
          await ready();
          await page.locator("#view-herdr").click();
          assert.equal(await page.locator('.herdr-tabs [role="tab"]').count(), 1);
          assert.equal(await page.locator(".herdr-pane:visible").count(), 4, `four panes at ${width}px`);
          assert.equal(await page.locator(".herdr").evaluate(el => el.scrollWidth > el.clientWidth), false, `Herdr overflow at ${width}px`);
          await page.locator(".send").click();
          await finished();
          if (width === 390) {
            await capture("herdr-mobile", ".herdr");
            await audit("Herdr mobile accessibility");
          }
          await page.locator('.herdr-agent[data-agent="cursor"]').click();
          const cursor = page.locator('.herdr-pane[data-agent="cursor"]');
          assert.equal(await cursor.getAttribute("data-focused"), "true");
          assert.ok(await cursor.evaluate(el => {
            const pane = el.getBoundingClientRect();
            const viewport = el.parentElement.getBoundingClientRect();
            return pane.top >= viewport.top - 1 && pane.bottom <= viewport.bottom + 1;
          }), `sidebar brings Cursor into view at ${width}px`);
        } else if (width === 390) await audit("Docs mobile accessibility");
      }
    }
    assert.deepEqual(errors, [], "browser errors");
    console.log("PASS docs, all eight tools, responsive layouts at six widths and no browser errors");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
