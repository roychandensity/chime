import { toZonedTime } from "date-fns-tz";
import {
  getDay,
  getHours,
  getMinutes,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
  eachDayOfInterval,
  parseISO,
} from "date-fns";
import type { TimeFilter } from "./types";

const TZ = process.env.TIMEZONE ?? "America/Los_Angeles";

export function toLocalTime(utcDateStr: string): Date {
  return toZonedTime(parseISO(utcDateStr), TZ);
}

/** @deprecated Use toLocalTime instead */
export function toDublinTime(utcDateStr: string): Date {
  return toLocalTime(utcDateStr);
}

export function isInDayFilter(date: Date, allowedDays: number[]): boolean {
  return allowedDays.includes(getDay(date));
}

export function setTimeOfDay(date: Date, hour: number, minute = 0): Date {
  return setMilliseconds(setSeconds(setMinutes(setHours(date, hour), minute), 0), 0);
}

export interface ClippedSession {
  date: Date;
  durationMinutes: number;
}

export function clipSessionToWindow(
  startUtc: string,
  endUtc: string,
  timeFilter: TimeFilter,
  allowedDays: number[]
): ClippedSession | null {
  const localStart = toLocalTime(startUtc);
  const localEnd = toLocalTime(endUtc);

  if (!isInDayFilter(localStart, allowedDays)) return null;

  const windowStart = setTimeOfDay(localStart, timeFilter.start_hour);
  const windowEnd = setTimeOfDay(localStart, timeFilter.end_hour);

  const effectiveStart = localStart < windowStart ? windowStart : localStart;
  const effectiveEnd = localEnd > windowEnd ? windowEnd : localEnd;

  if (effectiveStart >= effectiveEnd) return null;

  const durationMinutes =
    (effectiveEnd.getTime() - effectiveStart.getTime()) / 60000;
  if (durationMinutes <= 0) return null;

  return { date: localStart, durationMinutes };
}

export function countDaysInRange(
  startDate: string,
  endDate: string,
  allowedDays: number[]
): number {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const days = eachDayOfInterval({ start, end });
  return days.filter((d) => allowedDays.includes(getDay(d))).length;
}

export function formatLocalTime(date: Date): string {
  const h = getHours(date);
  const m = getMinutes(date);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/** @deprecated Use formatLocalTime instead */
export function formatDublinTime(date: Date): string {
  return formatLocalTime(date);
}
