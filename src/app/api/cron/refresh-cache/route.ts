import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { format, subWeeks } from "date-fns";
import { fetchAllSpaces, fetchMetrics, splitDateRange } from "@/lib/density-client";
import { computeSaturation } from "@/lib/compute-saturation";
import { computeAvailability } from "@/lib/compute-availability";
import { computeGroupSize } from "@/lib/compute-group-size";
import { setCache } from "@/lib/cache";
import type { ChimeSpace, SpaceFunction } from "@/lib/types";

const BUILDING_ID = process.env.DENSITY_BUILDING_ID || "spc_1509663006617764492";

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

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const endDate = format(new Date(), "yyyy-MM-dd");
    const startDate = format(subWeeks(new Date(), 4), "yyyy-MM-dd");
    const dateRange = `${startDate}_${endDate}`;

    // Fetch all spaces
    const rawSpaces = await fetchAllSpaces();
    const spaceById = new Map(rawSpaces.map((s) => [s.id, s]));
    const building = spaceById.get(BUILDING_ID);

    if (!building?.children_ids) {
      throw new Error(`Building ${BUILDING_ID} not found`);
    }

    const allChimeSpaces: ChimeSpace[] = [];
    for (const floorId of building.children_ids) {
      const floor = spaceById.get(floorId);
      if (!floor || floor.space_type !== "floor") continue;
      const floorName = floor.name || "Unknown Floor";

      for (const childId of floor.children_ids ?? []) {
        const child = spaceById.get(childId);
        if (!child) continue;
        const fn = mapFunction(child.function);
        if (fn !== "other") {
          allChimeSpaces.push({
            id: child.id,
            name: child.name,
            function: fn,
            floor: floorName,
            capacity: child.capacity ?? 1,
            neighborhood: extractLabel(child.labels, "Neighborhood:", "No Neighborhood"),
          });
        }
        if (child.children_ids?.length) {
          for (const subId of child.children_ids) {
            const sub = spaceById.get(subId);
            if (!sub) continue;
            const subFn = mapFunction(sub.function);
            if (subFn !== "other") {
              allChimeSpaces.push({
                id: sub.id,
                name: sub.name,
                function: subFn,
                floor: floorName,
                capacity: sub.capacity ?? 1,
                neighborhood: extractLabel(sub.labels, "Neighborhood:", "No Neighborhood"),
              });
            }
          }
        }
      }
    }

    const spacesByType: Record<SpaceFunction, ChimeSpace[]> = {
      desk: allChimeSpaces.filter((s) => s.function === "desk"),
      meeting_room: allChimeSpaces.filter((s) => s.function === "meeting_room"),
      open_collab: allChimeSpaces.filter((s) => s.function === "open_collab"),
      other: [],
    };

    const ranges = splitDateRange(startDate, endDate);

    // Refresh saturation for each space type
    for (const [spaceType, spaces] of Object.entries(spacesByType)) {
      if (spaces.length === 0 || spaceType === "other") continue;
      const spaceIds = spaces.map((s) => s.id);

      const allMetrics = [];
      for (const range of ranges) {
        const metrics = await fetchMetrics(spaceIds, range.start, range.end, "hour");
        allMetrics.push(...metrics);
      }

      const saturation = computeSaturation(allMetrics, spaces);
      await setCache(`saturation:${spaceType}`, dateRange, BUILDING_ID, saturation);

      if (spaceType === "meeting_room") {
        const availability = computeAvailability(allMetrics, spaces);
        await setCache("availability", dateRange, BUILDING_ID, availability);

        const groupSize = computeGroupSize(allMetrics, spaces);
        await setCache("group_size", dateRange, BUILDING_ID, groupSize);
      }
    }

    return NextResponse.json({ success: true, spaceCounts: {
      desk: spacesByType.desk.length,
      meeting_room: spacesByType.meeting_room.length,
      open_collab: spacesByType.open_collab.length,
    }});
  } catch (error) {
    console.error("Cron refresh failed:", error);
    return NextResponse.json(
      { error: "Cache refresh failed" },
      { status: 500 }
    );
  }
}
