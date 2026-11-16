/* Decides at request time whether the assistant is on. The root layout is prerendered, so a
   CHATBOT_ENABLED check there would be frozen at build; connection() defers this component to the
   request instead. The layout wraps it in <Suspense fallback={null}>, so the rest of every page
   stays in its static shell. The server action re-checks the flag on every message. */

import { connection } from "next/server";
import { chatbotEnabled } from "@/lib/chatbot/config";
import ChatWidget from "./ChatWidget";

export default async function ChatMount() {
  await connection();
  return chatbotEnabled() ? <ChatWidget /> : null;
}
