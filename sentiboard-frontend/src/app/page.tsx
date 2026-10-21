import ComingSoon, { comingSoonMetadata } from "@/components/ComingSoon";
import { ROUTES } from "@/lib/routes";

// Not ported yet (docs/memory/HANDOFF.md).
export const metadata = comingSoonMetadata(ROUTES.home);

export default function Page() {
  return <ComingSoon route={ROUTES.home} />;
}
