"use client";

/* Dark/light switch. The theme lives on <html data-theme> (set before first paint by the script in
   layout.tsx) and in localStorage "sb-theme". Both icon+label pairs are rendered and CSS shows the
   right one (src/styles/shell.css), so the server HTML is correct for either theme. */

import { useSyncExternalStore } from "react";

type Theme = "dark" | "light";

export const THEME_KEY = "sb-theme";

function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function subscribe(onChange: () => void) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

export default function ThemeToggle() {
  // Only the accessible name depends on React state; "dark" (the default) until hydrated.
  const theme = useSyncExternalStore(subscribe, readTheme, () => "dark" as Theme);
  const dark = theme === "dark";

  const toggle = () => {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
  };

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
      title="Toggle theme"
    >
      {/* sun — in dark mode the toggle switches TO light */}
      <span className="sb-contents sb-dark-only">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
        Light
      </span>
      {/* moon — in light mode the toggle switches TO dark */}
      <span className="sb-contents sb-light-only">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
        </svg>
        Dark
      </span>
    </button>
  );
}
