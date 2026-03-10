/**
 * Tune MERGE_GAP_MS by testing multiple values against the deck's desk classification.
 * Fetches raw sessions once, then re-merges with different gaps.
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

import { fetchAllSpaces, fetchSessions, type RawDensitySession } from "../src/lib/density-client";
import { classifyDesks } from "../src/lib/classify";
import { chunkArray } from "../src/lib/batch";
import type { DensitySpace } from "../src/lib/types";

const DECK = {
  overall: { "Not Used": 45, "Pit Stop": 14, "In and Out": 23, "Deep Focus": 18 },
  byFloor: {
    "SF - L03": { "Not Used": 42, "Pit Stop": 14, "In and Out": 22, "Deep Focus": 21 },
    "SF - L04": { "Not Used": 55, "Pit Stop": 15, "In and Out": 17, "Deep Focus": 13 },
    "SF - L05": { "Not Used": 39, "Pit Stop": 13, "In and Out": 28, "Deep Focus": 19 },
    "SF - L06": { "Not Used": 39, "Pit Stop": 15, "In and Out": 27, "Deep Focus": 18 },
  },
};

function extractLabel(labels: { name?: string }[] | null | undefined, prefix: string, fallback: string): string {
  const label = labels?.find((l) => l.name?.startsWith(prefix));
  return label?.name ? label.name.replace(prefix, "").trim() : fallback;
}

/**
 * Re-implementation of mergeRawDetections with configurable parameters.
 */
function mergeWithParams(
  rawSessions: RawDensitySession[],
  mergeGapMs: number,
  minDetections: number,
  minSpanMs: number,
): RawDensitySession[] {
  const bySpace = new Map<string, RawDensitySession[]>();
  for (const s of rawSessions) {
    let list = bySpace.get(s.space_id);
    if (!list) { list = []; bySpace.set(s.space_id, list); }
    list.push(s);
  }

  const merged: RawDensitySession[] = [];

  for (const [spaceId, detections] of bySpace) {
    detections.sort((a, b) => a.start.localeCompare(b.start));

    let curStart = detections[0].start;
    let curEnd = detections[0].end;
    let curCount = 1;
    let curDetectedMs = new Date(detections[0].end).getTime() - new Date(detections[0].start).getTime();

    for (let i = 1; i < detections.length; i++) {
      const det = detections[i];
      const gapMs = new Date(det.start).getTime() - new Date(curEnd).getTime();

      if (gapMs <= mergeGapMs) {
        if (det.end > curEnd) curEnd = det.end;
        curCount++;
        curDetectedMs += new Date(det.end).getTime() - new Date(det.start).getTime();
      } else {
        const spanMs = new Date(curEnd).getTime() - new Date(curStart).getTime();
        if (curCount >= minDetections && spanMs >= minSpanMs) {
          merged.push({ space_id: spaceId, start: curStart, end: curEnd, detected_minutes: curDetectedMs / 60000 });
        }
        curStart = det.start;
        curEnd = det.end;
        curCount = 1;
        curDetectedMs = new Date(det.end).getTime() - new Date(det.start).getTime();
      }
    }
    const spanMs = new Date(curEnd).getTime() - new Date(curStart).getTime();
    if (curCount >= minDetections && spanMs >= minSpanMs) {
      merged.push({ space_id: spaceId, start: curStart, end: curEnd, detected_minutes: curDetectedMs / 60000 });
    }
  }

  return merged;
}

function score(actual: Record<string, number>, expected: Record<string, number>): number {
  let totalErr = 0;
  for (const key of Object.keys(expected)) {
    totalErr += Math.abs((actual[key] || 0) - expected[key]);
  }
  return totalErr;
}

