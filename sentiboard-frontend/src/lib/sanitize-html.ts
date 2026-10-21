/* Release notes arrive as raw HTML pasted from Word, Confluence and Jira: <o:p> tags, inline
   styles, <font face>, class soup, even fragments of Jira's own UI (<form>, <button>, <svg>).
   Anything rendered as HTML goes through sanitizeHtml() first. It keeps an allowlist of content
   tags and drops every presentational attribute, so the notes take the app's own typography and
   colours in both themes instead of the authoring tool's.

   Dropping styles must not drop structure. Where newlines are meaningful they are turned into
   real elements BEFORE sanitizing:
     · plain-text notes (no tags at all), and
     · elements styled `white-space: pre*` — Jira stores a field's text as raw lines in a
       pre-line <div>, so its paragraphs and "- item" lists exist only as newlines.
   Everywhere else a newline in the source is a soft wrap (Word wraps its HTML at ~80 columns)
   and is left as whitespace.

   Server-only: it runs on a jsdom window (the code is the prototype's browser version with every
   DOM global taken from that window), so jsdom and DOMPurify never reach a client bundle. Pages
   sanitize on the server and send the browser the clean HTML. */

import "server-only";
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";

/** One inert window for every call: DOMParser runs no scripts and loads nothing. */
const { window: win } = new JSDOM("");
const { DOMParser, Node, NodeFilter } = win;
const document = win.document;

/** Content structure only. Anything else is removed but its text kept (<o:p>, <font>, <form>…);
 *  DOMPurify drops script, style, svg, template and the like together with their contents. */
const ALLOWED_TAGS = [
  "p", "br", "div", "span", "hr",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "b", "strong", "i", "em", "u", "ins", "del", "s", "sub", "sup", "code", "pre", "blockquote",
  "a",
  "table", "thead", "tbody", "tr", "th", "td",
];

/** No style, class, id, lang, face, color, data-* or aria-*: nothing that styles or scripts. */
const ALLOWED_ATTR = ["href", "title", "start", "colspan", "rowspan"];

const purify = DOMPurify(win as unknown as Parameters<typeof DOMPurify>[0]);
// Links in notes point off-site (SentiWiki, PSDs): open them in a new tab without an opener.
purify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && node.hasAttribute("href")) {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

const CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  KEEP_CONTENT: true,
};

const HAS_TAG = /<[a-z!/][^>]*>/i;
const PRE_WHITESPACE = /white-space\s*:\s*pre/i;
/** "- item", "• item", "* item" (Jira wiki), "1. item" / "1) item". */
const BULLET_LINE = /^\s*(?:([-•*·▪◦‣])|(\d{1,2})[.)])\s+(.*)$/;
/** Jira wiki headings in plain-text notes: "h2. Changes introduced". */
const WIKI_HEADING = /^\s*h([1-6])\.\s+(.*)$/;

const HEADINGS = "h1,h2,h3,h4,h5,h6";
const BLOCKS = `p,div,li,${HEADINGS},blockquote,pre,td,th`;

/**
 * Lines of text → block elements. Blank lines separate paragraphs; consecutive lines inside a
 * paragraph keep their breaks; bullet lines become list items (a blank line between items does
 * not end the list); a line straight after an item continues it; "hN. Title" becomes a heading.
 */
function linesToBlocks(text: string, doc: Document): DocumentFragment {
  const out = doc.createDocumentFragment();
  let para: string[] = [];
  let list: HTMLUListElement | HTMLOListElement | null = null;
  let lastItem: HTMLLIElement | null = null;
  let afterBlank = false;

  const flushPara = () => {
    if (!para.length) return;
    const p = doc.createElement("p");
    para.forEach((line, i) => {
      if (i) p.append(doc.createElement("br"));
      p.append(line);
    });
    out.append(p);
    para = [];
  };
  const closeList = () => {
    list = null;
    lastItem = null;
  };

  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      afterBlank = true;
      continue;
    }
    const heading = line.match(WIKI_HEADING);
    const bullet = line.match(BULLET_LINE);
    if (heading) {
      flushPara();
      closeList();
      const h = doc.createElement(`h${heading[1]}`);
      h.textContent = heading[2];
      out.append(h);
    } else if (bullet) {
      flushPara();
      const ordered = bullet[2] !== undefined;
      if (!list || (list.tagName === "OL") !== ordered) {
        list = doc.createElement(ordered ? "ol" : "ul");
        out.append(list);
      }
      lastItem = doc.createElement("li");
      lastItem.textContent = bullet[3];
      list.append(lastItem);
    } else if (lastItem && !afterBlank) {
      lastItem.append(doc.createElement("br"), line);
    } else {
      closeList();
      para.push(line);
    }
    afterBlank = false;
  }
  flushPara();
  return out;
}

/** Newlines inside a `white-space: pre*` element → structure. A text-only element (Jira's case)
 *  becomes paragraphs and lists; one mixing text and markup gets <br> for each newline. */
function structurePreElement(el: Element, doc: Document): void {
  const textOnly = [...el.childNodes].every((n) => n.nodeType === Node.TEXT_NODE);
  if (textOnly) {
    el.replaceChildren(linesToBlocks(el.textContent ?? "", doc));
    return;
  }
  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) texts.push(walker.currentNode as Text);
  for (const t of texts) {
    if (!t.data.includes("\n")) continue;
    const parts = t.data.split("\n");
    const frag = doc.createDocumentFragment();
    parts.forEach((part, i) => {
      if (i) frag.append(doc.createElement("br"));
      if (part) frag.append(part);
    });
    t.replaceWith(frag);
  }
}

