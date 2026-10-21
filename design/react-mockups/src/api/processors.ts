/* The Processors resource: one call, returning the UI model the Processors page renders. */

import { PROCESSOR_GROUPS, type ProcessorGroup } from "@/data/processor-releases";
import { USE_MOCKS } from "./client";
import { fetchAll } from "./paginate";
import { adaptProcessors } from "./adapters/processor";
import { useApi } from "./useApi";

/** Every processor with its releases (oldest first), from the backend or, with VITE_USE_MOCKS,
 *  from the shared fixture. Throws ApiError when the backend fails. */
export async function getProcessors(init?: { signal?: AbortSignal }): Promise<ProcessorGroup[]> {
  if (USE_MOCKS) return PROCESSOR_GROUPS;

  const records = await fetchAll("/processor/", init);
  const { groups, unplaced } = adaptProcessors(records);
  if (unplaced.length && import.meta.env.DEV) {
    console.warn(
      `[api] ${unplaced.length} of ${records.length} processor releases have no target IPF and are not shown:`,
      unplaced.map((r) => r.id),
    );
  }
  return groups;
}

export function useProcessors() {
  return useApi(getProcessors);
}
