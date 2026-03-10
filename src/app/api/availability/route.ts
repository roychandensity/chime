import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchMetrics, splitDateRange } from "@/lib/density-client";
import { computeAvailability } from "@/lib/compute-availability";
import { getCached, setCache } from "@/lib/cache";
import type { ChimeSpace, AvailabilityHeatmapData } from "@/lib/types";

const BUILDING_ID = process.env.DENSITY_BUILDING_ID || "spc_1509663006617764492";

const RequestSchema = z.object({
  spaces: z.array(z.object({
    id: z.string(),
    name: z.string(),
    function: z.string(),
    floor: z.string(),
    capacity: z.number(),
    neighborhood: z.string(),
  })),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  peakHours: z.array(z.number()).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { spaces, startDate, endDate, peakHours = [10, 14] } = parsed.data;
    const dateRange = `${startDate}_${endDate}`;

    const cached = await getCached<AvailabilityHeatmapData>(
      "availability",
      dateRange,
      BUILDING_ID
    );
    if (cached) {
      return NextResponse.json(cached);
    }

    const ranges = splitDateRange(startDate, endDate);
    const allMetrics = [];
    const spaceIds = spaces.map((s) => s.id);

    for (const range of ranges) {
      const metrics = await fetchMetrics(
        spaceIds,
        range.start,
        range.end,
        "hour",
      );
      allMetrics.push(...metrics);
    }

    const result = computeAvailability(allMetrics, spaces as ChimeSpace[], peakHours);

    await setCache("availability", dateRange, BUILDING_ID, result);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error computing availability:", error);
    return NextResponse.json(
      { error: "Failed to compute availability" },
      { status: 500 }
    );
  }
}
