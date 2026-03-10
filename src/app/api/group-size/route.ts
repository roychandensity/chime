import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchMetrics, splitDateRange } from "@/lib/density-client";
import { computeGroupSize } from "@/lib/compute-group-size";
import { getCached, setCache } from "@/lib/cache";
import type { ChimeSpace, GroupSizeChartData } from "@/lib/types";

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

    const { spaces, startDate, endDate } = parsed.data;
    const dateRange = `${startDate}_${endDate}`;

    const cached = await getCached<GroupSizeChartData>(
      "group_size",
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

    const result = computeGroupSize(allMetrics, spaces as ChimeSpace[]);

    await setCache("group_size", dateRange, BUILDING_ID, result);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error computing group size:", error);
    return NextResponse.json(
      { error: "Failed to compute group size" },
      { status: 500 }
    );
  }
}
