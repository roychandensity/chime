import type {
  DayOfWeekSaturation,
  AvailabilityHeatmapData,
  GroupSizeChartData,
  CategorySummary,
  NarrativeInsight,
} from "./types";

export function generateSaturationNarrative(
  data: DayOfWeekSaturation[]
): NarrativeInsight[] {
  const insights: NarrativeInsight[] = [];

  // Find peak saturation across all days
  let peakSat = 0;
  let peakDay = "";
  let peakHour = 0;

  for (const day of data) {
    for (const pt of day.series) {
      if (pt.saturationPercent > peakSat) {
        peakSat = pt.saturationPercent;
        peakDay = day.dayLabel;
        peakHour = pt.hour;
      }
    }
  }

  if (peakSat > 0) {
    const ampm = peakHour >= 12 ? "PM" : "AM";
    const h12 = peakHour > 12 ? peakHour - 12 : peakHour === 0 ? 12 : peakHour;
    insights.push({
      key: "peak",
      text: `Peak saturation of ${Math.round(peakSat)}% occurs on ${peakDay} at ${h12}${ampm}.`,
    });
  }

  // Average weekday saturation
  let totalSat = 0;
  let totalPts = 0;
  for (const day of data) {
    for (const pt of day.series) {
      totalSat += pt.saturationPercent;
      totalPts++;
    }
  }
  if (totalPts > 0) {
    insights.push({
      key: "average",
      text: `Average weekday saturation is ${Math.round(totalSat / totalPts)}%.`,
    });
  }

  return insights;
}

export function generateAvailabilityNarrative(
  data: AvailabilityHeatmapData
): NarrativeInsight[] {
  const insights: NarrativeInsight[] = [];

  // Find most/least available floor
  const floorAvg = new Map<string, number>();
  for (const floor of data.floors) {
    let totalSat = 0;
    let count = 0;
    for (const dow of data.daysOfWeek) {
      const cell = data.matrix[floor]?.[dow.dayOfWeek];
      if (cell) {
        totalSat += cell.saturationPercent;
        count++;
      }
    }
    if (count > 0) {
      floorAvg.set(floor, totalSat / count);
    }
  }

  let leastSaturated = "";
  let leastSatVal = 100;
  let mostSaturated = "";
  let mostSatVal = 0;

  for (const [floor, avg] of floorAvg) {
    if (avg < leastSatVal) {
      leastSatVal = avg;
      leastSaturated = floor;
    }
    if (avg > mostSatVal) {
      mostSatVal = avg;
      mostSaturated = floor;
    }
  }

  if (leastSaturated) {
    insights.push({
      key: "mostAvailable",
      text: `${leastSaturated} has the most available meeting rooms (avg ${Math.round(100 - leastSatVal)}% availability).`,
    });
  }
  if (mostSaturated && mostSaturated !== leastSaturated) {
    insights.push({
      key: "leastAvailable",
      text: `${mostSaturated} has the highest demand (avg ${Math.round(mostSatVal)}% saturation).`,
    });
  }

  return insights;
}

export function generateGroupSizeNarrative(
  data: GroupSizeChartData
): NarrativeInsight[] {
  const insights: NarrativeInsight[] = [];
  const { buckets } = data.overall;

  if (buckets["1"] > 0) {
    insights.push({
      key: "singleOccupancy",
      text: `${buckets["1"]}% of occupied meeting room hours have a single person.`,
    });
  }

  // Most common bucket
  let maxPct = 0;
  let maxBucket = "";
  for (const [bucket, pct] of Object.entries(buckets)) {
    if (pct > maxPct) {
      maxPct = pct;
      maxBucket = bucket;
    }
  }
  if (maxBucket) {
    const label = maxBucket === "1" ? "1 person" : maxBucket === "2" ? "2 people" : `${maxBucket} people`;
    insights.push({
      key: "mostCommon",
      text: `Most common group size is ${label} (${maxPct}% of occupied hours).`,
    });
  }

  return insights;
}

export function generateDeskNarrative(
  summary: CategorySummary
): NarrativeInsight[] {
  const insights: NarrativeInsight[] = [];
  const total = summary.total;
  if (total <= 0) return insights;

  const notUsedPct = Math.round((summary["Not Used"] / total) * 100);
  insights.push({
    key: "unused",
    text: `${notUsedPct}% of desks are unused on an average day.`,
  });

  const deepFocusPct = Math.round((summary["Deep Focus"] / total) * 100);
  if (deepFocusPct > 0) {
    insights.push({
      key: "deepFocus",
      text: `${deepFocusPct}% are used for deep focus work (>90 min sessions).`,
    });
  }

  return insights;
}
