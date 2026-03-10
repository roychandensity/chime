/**
 * Validate Chime webapp output against the reference slide deck:
 *   "Chime SF HQ Space Usage Insights - 2024.11.18"
 *
 * Deck parameters:
 * - Building: Chime San Francisco HQ (but API token only has Stripe buildings)
 * - Floors 3-7 (meeting rooms), Floors 3-6 (desks)
 * - Post RTO period: Sep 9 - Nov 1, 2024
 * - Days: Mon, Tue, Wed only
 * - Hours: 8am - 6pm
 * - 55 meeting rooms total, 545 desks total
 *
 * NOTE: Since the current API token is for Stripe (not Chime), this script
 * uses OWP building as a stand-in to verify the computation pipeline works
 * correctly with live data. The actual Chime building ID and token need to be
 * configured before production validation.
 */

import { readFileSync } from "fs";
const envContent = readFileSync(".env.local", "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  process.env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
}

import { fetchAllSpaces, fetchMetrics, splitDateRange, fetchSessions, mergeRawDetections } from "../src/lib/density-client";
import { computeSaturation } from "../src/lib/compute-saturation";
import { computeAvailability } from "../src/lib/compute-availability";
import { computeGroupSize } from "../src/lib/compute-group-size";
import { classifyDesks } from "../src/lib/classify";
import { chunkArray } from "../src/lib/batch";
import type { ChimeSpace, DensitySpace } from "../src/lib/types";

// ── Helpers ──

function mapFunction(raw: string | null | undefined): string {
  if (!raw) return "other";
  const lower = raw.toLowerCase();
  if (lower === "desk") return "desk";
  if (lower === "meeting_room" || lower === "conference_room") return "meeting_room";
  if (lower === "open_collab" || lower === "open_collaboration" || lower === "collaboration" || lower === "open_collaboration_space") return "open_collab";
  return "other";
}

function extractLabel(labels: { name?: string }[] | null | undefined, prefix: string, fallback: string): string {
  const label = labels?.find((l) => l.name?.startsWith(prefix));
  return label?.name ? label.name.replace(prefix, "").trim() : fallback;
}

