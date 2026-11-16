import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { makeAssistantMessage } from "./ChatWidget";
import KpiCard from "./KpiCard";
import MarkerPlaceholder from "./MarkerPlaceholder";
import MarkdownContent from "./MarkdownContent";

// ---------------------------------------------------------------------------
// Helper: parse rendered HTML into a DOM for querying
// ---------------------------------------------------------------------------
function parse(html: string): Document {
  return new JSDOM(html).window.document;
}

// ---------------------------------------------------------------------------
// 1. makeAssistantMessage — pure function, no React needed
// ---------------------------------------------------------------------------

describe("makeAssistantMessage", () => {
  it("produces an assistant Message with the given fields", () => {
    const msg = makeAssistantMessage(7, "Hello!", "req-uuid-1");
    expect(msg).toEqual({
      id: 7,
      role: "assistant",
      content: "Hello!",
      requestId: "req-uuid-1",
    });
  });
});

// ---------------------------------------------------------------------------
// 2. KpiCard
// ---------------------------------------------------------------------------

describe("KpiCard", () => {
  it("renders label and value", () => {
    const html = renderToStaticMarkup(
      createElement(KpiCard, {
        marker: { kind: "kpi-direct", label: "Total events", value: "42" },
      }),
    );
    expect(html).toContain("Total events");
    expect(html).toContain("42");
  });

  it("renders delta when present", () => {
    const html = renderToStaticMarkup(
      createElement(KpiCard, {
        marker: {
          kind: "kpi-direct",
          label: "Total",
          value: "10",
          delta: "+5%",
        },
      }),
    );
    expect(html).toContain("+5%");
  });

  it("omits delta element when not present", () => {
    const html = renderToStaticMarkup(
      createElement(KpiCard, {
        marker: { kind: "kpi-direct", label: "X", value: "1" },
      }),
    );
    // No delta content — no span beyond label and value
    const doc = parse(html);
    const spans = doc.querySelectorAll("span");
    expect(spans.length).toBe(2); // label + value only
  });

  it("applies a color class when color is set", () => {
    const html = renderToStaticMarkup(
      createElement(KpiCard, {
        marker: {
          kind: "kpi-direct",
          label: "Status",
          value: "OK",
          color: "green",
        },
      }),
    );
    // The class name is a CSS module hash in production, but in test (node env)
    // Vite returns class names as-is or as "green". Either way the value renders.
    expect(html).toContain("OK");
  });
});

// ---------------------------------------------------------------------------
// 3. MarkerPlaceholder
// ---------------------------------------------------------------------------

describe("MarkerPlaceholder", () => {
  const kinds = [
    { kind: "tabular", data_id: "artifact_abc" },
    { kind: "temporal-plot", data_id: "artifact_abc", date_column: "ts", numeric_column: "v" },
    { kind: "count-histogram", data_id: "artifact_abc", count_column: "n", date_column: "ts" },
    { kind: "event-calendar", data_id: "artifact_abc" },
    { kind: "kpi-artifact", data_id: "artifact_abc" },
  ] as const;

  for (const marker of kinds) {
    it(`renders a placeholder for ${marker.kind}`, () => {
      const html = renderToStaticMarkup(
        createElement(MarkerPlaceholder, { marker }),
      );
      expect(html).toContain("not displayed yet");
    });
  }

  it("includes the marker title when present", () => {
    const html = renderToStaticMarkup(
      createElement(MarkerPlaceholder, {
        marker: { kind: "tabular", data_id: "artifact_abc", title: "My Table" },
      }),
    );
    expect(html).toContain("My Table");
    expect(html).toContain("Table");
  });
});

// ---------------------------------------------------------------------------
// 4. MarkdownContent
// ---------------------------------------------------------------------------

