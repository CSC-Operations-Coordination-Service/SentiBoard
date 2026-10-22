import ComingSoon, { comingSoonMetadata } from "@/components/ComingSoon";
import { ROUTES } from "@/lib/routes";

// Not ported yet (docs/memory/HANDOFF.md).
export const metadata = comingSoonMetadata(ROUTES.terms);

export default function Page() {
  return <ComingSoon route={ROUTES.terms} />;
}
