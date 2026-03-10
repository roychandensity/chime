import type { MetricsDataPoint } from "./density-client";
import type { ChimeSpace, AvailabilityHeatmapData, AvailabilityCell } from "./types";
import { toZonedTime } from "date-fns-tz";
import { getDay, getHours, parseISO } from "date-fns";

const TZ = process.env.TIMEZONE ?? "America/Los_Angeles";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Compute meeting room availability heatmap.
 *
 * For each floor x day-of-week cell:
 * - A room is "available" during a peak hour if occupancy_max === 0
 * - We average available/total across all matching dates
 */
export function computeAvailability(
  metrics: MetricsDataPoint[],
  rooms: ChimeSpace[],
  peakHours: number[] = [10, 14]
): AvailabilityHeatmapData {
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  // Group rooms by floor
  const floorRooms = new Map<string, ChimeSpace[]>();
  for (const room of rooms) {
    if (!floorRooms.has(room.floor)) {
      floorRooms.set(room.floor, []);
    }
    floorRooms.get(room.floor)!.push(room);
  }

  const floors = [...floorRooms.keys()].sort();

  // For each floor x dow x date: count available and total rooms during peak hours
  // Key: "floor:dow:date" -> { available: number, total: number }
  const cellData = new Map<string, { available: number; total: number }>();
  const peakSet = new Set(peakHours);

  for (const dp of metrics) {
    const room = roomById.get(dp.space_id);
    if (!room) continue;
    if (dp.occupancy_max === undefined) continue;

    const local = toZonedTime(parseISO(dp.timestamp), TZ);
    const hour = getHours(local);
    if (!peakSet.has(hour)) continue;

    const dow = getDay(local);
    const dateKey = dp.timestamp.slice(0, 10);
    const cellKey = `${room.floor}:${dow}:${dateKey}`;

    if (!cellData.has(cellKey)) {
      cellData.set(cellKey, { available: 0, total: 0 });
    }
    const cell = cellData.get(cellKey)!;
    cell.total++;
    if (dp.occupancy_max === 0) {
      cell.available++;
    }
  }

  // Average across dates for each floor x dow
  const dateCounts = new Map<string, number>(); // "floor:dow" -> number of dates
  const dateAgg = new Map<string, { available: number; total: number }>();

  for (const [key, data] of cellData) {
    const parts = key.split(":");
    const floorDow = `${parts[0]}:${parts[1]}`;

    if (!dateAgg.has(floorDow)) {
      dateAgg.set(floorDow, { available: 0, total: 0 });
      dateCounts.set(floorDow, 0);
    }
    dateAgg.get(floorDow)!.available += data.available;
    dateAgg.get(floorDow)!.total += data.total;
    dateCounts.set(floorDow, dateCounts.get(floorDow)! + 1);
  }

  // Build matrix
  const daysOfWeek = [1, 2, 3, 4, 5].map((dow) => ({
    dayOfWeek: dow,
    dayLabel: DAY_LABELS[dow],
  }));

  const matrix: Record<string, Record<number, AvailabilityCell>> = {};
  for (const floor of floors) {
    matrix[floor] = {};
    const floorRoomCount = floorRooms.get(floor)?.length ?? 0;

    for (const { dayOfWeek } of daysOfWeek) {
      const floorDow = `${floor}:${dayOfWeek}`;
      const agg = dateAgg.get(floorDow);
      const numDates = dateCounts.get(floorDow) ?? 0;

      if (!agg || numDates === 0) {
        matrix[floor][dayOfWeek] = {
          available: floorRoomCount,
          total: floorRoomCount,
          saturationPercent: 0,
        };
      } else {
        const avgAvailable = Math.round(agg.available / numDates);
        const avgTotal = Math.round(agg.total / numDates);
        const totalRoomsForDisplay = Math.max(floorRoomCount, 1);
        const saturation = avgTotal > 0
          ? ((avgTotal - avgAvailable) / avgTotal) * 100
          : 0;

        matrix[floor][dayOfWeek] = {
          available: avgAvailable,
          total: totalRoomsForDisplay,
          saturationPercent: Math.round(saturation),
        };
      }
    }
  }

  return { floors, daysOfWeek, matrix };
}
