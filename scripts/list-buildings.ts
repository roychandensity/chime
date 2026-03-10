import { readFileSync } from "fs";
const envContent = readFileSync(".env.local", "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  process.env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
}

import { fetchAllSpaces } from "../src/lib/density-client";

async function main() {
  const spaces = await fetchAllSpaces();
  const buildings = spaces.filter((s: any) => s.space_type === "building");
  const spaceById = new Map(spaces.map((s) => [s.id, s]));

  console.log(`Total spaces: ${spaces.length}`);
  console.log(`\nBuildings found:`);

  for (const b of buildings) {
    console.log(`\n  ${b.name} | ID: ${b.id}`);

    // List floors
    for (const floorId of b.children_ids ?? []) {
      const floor = spaceById.get(floorId);
      if (!floor) continue;
      const childCount = floor.children_ids?.length ?? 0;

      // Count space types on this floor
      let mrCount = 0, deskCount = 0, ocCount = 0;
      for (const childId of floor.children_ids ?? []) {
        const child = spaceById.get(childId);
        if (!child) continue;
        const fn = (child.function || "").toLowerCase();
        if (fn === "meeting_room" || fn === "conference_room") mrCount++;
        else if (fn === "desk") deskCount++;
        else if (fn === "open_collab" || fn === "open_collaboration" || fn === "collaboration") ocCount++;

        // Check nested children
        for (const subId of child.children_ids ?? []) {
          const sub = spaceById.get(subId);
          if (!sub) continue;
          const subFn = (sub.function || "").toLowerCase();
          if (subFn === "meeting_room" || subFn === "conference_room") mrCount++;
          else if (subFn === "desk") deskCount++;
          else if (subFn === "open_collab" || subFn === "open_collaboration" || subFn === "collaboration") ocCount++;
        }
      }

      console.log(`    ${floor.name || "?"} (${floor.space_type}): ${childCount} children | MR=${mrCount} Desk=${deskCount} OC=${ocCount}`);
    }
  }
}

main().catch(console.error);
