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
  const spaceById = new Map(spaces.map((s) => [s.id, s]));
  const BUILDING_ID = process.env.DENSITY_BUILDING_ID!;
  const building = spaceById.get(BUILDING_ID)!;

  // Collect all function values
  const functions = new Map<string, number>();
  const spaceTypes = new Map<string, number>();
  const sampleByFunction = new Map<string, any>();

  for (const floorId of building.children_ids ?? []) {
    const floor = spaceById.get(floorId);
    if (!floor) continue;

    for (const childId of floor.children_ids ?? []) {
      const child = spaceById.get(childId);
      if (!child) continue;

      const fn = child.function || "(null)";
      const st = child.space_type || "(null)";
      functions.set(fn, (functions.get(fn) || 0) + 1);
      spaceTypes.set(st, (spaceTypes.get(st) || 0) + 1);
      if (!sampleByFunction.has(fn)) {
        sampleByFunction.set(fn, { name: child.name, id: child.id, space_type: st, labels: child.labels?.map((l: any) => l.name) });
      }

      for (const subId of child.children_ids ?? []) {
        const sub = spaceById.get(subId);
        if (!sub) continue;
        const subFn = sub.function || "(null)";
        const subSt = sub.space_type || "(null)";
        functions.set(subFn, (functions.get(subFn) || 0) + 1);
        spaceTypes.set(subSt, (spaceTypes.get(subSt) || 0) + 1);
        if (!sampleByFunction.has(subFn)) {
          sampleByFunction.set(subFn, { name: sub.name, id: sub.id, space_type: subSt, labels: sub.labels?.map((l: any) => l.name) });
        }
      }
    }
  }

  console.log("Function values:");
  for (const [fn, count] of [...functions.entries()].sort()) {
    const sample = sampleByFunction.get(fn);
    console.log(`  "${fn}": ${count} spaces`);
    if (sample) console.log(`    Sample: ${sample.name} (${sample.id}), type=${sample.space_type}, labels=${JSON.stringify(sample.labels)}`);
  }

  console.log("\nSpace types:");
  for (const [st, count] of [...spaceTypes.entries()].sort()) {
    console.log(`  "${st}": ${count}`);
  }
}

main().catch(console.error);
