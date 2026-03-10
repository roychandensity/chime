/**
 * Detailed validation against the Nov 18, 2024 deck.
 * Tests saturation, availability, group size, and desk classification
 * with exact deck parameters.
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
import { toZonedTime } from "date-fns-tz";
import { getDay, getHours, parseISO } from "date-fns";
import type { ChimeSpace, DensitySpace, MetricsDataPoint } from "../src/lib/types";

const TZ = "America/Los_Angeles";

// ── Reference data from deck ──
const DECK = {
  saturation_rto: { Mon: 71, Tue: 76, Wed: 82 },
  availability_rto_2pm: {
    "SF - L03": { Mon: "4/9", Tue: "3/9", Wed: "2/9" },
    "SF - L04": { Mon: "5/19", Tue: "5/19", Wed: "3/19" },
    "SF - L05": { Mon: "3/13", Tue: "2/13", Wed: "2/13" },
    "SF - L06": { Mon: "2/11", Tue: "1/11", Wed: "2/11" },
    "SF - L07": { Mon: "2/3", Tue: "1/3", Wed: "1/3" },
  },
  groupSize_rto: { "1": 38, "2": 30, "3-5": 23 },
  deskUsage_rto: { "Not Used": 45, "Pit Stop": 14, "In and Out": 23, "Deep Focus": 18 },
  deskByFloor_rto: {
    "SF - L03": { "Not Used": 42, "Pit Stop": 14, "In and Out": 22, "Deep Focus": 21 },
    "SF - L04": { "Not Used": 55, "Pit Stop": 15, "In and Out": 17, "Deep Focus": 13 },
    "SF - L05": { "Not Used": 39, "Pit Stop": 13, "In and Out": 28, "Deep Focus": 19 },
    "SF - L06": { "Not Used": 39, "Pit Stop": 15, "In and Out": 27, "Deep Focus": 18 },
  },
  totalMR: 55,
  totalDesks: 545,
};

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

function cmp(label: string, expected: number, actual: number, tolerance = 5) {
  const diff = actual - expected;
  const status = Math.abs(diff) <= tolerance ? "PASS" : Math.abs(diff) <= tolerance * 2 ? "WARN" : "FAIL";
  const icon = status === "PASS" ? "✓" : status === "WARN" ? "~" : "✗";
  console.log(`  ${icon} ${label}: deck=${expected}% ours=${actual}% (${diff > 0 ? "+" : ""}${diff}) [${status}]`);
}

/**
 * Compute group size using occupancy_max instead of occupancy_avg.
 * The deck likely uses max occupancy to determine group size since
 * hourly avg dilutes the real count.
 */
function computeGroupSizeMax(
  metrics: MetricsDataPoint[],
  rooms: ChimeSpace[],
  startHour: number,
  endHour: number,
  peakHoursOnly?: number[]
) {
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const buckets: Record<string, number> = { "1": 0, "2": 0, "3-5": 0, "6-9": 0, "10+": 0 };
  let total = 0;

  for (const dp of metrics) {
    const room = roomById.get(dp.space_id);
    if (!room) continue;
    if (!dp.occupancy_max || dp.occupancy_max === 0) continue;

    const local = toZonedTime(parseISO(dp.timestamp), TZ);
    const hour = getHours(local);
    if (hour < startHour || hour >= endHour) continue;
    if (peakHoursOnly && !peakHoursOnly.includes(hour)) continue;

    const size = dp.occupancy_max;
    const bucket = size <= 1 ? "1" : size === 2 ? "2" : size <= 5 ? "3-5" : size <= 9 ? "6-9" : "10+";
    buckets[bucket]++;
    total++;
  }

  if (total === 0) return null;
  return Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, Math.round((v / total) * 100)]));
}

