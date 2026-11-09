// Session 5: replace this stub with a real "use cache" function that calls
// GET /datatake/ — see docs/memory/features/data-availability-plan.md § Session 5.
// connection() is called by AvailabilityData in page.tsx before this is invoked.
import type { Datatake } from "./model";

export async function getDatatakes(): Promise<Datatake[]> {
  return [];
}
