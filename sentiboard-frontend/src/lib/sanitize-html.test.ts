import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { htmlToText, notesSection, sanitizeHtml } from "./sanitize-html";
import { RECORDS } from "@/features/processors/__fixtures__/processor-records";

/* ---------------------------------------------------------------------------------------------
   Helpers: tests inspect the output as a DOM (jsdom), never by string matching on tags.
   ------------------------------------------------------------------------------------------- */

const { window } = new JSDOM("");
const parse = (html: string) => {
  const box = window.document.createElement("div");
  box.innerHTML = html;
  return box;
};
const all = (html: string, sel = "*") => [...parse(html).querySelectorAll(sel)];
const text = (html: string) => (parse(html).textContent ?? "").replace(/\s+/g, " ").trim();

const ALLOWED_TAGS = new Set(
  "p br div span hr h1 h2 h3 h4 h5 h6 ul ol li b strong i em u ins del s sub sup code pre blockquote a table thead tbody tr th td"
    .split(" "),
);
/** The sanitizer's allowlist, plus the two attributes it adds to links. */
const ALLOWED_ATTRS = new Set(["href", "title", "start", "colspan", "rowspan", "target", "rel"]);
/** Elements DOMPurify drops together with their content (its FORBID_CONTENTS defaults). */
const DROPPED_WITH_CONTENT = "script, style, svg, template, noscript, iframe, math, title, head, xmp";

/** The visible text of raw notes: HTML without the elements dropped with their content, or plain
 *  text with its entities decoded. */
function visibleText(raw: string): string {
  if (!/<[a-z!/][^>]*>/i.test(raw)) return new JSDOM(`<body>${raw}`).window.document.body.textContent ?? "";
  const src = parse(raw);
  src.querySelectorAll(DROPPED_WITH_CONTENT).forEach((el) => el.remove());
  return src.textContent ?? "";
}

/**
 * "No text lost": with whitespace ignored (blocks and line breaks change it legitimately), the
 * output's characters must appear in the input in the same order, and every run of input
 * characters missing from the output must be a marker the sanitizer turns into structure: a bullet
 * ("-", "•", "*"…), a list number ("1.", "2)"), a Jira "h2." prefix, or a stray leading quote.
 * Returns the runs that are not (expected: none).
 */
