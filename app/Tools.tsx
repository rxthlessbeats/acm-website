"use client";

import { useState } from "react";
import { TOOL_DOCS } from "./tool-docs";

export function Tools() {
  const [on, setOn] = useState(0);
  const { name, call, result } = TOOL_DOCS[on];
  return (
    <div className="tools-grid">
      <div className="tools-side">
        <h2 className="h2">
          Small surface,
          <br />
          <span className="title-accent">shared</span> memory.
        </h2>
        <figure className="tool-preview" aria-live="polite">
          <figcaption>
            <span>example</span>
            <b>{name}</b>
          </figcaption>
          <pre key={name}>
            <code>
              <span className="tp-call">{call}</span>
              {"\n"}
              <span className="tp-out">{result}</span>
            </code>
          </pre>
        </figure>
        <a className="tool-usage-link" href={`#${name}`}>Read {name} usage</a>
      </div>
      <ol className="tools-list">
        {TOOL_DOCS.map(({ name: n, description: desc }, i) => (
          <li key={n} data-on={i === on}>
            <button onMouseEnter={() => setOn(i)} onFocus={() => setOn(i)} onClick={() => setOn(i)}>
              <span className="tool-n">{String(i + 1).padStart(2, "0")}</span>
              <code>{n}</code>
              <p>{desc}</p>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
