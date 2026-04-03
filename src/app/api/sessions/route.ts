import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchSessions, mergeRawDetections, splitDateRange } from "@/lib/density-client";
import { fetchInBatches } from "@/lib/batch";
import { classifyDesks } from "@/lib/classify";
import type { DensitySpace } from "@/lib/types";

const RequestSchema = z.object({
  space_ids: z.array(z.string()).min(1),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_filter: z.object({
    start_hour: z.number().min(0).max(23),
    end_hour: z.number().min(1).max(24),
  }),
  day_of_week_filter: z.array(z.number().min(0).max(6)).min(1),
  spaces: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      floor: z.string(),
      neighborhood: z.string(),
      workPointType: z.string(),
      openClose: z.string(),
      deskType: z.string(),
      capacity: z.number(),
    })
  ),
});

const BATCH_SIZE = 20;
const CONCURRENCY = 3;

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

    const { space_ids, start_date, end_date, time_filter, day_of_week_filter, spaces } =
      parsed.data;

    // Density API limits sessions to 60-day windows; split into chunks
    const dateChunks = splitDateRange(start_date, end_date, 60);
    const chunkResults = await Promise.all(
      dateChunks.map((chunk) =>
        fetchInBatches(space_ids, BATCH_SIZE, CONCURRENCY, (ids) =>
          fetchSessions(ids, chunk.start, chunk.end)
        )
      )
    );
    const rawDetections = chunkResults.flat();

    const mergedSessions = mergeRawDetections(rawDetections);

    const spaceObjects: DensitySpace[] = spaces;

    const result = classifyDesks(
      spaceObjects,
      mergedSessions,
      start_date,
      end_date,
      time_filter,
      day_of_week_filter
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error processing sessions:", error);
    return NextResponse.json(
      { error: "Failed to process sessions" },
      { status: 500 }
    );
  }
}
