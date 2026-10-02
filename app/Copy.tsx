"use client";

import { useState } from "react";

export function Copy({ text, className = "" }: { text: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className={`cmd ${className}`}
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        });
      }}
    >
      <span className="cmd-dollar" aria-hidden="true">$</span>
      <code>{text}</code>
      <span className="cmd-copy" aria-live="polite">{done ? "copied" : "copy"}</span>
    </button>
  );
}
