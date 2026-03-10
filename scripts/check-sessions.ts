import { readFileSync } from "fs";
const envContent = readFileSync(".env.local", "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  process.env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
}

import { fetchAllSpaces, fetchSessions, mergeRawDetections, fetchMetrics } from "../src/lib/density-client";

function mapFunction(raw: string | null | undefined): string {
  if (!raw) return "other";
  const lower = raw.toLowerCase();
  if (lower === "desk") return "desk";
  if (lower === "meeting_room" || lower === "conference_room") return "meeting_room";
  if (lower === "open_collab" || lower === "open_collaboration" || lower === "collaboration") return "open_collab";
  return "other";
}

async function main() {
  const rawSpaces = await fetchAllSpaces();
  const spaceById = new Map(rawSpaces.map((s) => [s.id, s]));

  // Check ALL buildings for which has actual data
  const buildings = rawSpaces.filter((s: any) => s.space_type === "building");

  for (const building of buildings) {
    console.log(`\n=== Building: ${building.name} (${building.id}) ===`);

    // Get a few meeting rooms and desks from this building
    const rooms: string[] = [];
    const desks: string[] = [];

    for (const floorId of building.children_ids ?? []) {
      const floor = spaceById.get(floorId);
      if (!floor || floor.space_type !== "floor") continue;
      for (const childId of floor.children_ids ?? []) {
        const child = spaceById.get(childId);
        if (!child) continue;
        const fn = mapFunction(child.function);
        if (fn === "meeting_room" && rooms.length < 3) rooms.push(child.id);
        if (fn === "desk" && desks.length < 3) desks.push(child.id);

        // Check nested
        for (const subId of child.children_ids ?? []) {
          const sub = spaceById.get(subId);
          if (!sub) continue;
          const subFn = mapFunction(sub.function);
          if (subFn === "meeting_room" && rooms.length < 3) rooms.push(sub.id);
          if (subFn === "desk" && desks.length < 3) desks.push(sub.id);
        }
      }
    }

    // Test sessions/raw for desks
    if (desks.length > 0) {
      try {
        const sessions = await fetchSessions(desks, "2024-10-01", "2024-10-07");
        const merged = mergeRawDetections(sessions);
        console.log(`  Desks: ${sessions.length} raw sessions -> ${merged.length} merged sessions (${desks.length} desks)`);
      } catch (e: any) {
        console.log(`  Desks sessions error: ${e.message.slice(0, 100)}`);
      }
    } else {
      console.log(`  No desks found`);
    }

    // Test metrics for meeting rooms
    if (rooms.length > 0) {
      try {
        const metrics = await fetchMetrics(rooms, "2024-10-01", "2024-10-07", "hour");
        const nonZero = metrics.filter((dp: any) => dp.occupancy_max > 0);
        console.log(`  MR metrics: ${metrics.length} points, ${nonZero.length} non-zero occ (${rooms.length} rooms)`);
        if (nonZero.length > 0) {
          console.log(`  Sample: ${JSON.stringify(nonZero[0])}`);
        }
      } catch (e: any) {
        console.log(`  MR metrics error: ${e.message.slice(0, 100)}`);
      }
    } else {
      console.log(`  No meeting rooms found`);
    }
  }
}

main().catch(console.error);
