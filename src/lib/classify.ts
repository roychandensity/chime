import type { DeskCategory, DeskMetrics, DensitySpace, CategorySummary, FloorSummary } from "./types";
import type { RawDensitySession } from "./density-client";
import type { TimeFilter } from "./types";
import { clipSessionToWindow } from "./session-utils";
import { format, eachDayOfInterval, parseISO, getDay } from "date-fns";

const CATEGORIES: DeskCategory[] = ["Not Used", "Pit Stop", "Deep Focus", "In and Out"];

export function classifyDesks(
  spaces: DensitySpace[],
  mergedSessions: RawDensitySession[],
  startDate: string,
  endDate: string,
  timeFilter: TimeFilter,
  dayOfWeekFilter: number[]
): { desks: DeskMetrics[]; summary: CategorySummary; floorSummary: FloorSummary; neighborhoodSummary: FloorSummary; openCloseSummary: FloorSummary; deskTypeSummary: FloorSummary } {
  const allDays = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  }).filter((d) => dayOfWeekFilter.includes(getDay(d)));

  const totalDaysInRange = allDays.length;

  // Index sessions by date string for fast lookup
  const sessionsByDate = new Map<string, RawDensitySession[]>();
  for (const session of mergedSessions) {
    const clipped = clipSessionToWindow(
      session.start,
      session.end,
      timeFilter,
      dayOfWeekFilter
    );
    if (!clipped) continue;

    const dateKey = format(clipped.date, "yyyy-MM-dd");
    let list = sessionsByDate.get(dateKey);
    if (!list) {
      list = [];
      sessionsByDate.set(dateKey, list);
    }
    list.push({ ...session, _clippedMinutes: clipped.durationMinutes } as any);
  }

  // For each desk, track daily categories and aggregate metrics
  const deskDailyCategories = new Map<string, DeskCategory[]>();
  const deskTotalMinutes = new Map<string, number>();
  const deskTotalSessions = new Map<string, number>();
  const deskActiveDays = new Map<string, Set<string>>();

  for (const space of spaces) {
    deskDailyCategories.set(space.id, []);
    deskTotalMinutes.set(space.id, 0);
    deskTotalSessions.set(space.id, 0);
    deskActiveDays.set(space.id, new Set());
  }

  // Classify each desk for each day
  for (const day of allDays) {
    const dateKey = format(day, "yyyy-MM-dd");
    const daySessions = sessionsByDate.get(dateKey) || [];

    // Accumulate per-desk metrics for this day
    const dayDeskMinutes = new Map<string, number>();
    const dayDeskSessions = new Map<string, number>();

    for (const session of daySessions) {
      const sid = session.space_id;
      if (!deskDailyCategories.has(sid)) continue;

      const mins = (session as any)._clippedMinutes as number;
      dayDeskMinutes.set(sid, (dayDeskMinutes.get(sid) || 0) + mins);
      dayDeskSessions.set(sid, (dayDeskSessions.get(sid) || 0) + 1);

      // Update aggregate metrics
      deskTotalMinutes.set(sid, deskTotalMinutes.get(sid)! + mins);
      deskTotalSessions.set(sid, deskTotalSessions.get(sid)! + 1);
      deskActiveDays.get(sid)!.add(dateKey);
    }

    // Classify each desk for this day
    for (const space of spaces) {
      const sessCount = dayDeskSessions.get(space.id) || 0;
      const totalMins = dayDeskMinutes.get(space.id) || 0;
      const avgDuration = sessCount > 0 ? totalMins / sessCount : 0;

      const category = classifyDesk(sessCount, sessCount, avgDuration);
      deskDailyCategories.get(space.id)!.push(category);
    }
  }

  // Compute summary as average daily shares
  const summary: CategorySummary = {
    "Not Used": 0,
    "Pit Stop": 0,
    "Deep Focus": 0,
    "In and Out": 0,
    total: spaces.length,
  };

  // Per-group summary accumulators
  const floorCounts = new Map<string, { total: number; cats: Record<DeskCategory, number> }>();
  const neighborhoodCounts = new Map<string, { total: number; cats: Record<DeskCategory, number> }>();
  const openCloseCounts = new Map<string, { total: number; cats: Record<DeskCategory, number> }>();
  const deskTypeCounts = new Map<string, { total: number; cats: Record<DeskCategory, number> }>();

  // For each desk, determine overall category (mode of daily categories)
  const desks: DeskMetrics[] = spaces.map((space) => {
    const dailyCats = deskDailyCategories.get(space.id)!;
    const totalMin = deskTotalMinutes.get(space.id)!;
    const totalSess = deskTotalSessions.get(space.id)!;
    const activeDays = deskActiveDays.get(space.id)!;
    const daysForAvg = Math.max(totalDaysInRange, 1);

    // Mode of daily categories
    const catCounts: Record<DeskCategory, number> = {
      "Not Used": 0,
      "Pit Stop": 0,
      "Deep Focus": 0,
      "In and Out": 0,
    };
    for (const cat of dailyCats) {
      catCounts[cat]++;
    }

    // Find the desk's predominant behavior when in use
    // If never used, it's "Not Used". Otherwise, use the most common active category.
    let category: DeskCategory = "Not Used";
    const activeCats = catCounts["Deep Focus"] + catCounts["Pit Stop"] + catCounts["In and Out"];
    if (activeCats > 0) {
      let maxCount = 0;
      for (const cat of CATEGORIES) {
        if (cat === "Not Used") continue;
        if (catCounts[cat] > maxCount) {
          maxCount = catCounts[cat];
          category = cat;
        }
      }
    }

    // Add this desk's daily category shares to the summary
    for (const cat of CATEGORIES) {
      summary[cat] += catCounts[cat] / daysForAvg;
    }

    // Accumulate per-group daily shares
    for (const [groupKey, groupMap] of [
      [space.floor, floorCounts],
      [space.neighborhood, neighborhoodCounts],
      [space.openClose, openCloseCounts],
      [space.deskType, deskTypeCounts],
    ] as [string, Map<string, { total: number; cats: Record<DeskCategory, number> }>][]) {
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          total: 0,
          cats: { "Not Used": 0, "Pit Stop": 0, "Deep Focus": 0, "In and Out": 0 },
        });
      }
      const gc = groupMap.get(groupKey)!;
      gc.total++;
      for (const cat of CATEGORIES) {
        gc.cats[cat] += catCounts[cat] / daysForAvg;
      }
    }

    const avgMinutesPerDay = totalMin / daysForAvg;
    const avgSessionsPerDay = totalSess / daysForAvg;
    const avgSessionDuration = totalSess > 0 ? totalMin / totalSess : 0;

    return {
      space_id: space.id,
      name: space.name,
      floor: space.floor,
      neighborhood: space.neighborhood,
      workPointType: space.workPointType,
      openClose: space.openClose,
      deskType: space.deskType,
      category,
      total_minutes: Math.round(totalMin * 100) / 100,
      active_days: activeDays.size,
      avg_minutes_per_day: Math.round(avgMinutesPerDay * 100) / 100,
      avg_sessions_per_day: Math.round(avgSessionsPerDay * 100) / 100,
      avg_session_duration: Math.round(avgSessionDuration * 100) / 100,
      total_sessions: totalSess,
    };
  });

  // Round summary values
  for (const cat of CATEGORIES) {
    summary[cat] = Math.round(summary[cat] * 100) / 100;
  }

  // Build group summaries with avg_share (proportion of desks)
  function buildGroupSummary(
    counts: Map<string, { total: number; cats: Record<DeskCategory, number> }>
  ): FloorSummary {
    const result: FloorSummary = {};
    for (const [key, gc] of counts) {
      result[key] = {
        "Not Used": Math.round((gc.cats["Not Used"] / gc.total) * 1000) / 1000,
        "Pit Stop": Math.round((gc.cats["Pit Stop"] / gc.total) * 1000) / 1000,
        "Deep Focus": Math.round((gc.cats["Deep Focus"] / gc.total) * 1000) / 1000,
        "In and Out": Math.round((gc.cats["In and Out"] / gc.total) * 1000) / 1000,
        total: gc.total,
      };
    }
    return result;
  }

  const floorSummary = buildGroupSummary(floorCounts);
  const neighborhoodSummary = buildGroupSummary(neighborhoodCounts);
  const openCloseSummary = buildGroupSummary(openCloseCounts);
  const deskTypeSummary = buildGroupSummary(deskTypeCounts);

  return { desks, summary, floorSummary, neighborhoodSummary, openCloseSummary, deskTypeSummary };
}

/**
 * Classify a desk's daily behavior.
 *
 * Thresholds calibrated against Density's `desk_sessions_features.behavior_group`
 * (Hex reference dashboard, Q1 2026 data):
 *
 *   Not Used   — 0 sessions
 *   Pit Stop   — ~1.5 sessions/day, ~35 min avg duration
 *   In and Out — ~4.5 sessions/day, ~44 min avg duration
 *   Deep Focus — ~2.5 sessions/day, ~135 min avg duration
 *
 * Key differentiators:
 *   - Deep Focus vs others: avg session duration (130+ min vs 35-50 min)
 *   - In and Out vs Pit Stop: session count (2+ vs 1, since our 10-min merge gap
 *     produces fewer sessions than Density's internal model)
 */
export function classifyDesk(
  totalSessions: number,
  _avgSessionsPerDay: number,
  avgSessionDuration: number
): DeskCategory {
  if (totalSessions === 0) return "Not Used";
  if (avgSessionDuration >= 90) return "Deep Focus";
  if (totalSessions >= 3) return "In and Out";
  return "Pit Stop";
}
