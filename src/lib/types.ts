// ── Density API base types ──

export interface DensitySpace {
  id: string;
  name: string;
  floor: string;
  neighborhood: string;
  workPointType: string;
  openClose: string;
  deskType: string;
  capacity: number;
}

export interface SpacesResponse {
  spaces: DensitySpace[];
  floors: string[];
  neighborhoods: string[];
  workPointTypes: string[];
  openCloseTypes: string[];
  deskTypes: string[];
}

export interface DensitySession {
  space_id: string;
  start: string;
  end: string;
  duration_seconds: number;
}

export interface TimeFilter {
  start_hour: number;
  end_hour: number;
}

export interface SessionsRequest {
  space_ids: string[];
  start_date: string;
  end_date: string;
  time_filter: TimeFilter;
  day_of_week_filter: number[];
  spaces: DensitySpace[];
}

// ── Desk classification types ──

export type DeskCategory = "Not Used" | "Pit Stop" | "Deep Focus" | "In and Out";

export interface DeskMetrics {
  space_id: string;
  name: string;
  floor: string;
  neighborhood: string;
  workPointType: string;
  openClose: string;
  deskType: string;
  category: DeskCategory;
  total_minutes: number;
  active_days: number;
  avg_minutes_per_day: number;
  avg_sessions_per_day: number;
  avg_session_duration: number;
  total_sessions: number;
}

export interface SessionsResponse {
  desks: DeskMetrics[];
  summary: CategorySummary;
  floorSummary: GroupSummary;
  neighborhoodSummary: GroupSummary;
  openCloseSummary: GroupSummary;
  deskTypeSummary: GroupSummary;
}

export type GroupSummary = Record<string, CategorySummary>;

/** @deprecated Use GroupSummary instead */
export type FloorSummary = GroupSummary;

export interface CategorySummary {
  "Not Used": number;
  "Pit Stop": number;
  "Deep Focus": number;
  "In and Out": number;
  total: number;
}

// Desk session timeline types
export interface DeskSessionsRequest {
  space_id: string;
  start_date: string;
  end_date: string;
  time_filter: TimeFilter;
  day_of_week_filter: number[];
}

export interface DeskTimelineSession {
  startHour: number;
  endHour: number;
  durationMinutes: number;
}

export interface DeskTimelineDay {
  date: string;
  dayLabel: string;
  sessions: DeskTimelineSession[];
  totalMinutes: number;
  category: DeskCategory;
}

export interface DeskSessionsResponse {
  days: DeskTimelineDay[];
  summary: {
    totalDays: number;
    activeDays: number;
    totalMinutes: number;
    avgMinutesPerDay: number;
    totalSessions: number;
    avgSessionsPerDay: number;
    category: DeskCategory;
  };
}

export const CATEGORY_COLORS: Record<DeskCategory, string> = {
  "Not Used": "#c1c6cd",
  "Pit Stop": "#34beab",
  "Deep Focus": "#3b92fd",
  "In and Out": "#fca53a",
};

// ── Chime-specific types ──

export type SpaceFunction = "desk" | "meeting_room" | "open_collab" | "other";

export interface ChimeSpace {
  id: string;
  name: string;
  function: SpaceFunction;
  floor: string;
  capacity: number;
  neighborhood: string;
}

export interface ChimeSpacesResponse {
  spaces: DensitySpace[];
  allSpaces: ChimeSpace[];
  spacesByFunction: Record<SpaceFunction, ChimeSpace[]>;
  floors: string[];
  neighborhoods: string[];
  workPointTypes: string[];
  openCloseTypes: string[];
  deskTypes: string[];
}

export interface SaturationPoint {
  hour: number;
  saturationPercent: number;
}

export interface DayOfWeekSaturation {
  dayOfWeek: number;
  dayLabel: string;
  series: SaturationPoint[];
}

export interface AvailabilityCell {
  available: number;
  total: number;
  saturationPercent: number;
}

export interface AvailabilityHeatmapData {
  floors: string[];
  daysOfWeek: { dayOfWeek: number; dayLabel: string }[];
  matrix: Record<string, Record<number, AvailabilityCell>>;
}

export type GroupSizeBucket = "1" | "2" | "3-5" | "6-9" | "10+";

export interface GroupSizeDistribution {
  label: string;
  buckets: Record<GroupSizeBucket, number>;
}

export interface GroupSizeChartData {
  overall: GroupSizeDistribution;
  byFloor: GroupSizeDistribution[];
}

export interface ChimeFilters {
  startDate: string;
  endDate: string;
  floors: string[];
  startHour: number;
  endHour: number;
  daysOfWeek: number[];
}

export interface NarrativeInsight {
  key: string;
  text: string;
}
