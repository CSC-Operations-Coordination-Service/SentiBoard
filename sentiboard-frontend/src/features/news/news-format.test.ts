import { describe, expect, it } from "vitest";
import { newsTypeToVariant, normalizeNewsText } from "./news-format";

describe("newsTypeToVariant", () => {
  it("maps success", () => expect(newsTypeToVariant("success")).toBe("success"));
  it("maps info", () => expect(newsTypeToVariant("info")).toBe("info"));
  it("maps warning", () => expect(newsTypeToVariant("warning")).toBe("warning"));
  it("maps danger", () => expect(newsTypeToVariant("danger")).toBe("danger"));
  it("unknown for empty string", () => expect(newsTypeToVariant("")).toBe("unknown"));
  it("unknown for unrecognised value", () => expect(newsTypeToVariant("anything_else")).toBe("unknown"));
  it("case-sensitive: uppercase WARNING → unknown", () => expect(newsTypeToVariant("WARNING")).toBe("unknown"));
});

describe("normalizeNewsText", () => {
  it("replaces CRLF with LF", () => expect(normalizeNewsText("a\r\nb")).toBe("a\nb"));
  it("replaces lone CR with LF", () => expect(normalizeNewsText("a\rb")).toBe("a\nb"));
  it("keeps double LF (paragraph break)", () => expect(normalizeNewsText("a\n\nb")).toBe("a\n\nb"));
  it("trims leading and trailing whitespace", () => expect(normalizeNewsText("  hello  ")).toBe("hello"));
  it("two CRLFs become double LF", () => expect(normalizeNewsText("a\r\n\r\nb")).toBe("a\n\nb"));
  it("mixed line endings normalised", () => expect(normalizeNewsText("a\r\nb\rc\nd")).toBe("a\nb\nc\nd"));
  it("empty string stays empty", () => expect(normalizeNewsText("")).toBe(""));
});