async function main() {
  console.log("=== Merge Gap Tuning ===\n");

  // Load spaces
  const rawSpaces = await fetchAllSpaces();
  const spaceById = new Map(rawSpaces.map((s) => [s.id, s]));
  const building = spaceById.get(process.env.DENSITY_BUILDING_ID!)!;

  const deskSpaces: DensitySpace[] = [];
  for (const floorId of building.children_ids ?? []) {
    const floor = spaceById.get(floorId);
    if (!floor || floor.space_type !== "floor") continue;
    const floorName = floor.name || "?";

    for (const childId of floor.children_ids ?? []) {
      const child = spaceById.get(childId);
      if (!child) continue;
      if ((child.function || "").toLowerCase() === "desk") {
        deskSpaces.push({
          id: child.id, name: child.name || "?", floor: floorName,
          neighborhood: extractLabel(child.labels, "Neighborhood:", ""),
          workPointType: "", openClose: "", deskType: "", capacity: child.capacity ?? 1,
        });
      }
    }
  }

  console.log(`Desks: ${deskSpaces.length}\n`);

  // Fetch raw sessions (unmerged)
  console.log("Fetching raw sessions (Sep 9 - Nov 1, 2024)...");
  const chunks = chunkArray(deskSpaces.map(d => d.id), 20);
  let allRaw: RawDensitySession[] = [];

  for (let i = 0; i < chunks.length; i++) {
    process.stdout.write(`  Batch ${i + 1}/${chunks.length}...`);
    try {
      const sessions = await fetchSessions(chunks[i], "2024-09-09", "2024-11-01");
      allRaw.push(...sessions);
      console.log(` ${sessions.length} raw detections`);
    } catch (err: any) {
      console.log(` ERROR: ${err.message.slice(0, 80)}`);
    }
    if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\nTotal raw detections: ${allRaw.length}\n`);

  // Test different merge gap values
  const gapValues = [5, 8, 10, 12, 15, 18, 20, 25, 30];
  const minDetValues = [2, 3];
  const minSpanValues = [5];

  console.log("Testing merge parameters...\n");
  console.log("Gap(min) | MinDet | Sessions | Not Used | Pit Stop | In&Out | DeepFocus | Score");
  console.log("---------|--------|----------|----------|----------|--------|-----------|------");

  let bestScore = Infinity;
  let bestParams = { gap: 0, minDet: 0 };

  for (const gapMin of gapValues) {
    for (const minDet of minDetValues) {
      const gapMs = gapMin * 60 * 1000;
      const minSpanMs = 5 * 60 * 1000;

      const merged = mergeWithParams(allRaw, gapMs, minDet, minSpanMs);

      const result = classifyDesks(
        deskSpaces, merged,
        "2024-09-09", "2024-11-01",
        { start_hour: 8, end_hour: 18 },
        [1, 2, 3]
      );

      const total = result.summary.total;
      const pcts: Record<string, number> = {
        "Not Used": Math.round((result.summary["Not Used"] / total) * 100),
        "Pit Stop": Math.round((result.summary["Pit Stop"] / total) * 100),
        "In and Out": Math.round((result.summary["In and Out"] / total) * 100),
        "Deep Focus": Math.round((result.summary["Deep Focus"] / total) * 100),
      };

      const s = score(pcts, DECK.overall);
      const best = s < bestScore;
      if (best) { bestScore = s; bestParams = { gap: gapMin, minDet }; }

      console.log(
        `${String(gapMin).padStart(8)} | ${String(minDet).padStart(6)} | ${String(merged.length).padStart(8)} | ` +
        `${String(pcts["Not Used"]).padStart(7)}% | ${String(pcts["Pit Stop"]).padStart(7)}% | ` +
        `${String(pcts["In and Out"]).padStart(5)}% | ${String(pcts["Deep Focus"]).padStart(8)}% | ` +
        `${String(s).padStart(4)}${best ? " ← best" : ""}`
      );
    }
  }

  console.log(`\nDeck target: Not Used=${DECK.overall["Not Used"]}% Pit Stop=${DECK.overall["Pit Stop"]}% In&Out=${DECK.overall["In and Out"]}% Deep Focus=${DECK.overall["Deep Focus"]}%`);
  console.log(`\nBest params: MERGE_GAP_MS = ${bestParams.gap} min, MIN_DETECTIONS = ${bestParams.minDet} (score: ${bestScore})`);

  // Show by-floor breakdown for best params
  console.log("\n\n=== By-floor with best params ===\n");
  const bestMerged = mergeWithParams(allRaw, bestParams.gap * 60 * 1000, bestParams.minDet, 5 * 60 * 1000);
  const bestResult = classifyDesks(deskSpaces, bestMerged, "2024-09-09", "2024-11-01", { start_hour: 8, end_hour: 18 }, [1, 2, 3]);

  for (const [floor, expected] of Object.entries(DECK.byFloor)) {
    const fd = bestResult.floorSummary[floor];
    if (!fd) { console.log(`${floor}: NO DATA`); continue; }
    const ft = fd["Not Used"] + fd["Pit Stop"] + fd["In and Out"] + fd["Deep Focus"];
    if (ft === 0) continue;
    const fp = (cat: string) => Math.round(((fd as any)[cat] / ft) * 100);

    console.log(`${floor} (${ft} desks):`);
    for (const cat of ["Not Used", "Pit Stop", "In and Out", "Deep Focus"] as const) {
      const actual = fp(cat);
      const exp = expected[cat];
      const diff = actual - exp;
      const icon = Math.abs(diff) <= 5 ? "✓" : Math.abs(diff) <= 10 ? "~" : "✗";
      console.log(`  ${icon} ${cat}: deck=${exp}% ours=${actual}% (${diff > 0 ? "+" : ""}${diff})`);
    }
    console.log();
  }
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
