import { readFileSync } from "fs";
const envContent = readFileSync(".env.local", "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  process.env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
}

// Override timezone to Dublin for this Stripe building
process.env.TIMEZONE = "Europe/Dublin";

import { fetchAllSpaces, fetchMetrics } from "../src/lib/density-client";
import { computeSaturation } from "../src/lib/compute-saturation";
import type { ChimeSpace } from "../src/lib/types";

function mapFunction(raw: string | null | undefined): string {
  if (!raw) return "other";
  const lower = raw.toLowerCase();
  if (lower === "desk") return "desk";
  if (lower === "meeting_room" || lower === "conference_room") return "meeting_room";
  return "other";
}

async function main() {
  const BUILDING_ID = process.env.DENSITY_BUILDING_ID!;
  const rawSpaces = await fetchAllSpaces();
  const spaceById = new Map(rawSpaces.map((s) => [s.id, s]));
  const building = spaceById.get(BUILDING_ID)!;

  // Collect a small set of meeting rooms from one floor
  const meetingRooms: ChimeSpace[] = [];
  for (const floorId of building.children_ids ?? []) {
    const floor = spaceById.get(floorId);
    if (!floor || floor.space_type !== "floor") continue;
    for (const childId of floor.children_ids ?? []) {
      const child = spaceById.get(childId);
      if (!child) continue;
      if (mapFunction(child.function) === "meeting_room") {
        meetingRooms.push({
          id: child.id,
          name: child.name,
          function: "meeting_room",
          floor: floor.name || "Unknown",
          capacity: child.capacity ?? 1,
          neighborhood: "Unknown",
        });
      }
    }
    if (meetingRooms.length > 10) break;
  }

  console.log(`Testing with ${meetingRooms.length} meeting rooms from ${meetingRooms[0]?.floor}`);
  const ids = meetingRooms.map((r) => r.id);

  // Try a single week in Oct 2024
  console.log("\nFetching metrics for Oct 7-13, 2024...");
  const metrics = await fetchMetrics(ids, "2024-10-07", "2024-10-13", "hour");
  console.log(`  Got ${metrics.length} data points`);

  // Check how many have non-zero occupancy
  const nonZero = metrics.filter((dp: any) => dp.occupancy_max > 0);
  console.log(`  Non-zero occupancy_max: ${nonZero.length}`);

  if (nonZero.length > 0) {
    console.log(`  Sample non-zero: ${JSON.stringify(nonZero[0])}`);

    // Run saturation with Dublin timezone
    const saturation = computeSaturation(metrics, meetingRooms, 8, 18);
    console.log("\nSaturation (Europe/Dublin):");
    for (const day of saturation) {
      const peak = Math.max(...day.series.map((p) => p.saturationPercent));
      if (peak > 0) {
        console.log(`  ${day.dayLabel}: peak = ${peak}%`);
        console.log(`    ${day.series.map((p) => `${p.hour}h=${p.saturationPercent}%`).join(", ")}`);
      }
    }
  } else {
    console.log("\n  No occupancy data found. Checking a few different weeks...");
    for (const week of ["2024-07-01", "2024-08-01", "2024-09-01", "2024-11-01", "2024-12-01", "2025-01-01"]) {
      const endDate = new Date(week);
      endDate.setDate(endDate.getDate() + 6);
      const m = await fetchMetrics(ids, week, endDate.toISOString().slice(0, 10), "hour");
      const nz = m.filter((dp: any) => dp.occupancy_max > 0).length;
      console.log(`    ${week}: ${m.length} points, ${nz} non-zero`);
      if (nz > 0) break;
    }
  }
}

main().catch(console.error);