function lostText(raw: string, clean: string): string[] {
  const input = visibleText(raw).replace(/\s+/g, "");
  const output = (parse(clean).textContent ?? "").replace(/\s+/g, "");
  const MARKERS = /^(?:[-•*·▪◦‣"“”„«»]|\d{1,2}[.)]|h[1-6]\.)+$/;
  const lost: string[] = [];
  let i = 0;
  let run = "";
  for (const ch of output) {
    while (i < input.length && input[i] !== ch) run += input[i++];
    if (i === input.length) return [`<output text not found in order in the input near "${ch}">`];
    if (run) lost.push(run);
    run = "";
    i++;
  }
  if (i < input.length) lost.push(input.slice(i));
  return lost.filter((r) => !MARKERS.test(r));
}

/** Bullet lines ("- x", "• x", "* x", "1. x") in the input's line-structured text. */
function bulletLines(raw: string): number {
  const BULLET = /^\s*(?:[-•*·▪◦‣]|\d{1,2}[.)])\s+\S/;
  const blocks = /<[a-z!/][^>]*>/i.test(raw)
    ? all(raw, "[style]")
        .filter((el) => /white-space\s*:\s*pre/i.test(el.getAttribute("style") ?? ""))
        .filter((el) => [...el.childNodes].every((n) => n.nodeType === 3))
        .map((el) => el.textContent ?? "")
    : [raw];
  return blocks.flatMap((b) => b.split(/\r?\n/)).filter((l) => BULLET.test(l)).length;
}

/* ---------------------------------------------------------------------------------------------
   Synthetic cases
   ------------------------------------------------------------------------------------------- */

describe("sanitizeHtml — what is removed", () => {
  it.each(["script", "style", "template"])("drops <%s> with its content", (tag) => {
    const out = sanitizeHtml(`<p>Keep</p><${tag}>alert("x")</${tag}>`);
    expect(out).toBe("<p>Keep</p>");
  });

  it("drops <svg> with its content", () => {
    expect(sanitizeHtml('<p>Keep<svg><path d="M0"/><text>icon</text></svg></p>')).toBe("<p>Keep</p>");
  });

  it.each([
    ["form", '<form action="/x"><p>In a form</p></form>', "<p>In a form</p>"],
    ["button", "<p><button onclick=\"x()\">Click</button> me</p>", "<p>Click me</p>"],
    ["<o:p> (Word)", '<p class="MsoNormal">Word text<o:p></o:p></p>', "<p>Word text</p>"],
    ["<font>", '<p><font face="Arial" color="red">Old font</font></p>', "<p>Old font</p>"],
  ])("unwraps %s and keeps its text", (_, raw, expected) => {
    expect(sanitizeHtml(raw)).toBe(expected);
  });

  it("removes styling and scripting attributes, keeps the allowed ones", () => {
    const out = sanitizeHtml(
      '<table><tr><td colspan="2" rowspan="1" style="color:red" class="x" id="y" lang="en" data-k="v" aria-label="z" onclick="x()">Cell</td></tr></table>' +
        '<ol start="3" type="a"><li title="t" style="margin:0">Item</li></ol>',
    );
    const attrs = all(out).flatMap((el) => [...el.attributes].map((a) => `${el.tagName.toLowerCase()}@${a.name}`));
    expect(attrs.sort()).toEqual(["li@title", "ol@start", "td@colspan", "td@rowspan"]);
  });

  it("opens links in a new tab without an opener, and drops javascript: URLs", () => {
    const out = sanitizeHtml(
      '<p><a href="https://sentiwiki.copernicus.eu/x" class="c">Wiki</a> <a href="javascript:alert(1)">Bad</a></p>',
    );
    const [good, bad] = all(out, "a");
    expect(good.getAttribute("href")).toBe("https://sentiwiki.copernicus.eu/x");
    expect(good.getAttribute("target")).toBe("_blank");
    expect(good.getAttribute("rel")).toBe("noopener noreferrer");
    expect(bad.hasAttribute("href")).toBe(false);
    expect(text(out)).toBe("Wiki Bad");
  });
});

describe("sanitizeHtml — structure", () => {
  it("keeps lists, paragraphs, line breaks and tables", () => {
    const raw =
      "<p>One<br>Two</p><ul><li>A</li><li>B<ul><li>B1</li></ul></li></ul><ol><li>First</li></ol>" +
      "<table><thead><tr><th>H</th></tr></thead><tbody><tr><td>D</td></tr></tbody></table>";
    expect(sanitizeHtml(raw)).toBe(raw);
  });

  it("turns a Jira white-space: pre-line block into paragraphs and a list", () => {
    const out = sanitizeHtml(
      '<div style="white-space: pre-line">Changes introduced:\n- Fix one\n- Fix two\n\nNew paragraph\nsecond line</div>',
    );
    expect(out).toBe(
      "<div><p>Changes introduced:</p><ul><li>Fix one</li><li>Fix two</li></ul><p>New paragraph<br>second line</p></div>",
    );
  });

  it("turns newlines into <br> in a pre-line block that mixes text and markup", () => {
    expect(sanitizeHtml('<div style="white-space:pre-wrap">a\n<b>b</b>\nc</div>')).toBe(
      "<div>a<br><b>b</b><br>c</div>",
    );
  });

  it("keeps Word's soft wraps as spaces, not line breaks", () => {
    expect(sanitizeHtml('<p class="MsoNormal">a long line\nwrapped by Word</p>')).toBe(
      "<p>a long line\nwrapped by Word</p>",
    );
  });

  it("structures plain-text notes: paragraphs, '-' / '•' / '*' / numbered bullets, Jira 'h2.' headings", () => {
    const out = sanitizeHtml(
      "h2. Changes introduced\n- first\n• second\n* third\n\n1. one\n2) two\n\nClosing &amp; done",
    );
    expect(out).toBe(
      "<h2>Changes introduced</h2><ul><li>first</li><li>second</li><li>third</li></ul>" +
        "<ol><li>one</li><li>two</li></ol><p>Closing &amp; done</p>",
    );
  });

  it("continues a list item on the next line, and keeps the list across a blank line", () => {
    expect(sanitizeHtml("- item\n  continued\n\n- next")).toBe(
      "<ul><li>item<br>continued</li><li>next</li></ul>",
    );
  });
});

describe("sanitizeHtml — tidying", () => {
  it("drops Word's empty paragraphs and emptied wrappers", () => {
    expect(sanitizeHtml('<p class="MsoNormal">&nbsp;<o:p></o:p></p><p>Text</p><div><span> </span></div>')).toBe(
      "<p>Text</p>",
    );
  });

  it("unwraps an empty inline element holding a line break, keeping the break", () => {
    expect(sanitizeHtml("<p>a<span><br></span>b</p>")).toBe("<p>a<br>b</p>");
  });

  it("trims a stray leading quote, keeps a paired one", () => {
    expect(sanitizeHtml('<p>" Copernicus Sentinel-3 products</p>')).toBe("<p>Copernicus Sentinel-3 products</p>");
    expect(sanitizeHtml("<p>“Dirty” pixels are flagged</p>")).toBe("<p>“Dirty” pixels are flagged</p>");
  });

  it.each([null, undefined, "", "   ", "<p>&nbsp;</p>"])("gives an empty string for %j", (raw) => {
    expect(sanitizeHtml(raw)).toBe("");
  });
});

describe("htmlToText / notesSection", () => {
  it("flattens to text with line breaks and '• ' list items", () => {
    // a list starts on a line of its own, so a blank line separates it from the paragraph
    expect(htmlToText("<p>Intro<br>line</p><ul><li>A</li><li>B</li></ul>")).toBe("Intro\nline\n\n• A\n• B");
  });

  it("finds a section by heading and stops at the next heading", () => {
    const html = "<h3>Changes introduced:</h3><ul><li>A</li><li>B</li></ul><h3>Impact</h3><p>None</p>";
    expect(notesSection(html, /^changes introduced\s*:?$/i)).toBe("• A\n• B");
  });

  it("finds a section whose title is a block of its own (a bold Word paragraph)", () => {
    const html = "<p><b>Changes introduced</b></p><p>Only change</p>";
    expect(notesSection(html, /^changes introduced$/i)).toBe("Only change");
  });

  it("gives an empty string when the section is missing", () => {
    expect(notesSection("<p>Nothing here</p>", /^changes introduced$/i)).toBe("");
  });
});

/* ---------------------------------------------------------------------------------------------
   Real release notes (captured from the backend, see __fixtures__/processor-records.ts)
   ------------------------------------------------------------------------------------------- */

describe.each(Object.entries(RECORDS))("real notes: %s", (_, record) => {
  const raw = record.release_notes ?? "";
  const clean = sanitizeHtml(raw);

  it("produces something", () => {
    expect(clean.length).toBeGreaterThan(0);
  });

  it("contains only allowlisted tags and attributes", () => {
    const tags = new Set(all(clean).map((el) => el.tagName.toLowerCase()));
    expect([...tags].filter((t) => !ALLOWED_TAGS.has(t))).toEqual([]);
    const attrs = new Set(all(clean).flatMap((el) => [...el.attributes].map((a) => a.name)));
    expect([...attrs].filter((a) => !ALLOWED_ATTRS.has(a))).toEqual([]);
  });

  it("gives every link a safe target and rel", () => {
    for (const a of all(clean, "a[href]")) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toBe("noopener noreferrer");
      expect(a.getAttribute("href")).not.toMatch(/^\s*javascript:/i);
    }
  });

  it("loses no text", () => {
    expect(lostText(raw, clean)).toEqual([]);
  });

  it("keeps every bullet line as a list item", () => {
    expect(all(clean, "li").length).toBeGreaterThanOrEqual(bulletLines(raw));
  });
});

