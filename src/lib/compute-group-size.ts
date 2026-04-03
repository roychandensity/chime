import type { MetricsDataPoint } from "./density-client";
import type { ChimeSpace, GroupSizeBucket, GroupSizeChartData, GroupSizeDistribution } from "./types";
import { toZonedTime } from "date-fns-tz";
import { getHours, parseISO } from "date-fns";

const TZ = process.env.TIMEZONE ?? "America/Los_Angeles";

const BUCKETS: GroupSizeBucket[] = ["1", "2", "3-5", "6-9", "10+"];

/**
 * Bucket using the same thresholds as the Hex dashboard:
 *   avg_occupancy_when_used < 1.5 → 1 person
 *   < 3   → 2 people
 *   < 6   → 3-5 people
 *   < 10  → 6-9 people
 *   >= 10 → 10+ people
 */
function toBucket(avgOccupancy: number): GroupSizeBucket {
  if (avgOccupancy < 1.5) return "1";
  if (avgOccupancy < 3) return "2";
  if (avgOccupancy < 6) return "3-5";
  if (avgOccupancy < 10) return "6-9";
  return "10+";
}

function emptyBuckets(): Record<GroupSizeBucket, number> {
  return { "1": 0, "2": 0, "3-5": 0, "6-9": 0, "10+": 0 };
}

/**
 * Compute group size distribution for meeting rooms.
 *
 * For each occupied hour (occupancy_max > 0), use occupancy_avg (rounded) as group size.
 * Bucket into 1, 2, 3-5, 6-9, 10+ people.
 * Calculate % of occupied time at each bucket.
 */
export function computeGroupSize(
  metrics: MetricsDataPoint[],
  rooms: ChimeSpace[],
  startHour = 8,
  endHour = 17
): GroupSizeChartData {
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  // Weight buckets by time_used (seconds), matching Hex's "% of Time When Occupied"
  const overallWeights = emptyBuckets();
  let overallTotal = 0;

  const floorWeights = new Map<string, { buckets: Record<GroupSizeBucket, number>; total: number }>();

  for (const dp of metrics) {
    const room = roomById.get(dp.space_id);
    if (!room) continue;
    if (dp.occupancy_max === undefined || dp.occupancy_max === 0) continue;

    // time_used_raw is in milliseconds. Require meaningful usage —
    // Hex uses time_used_seconds > 180 per 15-min bucket.
    // For hourly data, scale proportionally: 180 * 4 = 720 seconds = 720000 ms.
    const timeUsedMs = dp.time_used_raw ?? 0;
    if (timeUsedMs < 720_000) continue;

    const local = toZonedTime(parseISO(dp.timestamp), TZ);
    const hour = getHours(local);
    if (hour < startHour || hour >= endHour) continue;

    // Derive avg_occupancy_when_used: the average headcount during occupied time only.
    // occupancy_avg is diluted across the full hour; dividing by usage fraction recovers it.
    // time_used_percentage is already a 0-1 fraction (e.g., 0.5 = 50%), NOT 0-100.
    const usageFraction = dp.time_used_percentage ?? 0;
    const avgWhenUsed =
      usageFraction > 0 && dp.occupancy_avg !== undefined
        ? dp.occupancy_avg / usageFraction
        : dp.occupancy_max;

    const bucket = toBucket(avgWhenUsed);

    overallWeights[bucket] += timeUsedMs;
    overallTotal += timeUsedMs;

    if (!floorWeights.has(room.floor)) {
      floorWeights.set(room.floor, { buckets: emptyBuckets(), total: 0 });
    }
    const fc = floorWeights.get(room.floor)!;
    fc.buckets[bucket] += timeUsedMs;
    fc.total += timeUsedMs;
  }

  function toDistribution(label: string, counts: Record<GroupSizeBucket, number>, total: number): GroupSizeDistribution {
    const buckets = emptyBuckets();
    for (const b of BUCKETS) {
      buckets[b] = total > 0 ? Math.round((counts[b] / total) * 100) : 0;
    }
    return { label, buckets };
  }

  const overall = toDistribution("All Floors", overallWeights, overallTotal);

  const byFloor: GroupSizeDistribution[] = [...floorWeights.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([floor, data]) => toDistribution(floor, data.buckets, data.total));

  return { overall, byFloor };
}
