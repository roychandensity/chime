import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchMetrics, splitDateRange } from "@/lib/density-client";
import { computeSaturation } from "@/lib/compute-saturation";
import { getCached, setCache } from "@/lib/cache";
import type { ChimeSpace, DayOfWeekSaturation } from "@/lib/types";

const BUILDING_ID = process.env.DENSITY_BUILDING_ID || "spc_1509663006617764492";

const RequestSchema = z.object({
  spaceType: z.string(),
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
  startHour: z.number().min(0).max(23).optional(),
  endHour: z.number().min(1).max(24).optional(),
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

    const { spaceType, spaces, startDate, endDate, startHour = 8, endHour = 17 } = parsed.data;
    const dateRange = `${startDate}_${endDate}`;

    // Check cache
    const cached = await getCached<DayOfWeekSaturation[]>(
      `saturation:${spaceType}`,
      dateRange,
      BUILDING_ID
    );
    if (cached) {
      return NextResponse.json(cached);
    }

    // Fetch metrics in 7-day chunks
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

    const result = computeSaturation(allMetrics, spaces as ChimeSpace[], startHour, endHour);

    // Cache result
    await setCache(`saturation:${spaceType}`, dateRange, BUILDING_ID, result);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error computing saturation:", error);
    return NextResponse.json(
      { error: "Failed to compute saturation" },
      { status: 500 }
    );
  }
}
