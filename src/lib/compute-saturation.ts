import type { MetricsDataPoint } from "./density-client";
import type { ChimeSpace, DayOfWeekSaturation, SaturationPoint } from "./types";
import { toZonedTime } from "date-fns-tz";
import { getDay, getHours, parseISO } from "date-fns";

const TZ = process.env.TIMEZONE ?? "America/Los_Angeles";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Compute day-of-week saturation from hourly metrics.
 *
 * Saturation = % of spaces with occupancy_max > 0 in a given hour.
 * We average across all matching dates for each day-of-week + hour.
 */
export function computeSaturation(
  metrics: MetricsDataPoint[],
  spaces: ChimeSpace[],
  startHour = 8,
  endHour = 17
): DayOfWeekSaturation[] {
  const spaceIdSet = new Set(spaces.map((s) => s.id));
  const totalSpaces = spaceIdSet.size;
  if (totalSpaces === 0) return [];

  // Group metrics by (dayOfWeek, hour) -> list of saturation values per date
  // Key: "dow:hour:dateKey" -> count of spaces with occ > 0
  const occupiedCounts = new Map<string, number>();
  const dateKeys = new Map<string, Set<string>>(); // "dow:hour" -> set of dateKeys

  for (const dp of metrics) {
    if (!spaceIdSet.has(dp.space_id)) continue;
    if (dp.occupancy_max === undefined) continue;

    const local = toZonedTime(parseISO(dp.timestamp), TZ);
    const hour = getHours(local);
    if (hour < startHour || hour >= endHour) continue;

    const dow = getDay(local);
    const dateKey = dp.timestamp.slice(0, 10);
    const bucketKey = `${dow}:${hour}:${dateKey}`;
    const dowHourKey = `${dow}:${hour}`;

    if (dp.occupancy_max > 0) {
      occupiedCounts.set(bucketKey, (occupiedCounts.get(bucketKey) || 0) + 1);
    }

    if (!dateKeys.has(dowHourKey)) {
      dateKeys.set(dowHourKey, new Set());
    }
    dateKeys.get(dowHourKey)!.add(dateKey);
  }

  // Build day-of-week saturation series (Mon-Fri by default)
  const result: DayOfWeekSaturation[] = [];
  for (let dow = 1; dow <= 5; dow++) {
    const series: SaturationPoint[] = [];

    for (let hour = startHour; hour < endHour; hour++) {
      const dowHourKey = `${dow}:${hour}`;
      const dates = dateKeys.get(dowHourKey);

      if (!dates || dates.size === 0) {
        series.push({ hour, saturationPercent: 0 });
        continue;
      }

      // Average saturation across all dates for this dow+hour
      let totalSaturation = 0;
      for (const dateKey of dates) {
        const bucketKey = `${dow}:${hour}:${dateKey}`;
        const occupied = occupiedCounts.get(bucketKey) || 0;
        totalSaturation += (occupied / totalSpaces) * 100;
      }

      series.push({
        hour,
        saturationPercent: Math.round((totalSaturation / dates.size) * 10) / 10,
      });
    }

    result.push({
      dayOfWeek: dow,
      dayLabel: DAY_LABELS[dow],
      series,
    });
  }

  return result;
}