async function fetchAllMetrics(
  spaceIds: string[],
  startDate: string,
  endDate: string,
): Promise<any[]> {
  const ranges = splitDateRange(startDate, endDate, 7);
  const all: any[] = [];

  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    console.log(`  Fetching metrics chunk ${i + 1}/${ranges.length}: ${r.start} to ${r.end}`);
    const data = await fetchMetrics(spaceIds, r.start, r.end, "hour");
    all.push(...data);
    if (i < ranges.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return all;
}

// ── Main ──

async function main() {
  console.log("=== Chime Pipeline Validation ===\n");

  // Step 1: Fetch and organize spaces
  console.log("Step 1: Fetching spaces from Density API...");
  const BUILDING_ID = process.env.DENSITY_BUILDING_ID || "spc_1509663006617764492";
  const rawSpaces = await fetchAllSpaces();
  const spaceById = new Map(rawSpaces.map((s) => [s.id, s]));

  const building = spaceById.get(BUILDING_ID);
  if (!building?.children_ids) {
    console.error(`Building ${BUILDING_ID} not found! Available buildings:`);
    for (const s of rawSpaces) {
      if (s.space_type === "building") {
        console.log(`  - ${s.id}: ${s.name}`);
      }
    }
    process.exit(1);
  }
  console.log(`  Building: ${building.name} (${building.id})`);

  // Walk floors and collect spaces
  const meetingRooms: ChimeSpace[] = [];
  const desks: ChimeSpace[] = [];
  const deskSpaces: DensitySpace[] = [];
  const openCollabs: ChimeSpace[] = [];

  for (const floorId of building.children_ids) {
    const floor = spaceById.get(floorId);
    if (!floor || floor.space_type !== "floor") continue;
    const floorName = floor.name || "Unknown Floor";

    const processSpace = (child: any) => {
      const fn = mapFunction(child.function);
      if (fn === "other") return;

      const chimeSpace: ChimeSpace = {
        id: child.id,
        name: child.name || "Unknown",
        function: fn as "desk" | "meeting_room" | "open_collab",
        floor: floorName,
        capacity: child.capacity ?? 1,
        neighborhood: extractLabel(child.labels, "Neighborhood:", "No Neighborhood"),
      };

      if (fn === "meeting_room") meetingRooms.push(chimeSpace);
      else if (fn === "desk") {
        desks.push(chimeSpace);
        deskSpaces.push({
          id: child.id,
          name: child.name || "Unknown",
          floor: floorName,
          neighborhood: extractLabel(child.labels, "Neighborhood:", "No Neighborhood"),
          workPointType: "Unclassified",
          openClose: "Unclassified",
          deskType: "Unclassified",
          capacity: child.capacity ?? 1,
        });
      }
      else if (fn === "open_collab") openCollabs.push(chimeSpace);
    };

    for (const childId of floor.children_ids ?? []) {
      const child = spaceById.get(childId);
      if (!child) continue;
      processSpace(child);
      if (child.children_ids?.length) {
        for (const subId of child.children_ids) {
          const sub = spaceById.get(subId);
          if (sub) processSpace(sub);
        }
      }
    }
  }

  console.log(`\n  Space counts:`);
  console.log(`    Meeting rooms: ${meetingRooms.length}`);
  console.log(`    Desks: ${desks.length}`);
  console.log(`    Open collab: ${openCollabs.length}`);

  const mrFloors = [...new Set(meetingRooms.map((r) => r.floor))].sort();
  const deskFloors = [...new Set(desks.map((d) => d.floor))].sort();
  console.log(`    MR floors: ${mrFloors.join(", ")}`);
  console.log(`    Desk floors: ${deskFloors.join(", ")}`);

  for (const floor of mrFloors) {
    const count = meetingRooms.filter((r) => r.floor === floor).length;
    console.log(`      ${floor}: ${count} meeting rooms`);
  }

  // Use a recent 4-week range that should have data
  const START_DATE = "2024-09-09";
  const END_DATE = "2024-11-01";

  // ── Test 1: Meeting Room Saturation ──
  console.log("\n\n========================================");
  console.log("TEST 1: Meeting Room Saturation Pipeline");
  console.log(`Date range: ${START_DATE} to ${END_DATE} | Mon-Wed | 8am-6pm`);
  console.log("========================================\n");

  const mrIds = meetingRooms.map((r) => r.id);
  console.log(`Fetching hourly metrics for ${mrIds.length} meeting rooms...`);
  const mrMetrics = await fetchAllMetrics(mrIds, START_DATE, END_DATE);
  console.log(`  Total data points received: ${mrMetrics.length}`);

  if (mrMetrics.length === 0) {
    console.log("  WARNING: No metrics data returned. API may not have data for this date range.");
  } else {
    // Sample a data point
    console.log(`  Sample point: ${JSON.stringify(mrMetrics[0])}`);

    // Filter to Mon/Tue/Wed only
    const { toZonedTime } = await import("date-fns-tz");
    const { getDay, parseISO } = await import("date-fns");
    const TZ = process.env.TIMEZONE || "America/Los_Angeles";

    const mrMetricsMonTueWed = mrMetrics.filter((dp: any) => {
      const local = toZonedTime(parseISO(dp.timestamp), TZ);
      const dow = getDay(local);
      return dow >= 1 && dow <= 3;
    });
    console.log(`  Filtered to Mon-Wed: ${mrMetricsMonTueWed.length} data points\n`);

    const saturation = computeSaturation(mrMetricsMonTueWed, meetingRooms, 8, 18);

    console.log("Saturation results (Mon-Wed):");
    for (const day of saturation) {
      if (day.dayOfWeek > 3) continue;
      const peak = Math.max(...day.series.map((p) => p.saturationPercent));
      console.log(`\n  ${day.dayLabel}: peak = ${Math.round(peak)}%`);
      console.log(`    Hourly: ${day.series.map((p) => `${p.hour}:00=${p.saturationPercent}%`).join(", ")}`);
    }

    // ── Test 2: Availability ──
    console.log("\n\n========================================");
    console.log("TEST 2: Meeting Room Availability Pipeline");
    console.log("========================================\n");

    const availability = computeAvailability(mrMetricsMonTueWed, meetingRooms, [14]);

    console.log("Availability results (2pm peak, Mon-Wed):");
    console.log(`  Floors: ${availability.floors.join(", ")}`);
    for (const floor of availability.floors) {
      const cells = [];
      for (let dow = 1; dow <= 3; dow++) {
        const cell = availability.matrix[floor]?.[dow];
        if (cell) cells.push(`${["", "Mon", "Tue", "Wed"][dow]}=${cell.available}/${cell.total}`);
      }
      console.log(`  ${floor}: ${cells.join(", ")}`);
    }

    // ── Test 3: Group Size ──
    console.log("\n\n========================================");
    console.log("TEST 3: Group Size Distribution Pipeline");
    console.log("========================================\n");

    const groupSize = computeGroupSize(mrMetricsMonTueWed, meetingRooms, 8, 18);

    console.log("Group size distribution:");
    console.log(`  Overall: 1p=${groupSize.overall.buckets["1"]}% 2p=${groupSize.overall.buckets["2"]}% 3-5p=${groupSize.overall.buckets["3-5"]}% 6-9p=${groupSize.overall.buckets["6-9"]}% 10+=${groupSize.overall.buckets["10+"]}%`);
    for (const floor of groupSize.byFloor) {
      console.log(`  ${floor.label}: 1p=${floor.buckets["1"]}% 2p=${floor.buckets["2"]}% 3-5p=${floor.buckets["3-5"]}% 6-9p=${floor.buckets["6-9"]}% 10+=${floor.buckets["10+"]}%`);
    }
  }

  // ── Test 4: Desk Classification ──
  console.log("\n\n========================================");
  console.log("TEST 4: Desk Classification Pipeline");
  console.log(`Date range: ${START_DATE} to ${END_DATE} | Mon-Wed | 8am-6pm`);
  console.log("========================================\n");

  // Only test with a subset of desks to keep it fast
  const testDeskCount = Math.min(desks.length, 50);
  const testDeskIds = deskSpaces.slice(0, testDeskCount).map((d) => d.id);
  console.log(`Fetching sessions for ${testDeskCount} desks (out of ${desks.length})...`);

  const chunks = chunkArray(testDeskIds, 20);
  let allSessions: any[] = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`  Batch ${i + 1}/${chunks.length}...`);
    try {
      const sessions = await fetchSessions(chunks[i], START_DATE, END_DATE);
      const merged = mergeRawDetections(sessions);
      allSessions.push(...merged);
    } catch (err: any) {
      console.log(`    Error: ${err.message}`);
    }
    if (i < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`  Total merged sessions: ${allSessions.length}\n`);

  if (allSessions.length > 0) {
    const result = classifyDesks(
      deskSpaces.slice(0, testDeskCount),
      allSessions,
      START_DATE,
      END_DATE,
      { start_hour: 8, end_hour: 18 },
      [1, 2, 3]
    );

    const total = result.summary.total;
    console.log(`Desk classification (${total} desks):`);
    console.log(`  Not Used:   ${result.summary["Not Used"]} (${Math.round((result.summary["Not Used"] / total) * 100)}%)`);
    console.log(`  Pit Stop:   ${result.summary["Pit Stop"]} (${Math.round((result.summary["Pit Stop"] / total) * 100)}%)`);
    console.log(`  In and Out: ${result.summary["In and Out"]} (${Math.round((result.summary["In and Out"] / total) * 100)}%)`);
    console.log(`  Deep Focus: ${result.summary["Deep Focus"]} (${Math.round((result.summary["Deep Focus"] / total) * 100)}%)`);

    // Show by floor
    console.log("\n  By floor:");
    for (const [floor, data] of Object.entries(result.floorSummary)) {
      const ft = data["Not Used"] + data["Pit Stop"] + data["In and Out"] + data["Deep Focus"];
      if (ft === 0) continue;
      console.log(`    ${floor}: NU=${Math.round((data["Not Used"] / ft) * 100)}% PS=${Math.round((data["Pit Stop"] / ft) * 100)}% IO=${Math.round((data["In and Out"] / ft) * 100)}% DF=${Math.round((data["Deep Focus"] / ft) * 100)}%`);
    }
  }

  console.log("\n\n=== Pipeline Validation Complete ===");
  console.log("\nNOTE: This validation ran against the OWP (Stripe) building.");
  console.log("To match the deck data, update .env.local with the correct");
  console.log("DENSITY_BUILDING_ID for Chime SF HQ and the appropriate API token.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
