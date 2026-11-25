/* Pure formatting helpers for instant-message news items.
   No browser deps — importable from adapters and components alike. */

export type NewsVariant = "success" | "info" | "warning" | "danger" | "unknown";

const KNOWN_VARIANTS = new Set<string>(["success", "info", "warning", "danger"]);

/** Maps the backend message_type string to a UI variant.
 *  Staging data confirmed: "success", "info", "warning", "danger" (all lowercase).
 *  Any unrecognised value → "unknown". */
export function newsTypeToVariant(messageType: string): NewsVariant {
  return (KNOWN_VARIANTS.has(messageType) ? messageType : "unknown") as NewsVariant;
}

/** Normalises line endings in news body text.
 *  Replaces CRLF and lone CR with LF, then trims leading/trailing whitespace. */
export function normalizeNewsText(raw: string): string {
  return raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}
