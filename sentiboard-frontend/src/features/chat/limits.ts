/* Limits shared by the chat widget (input maxLength, history sent) and the server action
   (validation). Kept out of actions.ts because a "use server" file may only export async functions. */

/** Most messages one request may carry; the widget sends at most HISTORY_SENT. */
export const MAX_MESSAGES = 40;
/** Messages of the conversation the widget sends with each question (the newest ones). */
export const HISTORY_SENT = 20;
/** Longest message, in characters. */
export const MAX_CONTENT_CHARS = 4000;
/** Largest page context, in bytes of JSON. */
export const MAX_CONTEXT_BYTES = 8 * 1024;
/** Longest page_id. */
export const MAX_PAGE_ID_CHARS = 64;