describe("real notes: specifics", () => {
  it("Word: removes Office markup and keeps the list and link", () => {
    const raw = RECORDS.word.release_notes ?? "";
    expect(raw).toMatch(/<o:p>|class="?Mso/i); // the fixture is what it claims to be
    const clean = sanitizeHtml(raw);
    expect(clean).not.toMatch(/o:p|Mso|style=|class=/i);
    expect(all(clean, "li").length).toBeGreaterThan(0);
    expect(all(clean, "a[href]").length).toBeGreaterThan(0);
  });

  it("Jira with UI fragments: no form, button or icon survives, the bullet lines become a list", () => {
    const raw = RECORDS.jiraUi.release_notes ?? "";
    expect(raw).toMatch(/<form/i);
    expect(raw).toMatch(/<button/i);
    expect(raw).toMatch(/<svg/i);
    const clean = sanitizeHtml(raw);
    expect(all(clean, "form, button, svg, input")).toEqual([]);
    expect(all(clean, "ul > li").length).toBeGreaterThan(0);
  });

  it("plain text: the 'h2.' line becomes a heading and the bullets a list", () => {
    const raw = RECORDS.plainWiki.release_notes ?? "";
    expect(raw).not.toMatch(/<[a-z]/i);
    const clean = sanitizeHtml(raw);
    expect(all(clean, "h1, h2, h3, h4, h5, h6").length).toBeGreaterThan(0);
    expect(all(clean, "li").length).toBeGreaterThan(0);
    expect(clean).not.toMatch(/(^|>)\s*h[1-6]\./);
  });
});

describe("the checks above are not vacuous", () => {
  it("lostText flags a dropped word and reordered text, but not bullet markers", () => {
    expect(lostText("<p>keep this word</p>", "<p>keep word</p>")).toEqual(["this"]);
    expect(lostText("<p>first second</p>", "<p>second first</p>")[0]).toMatch(/not found in order/);
    expect(lostText("- a\n2) b\nh2. c", "<ul><li>a</li></ul><ol><li>b</li></ol><h2>c</h2>")).toEqual([]);
  });

  it("finds bullet lines in the fixtures that have them", () => {
    expect(bulletLines(RECORDS.jiraUi.release_notes ?? "")).toBeGreaterThan(0);
    expect(bulletLines(RECORDS.plainWiki.release_notes ?? "")).toBeGreaterThan(0);
  });
});
