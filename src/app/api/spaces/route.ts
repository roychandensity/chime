import { NextResponse } from "next/server";
import { fetchAllSpaces } from "@/lib/density-client";
import type { DensitySpace, ChimeSpace, ChimeSpacesResponse, SpaceFunction } from "@/lib/types";

const BUILDING_ID = process.env.DENSITY_BUILDING_ID || "spc_1509663006617764492";

let cachedResult: ChimeSpacesResponse | null = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function mapFunction(raw: string | null | undefined): SpaceFunction {
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

const OPEN_CLOSE_LABELS = ["Open", "Quiet", "Offline"];
const WORK_POINT_LABELS = ["Traditional workpoint", "Workstation"];

function toDensitySpace(raw: { id: string; name: string; capacity?: number | null; labels?: { name?: string }[] | null }, floorName: string): DensitySpace {
  const neighborhood = extractLabel(raw.labels, "Neighborhood:", "No Neighborhood");
  const deskType = extractLabel(raw.labels, "Desk Type:", "Unclassified");

  const openCloseLabel = raw.labels?.find((l) => l.name && OPEN_CLOSE_LABELS.includes(l.name));
  const openClose = openCloseLabel?.name ?? "Unclassified";

  const workPointLabel = raw.labels?.find((l) => l.name && WORK_POINT_LABELS.includes(l.name));
  const workPointType = workPointLabel?.name ?? "Unclassified";

  return {
    id: raw.id,
    name: raw.name || "Unknown",
    floor: floorName,
    neighborhood,
    workPointType,
    openClose,
    deskType,
    capacity: raw.capacity ?? 1,
  };
}

function toChimeSpace(raw: { id: string; name: string; function?: string | null; capacity?: number | null; labels?: { name?: string }[] | null }, floorName: string): ChimeSpace {
  const neighborhood = extractLabel(raw.labels, "Neighborhood:", "No Neighborhood");
  return {
    id: raw.id,
    name: raw.name || "Unknown",
    function: mapFunction(raw.function),
    floor: floorName,
    capacity: raw.capacity ?? 1,
    neighborhood,
  };
}

export async function GET() {
  try {
    if (cachedResult && Date.now() - cacheTime < CACHE_TTL) {
      return NextResponse.json(cachedResult);
    }

    const rawSpaces = await fetchAllSpaces();
    const spaceById = new Map(rawSpaces.map((s) => [s.id, s]));

    const building = spaceById.get(BUILDING_ID);
    if (!building?.children_ids) {
      throw new Error(`Building ${BUILDING_ID} not found or has no floors`);
    }

    const deskSpaces: DensitySpace[] = [];
    const allChimeSpaces: ChimeSpace[] = [];

    for (const floorId of building.children_ids) {
      const floor = spaceById.get(floorId);
      if (!floor || floor.space_type !== "floor") continue;

      const floorName = floor.name || "Unknown Floor";

      for (const childId of floor.children_ids ?? []) {
        const child = spaceById.get(childId);
        if (!child) continue;

        const fn = mapFunction(child.function);

        if (fn !== "other" && child.function) {
          allChimeSpaces.push(toChimeSpace(child, floorName));
          if (fn === "desk") {
            deskSpaces.push(toDensitySpace(child, floorName));
          }
        }

        // Check children for nested spaces
        if (child.children_ids?.length) {
          for (const subId of child.children_ids) {
            const sub = spaceById.get(subId);
            if (!sub) continue;

            const subFn = mapFunction(sub.function);
            if (subFn !== "other" && sub.function) {
              allChimeSpaces.push(toChimeSpace(sub, floorName));
              if (subFn === "desk") {
                deskSpaces.push(toDensitySpace(sub, floorName));
              }
            }
          }
        }
      }
    }

    // Group by function
    const spacesByFunction: Record<SpaceFunction, ChimeSpace[]> = {
      desk: [],
      meeting_room: [],
      open_collab: [],
      other: [],
    };
    for (const s of allChimeSpaces) {
      spacesByFunction[s.function].push(s);
    }

    const floors = [...new Set(allChimeSpaces.map((s) => s.floor))].sort();
    const neighborhoods = [...new Set(deskSpaces.map((s) => s.neighborhood))].sort();
    const workPointTypes = [...new Set(deskSpaces.map((s) => s.workPointType))].sort();
    const openCloseTypes = [...new Set(deskSpaces.map((s) => s.openClose))].sort();
    const deskTypes = [...new Set(deskSpaces.map((s) => s.deskType))].sort();

    const result: ChimeSpacesResponse = {
      spaces: deskSpaces,
      allSpaces: allChimeSpaces,
      spacesByFunction,
      floors,
      neighborhoods,
      workPointTypes,
      openCloseTypes,
      deskTypes,
    };

    cachedResult = result;
    cacheTime = Date.now();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching spaces:", error);
    return NextResponse.json(
      { error: "Failed to fetch spaces" },
      { status: 500 }
    );
  }
}
