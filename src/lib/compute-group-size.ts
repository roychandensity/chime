import type { MetricsDataPoint } from "./density-client";
import type { ChimeSpace, GroupSizeBucket, GroupSizeChartData, GroupSizeDistribution } from "./types";
import { toZonedTime } from "date-fns-tz";
import { getHours, parseISO } from "date-fns";

const TZ = process.env.TIMEZONE ?? "America/Los_Angeles";

const BUCKETS: GroupSizeBucket[] = ["1", "2", "3-5", "6-9", "10+"];

function toBucket(groupSize: number): GroupSizeBucket {
  if (groupSize <= 1) return "1";
  if (groupSize === 2) return "2";
  if (groupSize <= 5) return "3-5";
  if (groupSize <= 9) return "6-9";
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

  // Overall counts
  const overallCounts = emptyBuckets();
  let overallTotal = 0;

  // Per-floor counts
  const floorCounts = new Map<string, { buckets: Record<GroupSizeBucket, number>; total: number }>();

  for (const dp of metrics) {
    const room = roomById.get(dp.space_id);
    if (!room) continue;
    if (dp.occupancy_max === undefined || dp.occupancy_max === 0) continue;

    const local = toZonedTime(parseISO(dp.timestamp), TZ);
    const hour = getHours(local);
    if (hour < startHour || hour >= endHour) continue;

    const groupSize = Math.max(1, Math.round(dp.occupancy_avg ?? dp.occupancy_max));
    const bucket = toBucket(groupSize);

    overallCounts[bucket]++;
    overallTotal++;

    if (!floorCounts.has(room.floor)) {
      floorCounts.set(room.floor, { buckets: emptyBuckets(), total: 0 });
    }
    const fc = floorCounts.get(room.floor)!;
    fc.buckets[bucket]++;
    fc.total++;
  }

  function toDistribution(label: string, counts: Record<GroupSizeBucket, number>, total: number): GroupSizeDistribution {
    const buckets = emptyBuckets();
    for (const b of BUCKETS) {
      buckets[b] = total > 0 ? Math.round((counts[b] / total) * 100) : 0;
    }
    return { label, buckets };
  }

  const overall = toDistribution("All Floors", overallCounts, overallTotal);

  const byFloor: GroupSizeDistribution[] = [...floorCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([floor, data]) => toDistribution(floor, data.buckets, data.total));

  return { overall, byFloor };
}