async function fetchAllMetrics(spaceIds: string[], startDate: string, endDate: string) {
  const ranges = splitDateRange(startDate, endDate, 7);
  const all: MetricsDataPoint[] = [];
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    process.stdout.write(`  Chunk ${i + 1}/${ranges.length}...`);
    const data = await fetchMetrics(spaceIds, r.start, r.end, "hour");
    all.push(...data);
    console.log(` ${data.length} pts`);
    if (i < ranges.length - 1) await new Promise((r) => setTimeout(r, 300));
  }
  return all;
}

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   Chime Deck Validation (Nov 18, 2024 deck)     ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // ── Step 1: Load spaces ──
  console.log("Loading spaces...");
  const rawSpaces = await fetchAllSpaces();
  const spaceById = new Map(rawSpaces.map((s) => [s.id, s]));
  const building = spaceById.get(process.env.DENSITY_BUILDING_ID!)!;
  console.log(`Building: ${building.name}\n`);

  const meetingRooms: ChimeSpace[] = [];
  const desks: ChimeSpace[] = [];
  const deskSpaces: DensitySpace[] = [];

  for (const floorId of building.children_ids ?? []) {
    const floor = spaceById.get(floorId);
    if (!floor || floor.space_type !== "floor") continue;
    const floorName = floor.name || "?";

    const process_ = (child: any) => {
      const fn = mapFunction(child.function);
      if (fn === "meeting_room") {
        meetingRooms.push({ id: child.id, name: child.name, function: "meeting_room", floor: floorName, capacity: child.capacity ?? 1, neighborhood: extractLabel(child.labels, "Neighborhood:", "") });
      } else if (fn === "desk") {
        desks.push({ id: child.id, name: child.name, function: "desk", floor: floorName, capacity: child.capacity ?? 1, neighborhood: extractLabel(child.labels, "Neighborhood:", "") });
        deskSpaces.push({ id: child.id, name: child.name, floor: floorName, neighborhood: extractLabel(child.labels, "Neighborhood:", ""), workPointType: "", openClose: "", deskType: "", capacity: child.capacity ?? 1 });
      }
    };

    for (const childId of floor.children_ids ?? []) {
      const child = spaceById.get(childId);
      if (!child) continue;
      process_(child);
      for (const subId of child.children_ids ?? []) {
        const sub = spaceById.get(subId);
        if (sub) process_(sub);
      }
    }
  }

  console.log(`Meeting rooms: ${meetingRooms.length} (deck: ${DECK.totalMR})`);
  console.log(`Desks: ${desks.length} (deck: ${DECK.totalDesks})`);
  for (const f of [...new Set(meetingRooms.map(r => r.floor))].sort()) {
    console.log(`  ${f}: ${meetingRooms.filter(r => r.floor === f).length} MRs`);
  }

  // ── Step 2: Fetch metrics ──
  console.log("\nFetching meeting room metrics (Sep 9 - Nov 1, 2024)...");
  const mrIds = meetingRooms.map(r => r.id);
  const mrMetrics = await fetchAllMetrics(mrIds, "2024-09-09", "2024-11-01");

  // Filter Mon-Wed
  const mrMTW = mrMetrics.filter(dp => {
    const dow = getDay(toZonedTime(parseISO(dp.timestamp), TZ));
    return dow >= 1 && dow <= 3;
  });
  console.log(`Total: ${mrMetrics.length} pts → Mon-Wed: ${mrMTW.length}\n`);

  // ══════════════════════════════════════
  // SLIDE 3: Meeting Room Saturation
  // ══════════════════════════════════════
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SLIDE 3: Meeting Room Saturation (RTO)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const sat = computeSaturation(mrMTW, meetingRooms, 8, 18);
  const dayNames = ["", "Mon", "Tue", "Wed"];
  for (const day of sat) {
    if (day.dayOfWeek > 3) continue;
    const peak = Math.round(Math.max(...day.series.map(p => p.saturationPercent)));
    const deckPeak = DECK.saturation_rto[dayNames[day.dayOfWeek] as keyof typeof DECK.saturation_rto];
    cmp(`${day.dayLabel} peak`, deckPeak, peak);
  }

  // Check: maybe deck counts 55 rooms, we have 58. Re-run with 55 rooms.
  console.log(`\n  Note: We have ${meetingRooms.length} rooms, deck had ${DECK.totalMR}.`);
  console.log(`  If 3 rooms were added since deck, denominator difference explains ~5% shift.`);

  // ══════════════════════════════════════
  // SLIDE 4: Availability (2pm-3pm)
  // ══════════════════════════════════════
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SLIDE 4: Meeting Room Availability (2pm)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const avail = computeAvailability(mrMTW, meetingRooms, [14]);
  console.log("  Floor        | Mon        | Tue        | Wed");
  console.log("  -------------|------------|------------|----------");
  for (const floor of avail.floors) {
    const deckFloor = DECK.availability_rto_2pm[floor as keyof typeof DECK.availability_rto_2pm];
    const cols = [];
    for (let dow = 1; dow <= 3; dow++) {
      const cell = avail.matrix[floor]?.[dow];
      const actual = cell ? `${cell.available}/${cell.total}` : "?";
      const expected = deckFloor?.[dayNames[dow] as "Mon"|"Tue"|"Wed"] ?? "?";
      const match = actual === expected ? "✓" : "✗";
      cols.push(`${match} ${actual.padStart(5)} (${expected})`);
    }
    console.log(`  ${floor.padEnd(13)}| ${cols.join(" | ")}`);
  }

  // ══════════════════════════════════════
  // SLIDE 5: Group Size
  // ══════════════════════════════════════
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SLIDE 5: Group Size Distribution");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Method A: Current pipeline (occupancy_avg, all hours 8-18)
  const gs = computeGroupSize(mrMTW, meetingRooms, 8, 18);
  console.log("  Method A: occupancy_avg, all hours 8am-6pm:");
  cmp("1 person", DECK.groupSize_rto["1"], gs.overall.buckets["1"]);
  cmp("2 people", DECK.groupSize_rto["2"], gs.overall.buckets["2"]);
  cmp("3-5 people", DECK.groupSize_rto["3-5"], gs.overall.buckets["3-5"]);

  // Method B: occupancy_max, all hours
  const gsMax = computeGroupSizeMax(mrMTW, meetingRooms, 8, 18);
  if (gsMax) {
    console.log("\n  Method B: occupancy_max, all hours 8am-6pm:");
    cmp("1 person", DECK.groupSize_rto["1"], gsMax["1"]);
    cmp("2 people", DECK.groupSize_rto["2"], gsMax["2"]);
    cmp("3-5 people", DECK.groupSize_rto["3-5"], gsMax["3-5"]);
  }

  // Method C: occupancy_max, peak hours only (11am-12pm, 2pm-3pm)
  const gsPeak = computeGroupSizeMax(mrMTW, meetingRooms, 8, 18, [11, 14]);
  if (gsPeak) {
    console.log("\n  Method C: occupancy_max, peak hours only (11am, 2pm):");
    cmp("1 person", DECK.groupSize_rto["1"], gsPeak["1"]);
    cmp("2 people", DECK.groupSize_rto["2"], gsPeak["2"]);
    cmp("3-5 people", DECK.groupSize_rto["3-5"], gsPeak["3-5"]);
  }

  // Method D: occupancy_avg, peak hours only
  const gsPeakAvg = computeGroupSize(
    mrMTW.filter(dp => {
      const h = getHours(toZonedTime(parseISO(dp.timestamp), TZ));
      return h === 11 || h === 14;
    }),
    meetingRooms, 8, 18
  );
  console.log("\n  Method D: occupancy_avg, peak hours only (11am, 2pm):");
  cmp("1 person", DECK.groupSize_rto["1"], gsPeakAvg.overall.buckets["1"]);
  cmp("2 people", DECK.groupSize_rto["2"], gsPeakAvg.overall.buckets["2"]);
  cmp("3-5 people", DECK.groupSize_rto["3-5"], gsPeakAvg.overall.buckets["3-5"]);

  // ══════════════════════════════════════
  // SLIDES 7+8: Desk Classification
  // ══════════════════════════════════════
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SLIDES 7+8: Desk Usage Classification");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log(`Fetching sessions for ${deskSpaces.length} desks...`);
  const chunks = chunkArray(deskSpaces.map(d => d.id), 20);
  let allSessions: any[] = [];

  for (let i = 0; i < chunks.length; i++) {
    process.stdout.write(`  Batch ${i + 1}/${chunks.length}...`);
    try {
      const sessions = await fetchSessions(chunks[i], "2024-09-09", "2024-11-01");
      const merged = mergeRawDetections(sessions);
      allSessions.push(...merged);
      console.log(` ${merged.length} sessions`);
    } catch (err: any) {
      console.log(` ERROR: ${err.message.slice(0, 80)}`);
    }
    if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nTotal merged sessions: ${allSessions.length}`);

  const result = classifyDesks(deskSpaces, allSessions, "2024-09-09", "2024-11-01", { start_hour: 8, end_hour: 18 }, [1, 2, 3]);
  const total = result.summary.total;
  const pct = (cat: string) => Math.round((result.summary[cat as keyof typeof result.summary] as number / total) * 100);

  console.log(`\nOverall (${total} desks):`);
  cmp("Not Used", DECK.deskUsage_rto["Not Used"], pct("Not Used"));
  cmp("Pit Stop", DECK.deskUsage_rto["Pit Stop"], pct("Pit Stop"));
  cmp("In and Out", DECK.deskUsage_rto["In and Out"], pct("In and Out"));
  cmp("Deep Focus", DECK.deskUsage_rto["Deep Focus"], pct("Deep Focus"));

  console.log("\nBy floor:");
  for (const [floor, expected] of Object.entries(DECK.deskByFloor_rto)) {
    const fd = result.floorSummary[floor];
    if (!fd) { console.log(`  ${floor}: NO DATA`); continue; }
    const ft = fd["Not Used"] + fd["Pit Stop"] + fd["In and Out"] + fd["Deep Focus"];
    if (ft === 0) { console.log(`  ${floor}: 0 desks`); continue; }
    const fp = (cat: string) => Math.round(((fd as any)[cat] / ft) * 100);

    console.log(`\n  ${floor} (${ft} desks):`);
    cmp("Not Used", expected["Not Used"], fp("Not Used"));
    cmp("Pit Stop", expected["Pit Stop"], fp("Pit Stop"));
    cmp("In and Out", expected["In and Out"], fp("In and Out"));
    cmp("Deep Focus", expected["Deep Focus"], fp("Deep Focus"));
  }

  console.log("\n\n╔══════════════════════════════════════════════════╗");
  console.log("║              Validation Complete                  ║");
  console.log("╚══════════════════════════════════════════════════╝");
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