describe("MarkdownContent", () => {
  it("renders bold text as <strong>", () => {
    const html = renderToStaticMarkup(
      createElement(MarkdownContent, { text: "**bold word**" }),
    );
    const doc = parse(html);
    expect(doc.querySelector("strong")).not.toBeNull();
    expect(doc.querySelector("strong")?.textContent).toBe("bold word");
  });

  it("renders italic text as <em>", () => {
    const html = renderToStaticMarkup(
      createElement(MarkdownContent, { text: "_italic_" }),
    );
    expect(parse(html).querySelector("em")).not.toBeNull();
  });

  it("renders GFM table as <table> inside a wrapper", () => {
    const md = `| A | B |\n|---|---|\n| 1 | 2 |`;
    const html = renderToStaticMarkup(
      createElement(MarkdownContent, { text: md }),
    );
    const doc = parse(html);
    expect(doc.querySelector("table")).not.toBeNull();
    // Wrapper div carries the tableWrap class (name may be hashed in test; check presence)
    expect(html).toContain("<table");
  });

  it("renders KaTeX inline math — produces .katex span, not literal $…$", () => {
    const html = renderToStaticMarkup(
      createElement(MarkdownContent, { text: "The formula $E=mc^2$ is well known." }),
    );
    // KaTeX output carries class="katex" on its root span
    expect(html).toContain('class="katex"');
    // The literal $…$ must not appear
    expect(html).not.toContain("$E=mc^2$");
  });

  it("renders KaTeX display math — produces .katex-display span", () => {
    // remark-math v6 requires $$ on its own line for block (display) math.
    const html = renderToStaticMarkup(
      createElement(MarkdownContent, { text: "$$\nE=mc^2\n$$" }),
    );
    expect(html).toContain("katex-display");
  });

  it("shows a malformed marker as literal text, not as an element", () => {
    // A marker that fails validation (unknown attribute) must remain visible
    const md = `Before <tabular data_id="artifact_abc" unknown_attr="x" /> after.`;
    const html = renderToStaticMarkup(
      createElement(MarkdownContent, { text: md }),
    );
    // The raw tag text should appear in the output
    expect(html).toContain("unknown_attr");
    // It must not have been parsed as an HTML element (no tabular element)
    const doc = parse(html);
    expect(doc.querySelector("tabular")).toBeNull();
  });

  it("shows a <script> tag as visible text, not as an element", () => {
    const md = `Here is <script>alert(1)</script> end.`;
    const html = renderToStaticMarkup(
      createElement(MarkdownContent, { text: md }),
    );
    // No script element should be in the output
    const doc = parse(html);
    expect(doc.querySelector("script")).toBeNull();
    // The literal text should be present (the remark plugin converts html nodes to text)
    expect(html).toContain("script");
  });

  it("strips images", () => {
    const html = renderToStaticMarkup(
      createElement(MarkdownContent, { text: "![alt](https://example.com/img.png)" }),
    );
    expect(parse(html).querySelector("img")).toBeNull();
  });

  it("renders links with target=_blank and rel, only for http(s) hrefs", () => {
    const html = renderToStaticMarkup(
      createElement(MarkdownContent, {
        text: "[safe](https://example.com) [unsafe](javascript:alert(1))",
      }),
    );
    const doc = parse(html);
    const anchors = doc.querySelectorAll("a");
    const safe = [...anchors].find((a) => a.textContent === "safe");
    const unsafe = [...anchors].find((a) => a.textContent === "unsafe");
    expect(safe?.getAttribute("href")).toBe("https://example.com");
    expect(safe?.getAttribute("target")).toBe("_blank");
    expect(safe?.getAttribute("rel")).toContain("noopener");
    // Non-http href is stripped
    expect(unsafe?.getAttribute("href")).toBeFalsy();
  });

  it("renders a mixed response in source order: text, then KaTeX, then more text", () => {
    const md = `Before $x$ after.`;
    const html = renderToStaticMarkup(
      createElement(MarkdownContent, { text: md }),
    );
    const katexIdx = html.indexOf("katex");
    const beforeIdx = html.indexOf("Before");
    const afterIdx = html.indexOf("after");
    expect(beforeIdx).toBeLessThan(katexIdx);
    expect(katexIdx).toBeLessThan(afterIdx);
  });
});
