import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchSessions, mergeRawDetections } from "@/lib/density-client";
import { toLocalTime, isInDayFilter, setTimeOfDay } from "@/lib/session-utils";
import { classifyDesk } from "@/lib/classify";
import { format, eachDayOfInterval, parseISO, getDay, getHours, getMinutes } from "date-fns";
import type { DeskTimelineDay, DeskTimelineSession, DeskCategory } from "@/lib/types";

const RequestSchema = z.object({
  space_id: z.string().min(1),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_filter: z.object({
    start_hour: z.number().min(0).max(23),
    end_hour: z.number().min(1).max(24),
  }),
  day_of_week_filter: z.array(z.number().min(0).max(6)).min(1),
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

    const { space_id, start_date, end_date, time_filter, day_of_week_filter } = parsed.data;

    const rawDetections = await fetchSessions([space_id], start_date, end_date);
    const mergedSessions = mergeRawDetections(rawDetections);

    const allDays = eachDayOfInterval({
      start: parseISO(start_date),
      end: parseISO(end_date),
    }).filter((d) => day_of_week_filter.includes(getDay(d)));

    interface ProcessedSession {
      dateKey: string;
      startHour: number;
      endHour: number;
      durationMinutes: number;
    }

    const processed: ProcessedSession[] = [];
    for (const session of mergedSessions) {
      const localStart = toLocalTime(session.start);
      const localEnd = toLocalTime(session.end);

      if (!isInDayFilter(localStart, day_of_week_filter)) continue;

      const windowStart = setTimeOfDay(localStart, time_filter.start_hour);
      const windowEnd = setTimeOfDay(localStart, time_filter.end_hour);

      const effectiveStart = localStart < windowStart ? windowStart : localStart;
      const effectiveEnd = localEnd > windowEnd ? windowEnd : localEnd;

      if (effectiveStart >= effectiveEnd) continue;

      const durationMinutes = (effectiveEnd.getTime() - effectiveStart.getTime()) / 60000;
      if (durationMinutes <= 0) continue;

      const startHour = getHours(effectiveStart) + getMinutes(effectiveStart) / 60;
      const endHour = getHours(effectiveEnd) + getMinutes(effectiveEnd) / 60;
      const dateKey = format(localStart, "yyyy-MM-dd");

      processed.push({ dateKey, startHour, endHour, durationMinutes });
    }

    const sessionsByDate = new Map<string, ProcessedSession[]>();
    for (const p of processed) {
      let list = sessionsByDate.get(p.dateKey);
      if (!list) {
        list = [];
        sessionsByDate.set(p.dateKey, list);
      }
      list.push(p);
    }

    const days: DeskTimelineDay[] = allDays.map((day) => {
      const dateKey = format(day, "yyyy-MM-dd");
      const daySessions = sessionsByDate.get(dateKey) || [];

      const sessions: DeskTimelineSession[] = daySessions.map((s) => ({
        startHour: Math.round(s.startHour * 100) / 100,
        endHour: Math.round(s.endHour * 100) / 100,
        durationMinutes: Math.round(s.durationMinutes),
      }));

      const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
      const sessCount = sessions.length;
      const avgDuration = sessCount > 0 ? totalMinutes / sessCount : 0;
      const category = classifyDesk(sessCount, sessCount, avgDuration);

      return {
        date: dateKey,
        dayLabel: format(day, "EEE dd MMM"),
        sessions,
        totalMinutes,
        category,
      };
    });

    const activeDays = days.filter((d) => d.sessions.length > 0).length;
    const totalMinutes = days.reduce((sum, d) => sum + d.totalMinutes, 0);
    const totalSessions = days.reduce((sum, d) => sum + d.sessions.length, 0);
    const totalDays = days.length;

    const catCounts: Record<DeskCategory, number> = {
      "Not Used": 0, "Pit Stop": 0, "Deep Focus": 0, "In and Out": 0,
    };
    for (const d of days) catCounts[d.category]++;

    let overallCategory: DeskCategory = "Not Used";
    const activeCatCount = catCounts["Deep Focus"] + catCounts["Pit Stop"] + catCounts["In and Out"];
    if (activeCatCount > 0) {
      let maxCount = 0;
      for (const cat of ["Deep Focus", "Pit Stop", "In and Out"] as DeskCategory[]) {
        if (catCounts[cat] > maxCount) {
          maxCount = catCounts[cat];
          overallCategory = cat;
        }
      }
    }

    return NextResponse.json({
      days,
      summary: {
        totalDays,
        activeDays,
        totalMinutes: Math.round(totalMinutes),
        avgMinutesPerDay: totalDays > 0 ? Math.round((totalMinutes / totalDays) * 10) / 10 : 0,
        totalSessions,
        avgSessionsPerDay: totalDays > 0 ? Math.round((totalSessions / totalDays) * 100) / 100 : 0,
        category: overallCategory,
      },
    });
  } catch (error) {
    console.error("Error processing desk sessions:", error);
    return NextResponse.json(
      { error: "Failed to process desk sessions" },
      { status: 500 }
    );
  }
}
