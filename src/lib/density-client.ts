const DENSITY_BASE_URL = "https://api.density.io";

function getToken(): string {
  const token = process.env.DENSITY_API_TOKEN;
  if (!token) throw new Error("DENSITY_API_TOKEN is not set");
  return token;
}

function getHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  };
}

export interface RawDensitySpace {
  id: string;
  name: string;
  space_type?: string | null;
  function?: string | null;
  children_ids?: string[] | null;
  capacity?: number | null;
  labels?: { id?: string; name?: string }[] | null;
}

export async function fetchAllSpaces(): Promise<RawDensitySpace[]> {
  const allSpaces: RawDensitySpace[] = [];
  let nextUrl: string | null = `${DENSITY_BASE_URL}/v3/spaces?page_size=1000`;

  while (nextUrl) {
    const res: Response = await fetch(nextUrl, { headers: getHeaders() });
    if (!res.ok) {
      throw new Error(`Density /v3/spaces failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    const results: RawDensitySpace[] = data.results ?? data;
    allSpaces.push(...results);
    nextUrl = data.next ?? null;
  }

  return allSpaces;
}

export interface RawDensitySession {
  space_id: string;
  start: string;
  end: string;
  /** Sum of individual detection durations (excludes gap time). Set by mergeRawDetections. */
  detected_minutes?: number;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

export async function fetchSessions(
  spaceIds: string[],
  startDate: string,
  endDate: string
): Promise<RawDensitySession[]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
    }

    const res = await fetch(`${DENSITY_BASE_URL}/v3/analytics/sessions/raw`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        space_ids: spaceIds,
        start_date: `${startDate}T00:00:00`,
        end_date: `${endDate}T23:59:59`,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return flattenSessionResponse(data);
    }

    const errorBody = await res.text().catch(() => "");
    lastError = new Error(
      `Density /v3/analytics/sessions/raw failed: ${res.status} ${res.statusText} — ${errorBody}`
    );

    if (res.status < 500) {
      throw lastError;
    }

    console.warn(`Density sessions attempt ${attempt + 1} failed (${res.status}), retrying...`);
  }

  console.error("Density sessions failed after retries:", lastError);
  throw lastError;
}

// The API returns {spaceId: {sessions: [{start_time, end_time}, ...]}, ...}
// Flatten into [{space_id, start, end}, ...]
function flattenSessionResponse(
  data: Record<string, { sessions?: { start_time: string; end_time: string }[] }>
): RawDensitySession[] {
  const sessions: RawDensitySession[] = [];
  for (const [spaceId, entry] of Object.entries(data)) {
    if (!entry.sessions) continue;
    for (const s of entry.sessions) {
      sessions.push({
        space_id: spaceId,
        start: s.start_time,
        end: s.end_time,
      });
    }
  }
  return sessions;
}

// Raw detections from the Density API are individual sensor events (0-90s each).
// Merge consecutive detections for the same desk into continuous sessions
// when the gap between one detection's end and the next's start is under the threshold.
// Sensor gaps of 5-10 min are common during continuous occupancy (person sitting still),
// so the gap must be large enough to keep those together. But 20 min (the previous value)
// fused separate desk visits into mega-sessions, inflating Deep Focus from ~5% to ~17%.
// 10 min balances: keeps continuous presence merged, splits distinct visits apart.
const MERGE_GAP_MS = 10 * 60 * 1000; // 10 minutes
// A merged session must contain at least this many raw detections to be kept.
// Walk-bys produce a single isolated detection; real desk usage produces clusters.
// Lowered from 3 to 2: with the 10-min merge gap, valid short sessions may have
// only 2 detections per merged window. Keeping at 3 drops too many real sessions.
const MIN_DETECTIONS = 2;
const MIN_SESSION_SPAN_MS = 5 * 60 * 1000; // 5 minutes minimum session span

export function mergeRawDetections(
  rawSessions: RawDensitySession[]
): RawDensitySession[] {
  // Group by space_id
  const bySpace = new Map<string, RawDensitySession[]>();
  for (const s of rawSessions) {
    let list = bySpace.get(s.space_id);
    if (!list) {
      list = [];
      bySpace.set(s.space_id, list);
    }
    list.push(s);
  }

  const merged: RawDensitySession[] = [];

  for (const [spaceId, detections] of bySpace) {
    // Sort by start time
    detections.sort((a, b) => a.start.localeCompare(b.start));

    let curStart = detections[0].start;
    let curEnd = detections[0].end;
    let curCount = 1;
    let curDetectedMs =
      new Date(detections[0].end).getTime() - new Date(detections[0].start).getTime();

    for (let i = 1; i < detections.length; i++) {
      const det = detections[i];
      const gapMs =
        new Date(det.start).getTime() - new Date(curEnd).getTime();

      if (gapMs <= MERGE_GAP_MS) {
        // Extend current session
        if (det.end > curEnd) {
          curEnd = det.end;
        }
        curCount++;
        curDetectedMs +=
          new Date(det.end).getTime() - new Date(det.start).getTime();
      } else {
        // Emit current session if it meets quality thresholds
        const spanMs = new Date(curEnd).getTime() - new Date(curStart).getTime();
        if (curCount >= MIN_DETECTIONS && spanMs >= MIN_SESSION_SPAN_MS) {
          merged.push({
            space_id: spaceId,
            start: curStart,
            end: curEnd,
            detected_minutes: curDetectedMs / 60000,
          });
        }
        curStart = det.start;
        curEnd = det.end;
        curCount = 1;
        curDetectedMs =
          new Date(det.end).getTime() - new Date(det.start).getTime();
      }
    }
    // Emit last session if it meets quality thresholds
    const spanMs = new Date(curEnd).getTime() - new Date(curStart).getTime();
    if (curCount >= MIN_DETECTIONS && spanMs >= MIN_SESSION_SPAN_MS) {
      merged.push({
        space_id: spaceId,
        start: curStart,
        end: curEnd,
        detected_minutes: curDetectedMs / 60000,
      });
    }
  }

  return merged;
}

// ── Chime additions: metrics API + date splitting ──

export interface MetricsDataPoint {
  space_id: string;
  timestamp: string;
  occupancy_max?: number;
  occupancy_avg?: number;
  occupancy_min?: number;
  utilization_max?: number;
  utilization_avg?: number;
  entrances?: number;
  exits?: number;
  time_used_raw?: number;
  time_used_percentage?: number;
}

/**
 * Fetch hourly or daily metrics from the Density API.
 *
 * API details:
 * - time_resolution accepts "hour" or "day" (NOT "1h" / "1d")
 * - Dates must include time suffix: "2024-01-01T00:00:00"
 * - No `metrics` parameter needed — all metrics are always returned
 * - Response format: { spaceId: { timestamp: { occupancy_max, ... } } }
 */
export async function fetchMetrics(
  spaceIds: string[],
  startDate: string,
  endDate: string,
  timeResolution: "hour" | "day" = "hour",
): Promise<MetricsDataPoint[]> {
  let lastError: Error | null = null;

  // Ensure dates have time suffix
  const startStr = startDate.includes("T") ? startDate : `${startDate}T00:00:00`;
  const endStr = endDate.includes("T") ? endDate : `${endDate}T23:59:59`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
    }

    const res = await fetch(`${DENSITY_BASE_URL}/v3/analytics/metrics`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        space_ids: spaceIds,
        start_date: startStr,
        end_date: endStr,
        time_resolution: timeResolution,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return flattenMetricsResponse(data);
    }

    const errorBody = await res.text().catch(() => "");
    lastError = new Error(
      `Density /v3/analytics/metrics failed: ${res.status} ${res.statusText} — ${errorBody}`
    );

    if (res.status < 500) {
      throw lastError;
    }

    console.warn(`Density metrics attempt ${attempt + 1} failed (${res.status}), retrying...`);
  }

  console.error("Density metrics failed after retries:", lastError);
  throw lastError!;
}

/**
 * Flatten the nested metrics response into a flat array of data points.
 * Input:  { spaceId: { timestamp: { occupancy_max, occupancy_avg, ... } } }
 * Output: [{ space_id, timestamp, occupancy_max, occupancy_avg, ... }]
 */
function flattenMetricsResponse(
  data: Record<string, Record<string, Record<string, number>>>
): MetricsDataPoint[] {
  const points: MetricsDataPoint[] = [];
  for (const [spaceId, timestamps] of Object.entries(data)) {
    for (const [timestamp, metrics] of Object.entries(timestamps)) {
      points.push({
        space_id: spaceId,
        timestamp,
        occupancy_max: metrics.occupancy_max,
        occupancy_avg: metrics.occupancy_avg,
        occupancy_min: metrics.occupancy_min,
        utilization_max: metrics.utilization_max,
        utilization_avg: metrics.utilization_avg,
        entrances: metrics.entrances,
        exits: metrics.exits,
        time_used_raw: metrics.time_used_raw,
        time_used_percentage: metrics.time_used_percentage,
      });
    }
  }
  return points;
}

/**
 * Split a date range into chunks of maxDays (default 7).
 * The Density API limits hourly resolution queries to 7-day windows.
 */
export function splitDateRange(
  startDate: string,
  endDate: string,
  maxDays = 7
): { start: string; end: string }[] {
  const ranges: { start: string; end: string }[] = [];
  let current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const chunkEnd = new Date(current);
    chunkEnd.setDate(chunkEnd.getDate() + maxDays - 1);
    if (chunkEnd > end) {
      chunkEnd.setTime(end.getTime());
    }

    ranges.push({
      start: current.toISOString().slice(0, 10),
      end: chunkEnd.toISOString().slice(0, 10),
    });

    current = new Date(chunkEnd);
    current.setDate(current.getDate() + 1);
  }

  return ranges;
}

const METRICS_CONCURRENCY = 3;

/**
 * Fetch hourly metrics across a date range, splitting into 7-day chunks
 * and fetching up to METRICS_CONCURRENCY chunks in parallel.
 */
export async function fetchMetricsParallel(
  spaceIds: string[],
  startDate: string,
  endDate: string,
  timeResolution: "hour" | "day" = "hour",
): Promise<MetricsDataPoint[]> {
  const ranges = splitDateRange(startDate, endDate);
  const allMetrics: MetricsDataPoint[][] = [];

  for (let i = 0; i < ranges.length; i += METRICS_CONCURRENCY) {
    const batch = ranges.slice(i, i + METRICS_CONCURRENCY);
    const results = await Promise.all(
      batch.map((range) => fetchMetrics(spaceIds, range.start, range.end, timeResolution))
    );
    allMetrics.push(...results);
  }

  return allMetrics.flat();
}
