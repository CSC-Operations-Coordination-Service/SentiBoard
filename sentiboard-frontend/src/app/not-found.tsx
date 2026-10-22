import type { Metadata } from "next";
import { MessagePage } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Page not found — SentiBoard" };

export default function NotFound() {
  return (
    <MessagePage
      crumb="Not found"
      title="Page not found"
      big="404"
      text="This page could not be found."
    />
  );
}