/** A leading quote mark with no partner in its block: a stray from copy-pasting a quoted text
 *  (`" Copernicus Sentinel-3 …`). A quoted opening such as `“Dirty” pixels` keeps its quote. */
function trimStrayLeadingQuote(block: Element): void {
  const walker = block.ownerDocument.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let first: Text | null = null;
  while (walker.nextNode()) {
    const t = walker.currentNode as Text;
    if (t.data.trim()) {
      first = t;
      break;
    }
  }
  if (!first) return;
  const m = first.data.match(/^\s*(["“”„«»])\s*/);
  if (!m) return;
  const text = block.textContent ?? "";
  const q = m[1];
  const unpaired =
    q === '"' ? (text.match(/"/g) ?? []).length % 2 === 1
    : q === "“" || q === "„" ? !text.includes("”")
    : q === "«" ? !text.includes("»")
    : true; // a closing mark (” ») at the very start is always stray
  if (unpaired) first.data = first.data.slice(m[0].length);
}

/** No visible content: no text beyond whitespace / &nbsp;, and no rule or link. */
function isEmpty(el: Element): boolean {
  return !(el.textContent ?? "").replace(/[\s ]+/g, "") && !el.querySelector("hr");
}

/** Safe, unstyled, structured HTML for dangerouslySetInnerHTML. "" when there is nothing to show. */
export function sanitizeHtml(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return "";

  // 1. Structure from newlines, on an inert document (DOMParser runs no scripts, loads nothing).
  const src = new DOMParser().parseFromString(HAS_TAG.test(raw) ? raw : "", "text/html");
  if (!HAS_TAG.test(raw)) {
    // Plain text still carries entities ("&nbsp;", "&amp;"): decode them as text. With no tags
    // in the input, parsing it yields text only.
    const text = new DOMParser().parseFromString(raw, "text/html").body.textContent ?? "";
    src.body.replaceChildren(linesToBlocks(text, src));
  } else {
    for (const el of src.body.querySelectorAll("[style]")) {
      if (el.isConnected && PRE_WHITESPACE.test(el.getAttribute("style") ?? "")) {
        structurePreElement(el, src);
      }
    }
  }

  // 2. Sanitize: allowlisted tags and attributes only.
  const frag = purify.sanitize(src.body.innerHTML, { ...CONFIG, RETURN_DOM_FRAGMENT: true });

  // 3. Tidy: drop empty shells (Word's <p>&nbsp;</p>, Jira's emptied wrappers), deepest first —
  //    an inline one holding a <br> is unwrapped instead, so the line break survives; then trim
  //    stray quotes at the start of each innermost block.
  const all = [...frag.querySelectorAll(`${BLOCKS},span,b,strong,i,em,u,ul,ol`)];
  for (const el of all.reverse()) {
    if (!isEmpty(el)) continue;
    if (!el.matches(BLOCKS) && el.querySelector("br")) el.replaceWith(...el.childNodes);
    else el.remove();
  }
  for (const block of frag.querySelectorAll(BLOCKS)) {
    if (!block.querySelector(BLOCKS)) trimStrayLeadingQuote(block);
  }

  const box = document.createElement("div");
  box.append(frag);
  return box.innerHTML.trim();
}

/** Text of sanitized content: soft wraps collapse, <br> and blocks break lines, items read "• …". */
function fragmentToText(content: DocumentFragment): string {
  const doc = document.implementation.createHTMLDocument("");
  const box = doc.createElement("div");
  box.append(doc.importNode(content, true));
  const walker = doc.createTreeWalker(box, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode as Text;
    t.data = t.data.replace(/[\s ]+/g, " ");
  }
  box.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  box.querySelectorAll("*").forEach((el) => {
    if (el.tagName === "LI") el.prepend("• ");
    if (el.tagName === "UL" || el.tagName === "OL") el.prepend("\n"); // a nested list's own line
    if (el.matches(BLOCKS)) el.append("\n");
  });
  return (box.textContent ?? "")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseSanitized(raw: string | null | undefined): Document | null {
  const clean = sanitizeHtml(raw);
  return clean ? new DOMParser().parseFromString(clean, "text/html") : null;
}

/** Plain text of the notes, structure kept as line breaks and "• " items. */
export function htmlToText(raw: string | null | undefined): string {
  const doc = parseSanitized(raw);
  if (!doc) return "";
  const all = doc.createRange();
  all.selectNodeContents(doc.body);
  return fragmentToText(all.cloneContents());
}

/**
 * Text of one titled section of the notes — from the heading whose text matches `title` up to
 * the next heading (h1–h6) or the end. A heading is an h1–h6, or a block holding nothing but
 * the title (Word notes often bold a paragraph instead). "" when the notes have no such section.
 */
export function notesSection(raw: string | null | undefined, title: RegExp): string {
  const doc = parseSanitized(raw);
  if (!doc) return "";
  const isTitle = (el: Element) => title.test((el.textContent ?? "").trim());
  const heading =
    [...doc.body.querySelectorAll(HEADINGS)].find(isTitle) ??
    [...doc.body.querySelectorAll(BLOCKS)].find((el) => !el.querySelector(BLOCKS) && isTitle(el));
  if (!heading) return "";

  const range = doc.createRange();
  range.setStartAfter(heading);
  const next = [...doc.body.querySelectorAll(HEADINGS)].find(
    (h) => heading.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
  if (next) range.setEndBefore(next);
  else range.setEndAfter(doc.body.lastChild ?? heading);
  return fragmentToText(range.cloneContents());
}
