import { DAY_MS } from "@/lib/missions";
import type { AcqDatatake, AcqLevel } from "./types";

export function computeAcqWindow(now: Date): { windowStart: Date; windowEnd: Date } {
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const windowStart = new Date(todayUTC - DAY_MS);
  const windowEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59),
  );
  return { windowStart, windowEnd };
}

export function meanCompleteness(levels: AcqLevel[]): number {
  const pcts: number[] = [];
  for (const lv of levels) {
    for (const p of lv.products) {
      if (p.pct !== null) pcts.push(p.pct);
    }
  }
  if (pcts.length === 0) return 0;
  return pcts.reduce((s, v) => s + v, 0) / pcts.length;
}

export function missingSeconds(levels: AcqLevel[], sensingS: number): number {
  let total = 0;
  for (const lv of levels) {
    for (const p of lv.products) {
      if (p.pct !== null) {
        total += sensingS * (1 - p.pct / 100);
      }
    }
  }
  return total;
}

export interface AcqKpiStats {
  total: number;
  acquiredPct: number | null;
  publishedPct: number | null;
  failedCount: number;
}

export function kpiStats(datatakes: AcqDatatake[]): AcqKpiStats {
  const total = datatakes.length;
  if (total === 0) {
    return { total: 0, acquiredPct: null, publishedPct: null, failedCount: 0 };
  }
  const failedCount = datatakes.filter((d) => d.comp === 0).length;
  const acquiredCount = datatakes.filter((d) => d.status !== "Failed").length;
  const acquiredPct = Math.round((100 * acquiredCount) / total);
  const publishedPct = Math.round(datatakes.reduce((s, d) => s + d.comp, 0) / total);
  return { total, acquiredPct, publishedPct, failedCount };
}
