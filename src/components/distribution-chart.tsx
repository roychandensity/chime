"use client";

import { useRef, useState } from "react";
import type { DeskCategory, CategorySummary, GroupSummary } from "@/lib/types";
import { CATEGORY_COLORS } from "@/lib/types";
import DownloadButton from "@/components/download-button";

const CATEGORIES: DeskCategory[] = ["Not Used", "Pit Stop", "In and Out", "Deep Focus"];

type GroupByKey = "floor" | "neighborhood" | "openClose" | "deskType";

const GROUP_LABELS: Record<GroupByKey, string> = {
  floor: "Floor",
  neighborhood: "Neighborhood",
  openClose: "Open/Quiet/Offline",
  deskType: "Desk Type",
};

interface DistributionChartProps {
  summary: CategorySummary;
  groupSummary: GroupSummary;
  groupBy: GroupByKey;
  desks: { floor: string; neighborhood: string }[];
  title?: string;
}

interface BarSegment {
  category: DeskCategory;
  percent: number;
}

function computeSegments(cs: CategorySummary): BarSegment[] {
  const total = cs["Not Used"] + cs["Pit Stop"] + cs["In and Out"] + cs["Deep Focus"];
  if (total === 0) return [];

  return CATEGORIES.map((cat) => ({
    category: cat,
    percent: Math.round((cs[cat] / total) * 100),
  })).filter((s) => s.percent > 0);
}

function StackedBar({ segments, height = 32 }: { segments: BarSegment[]; height?: number }) {
  return (
    <div className="flex w-full rounded overflow-hidden" style={{ height, minHeight: height }}>
      {segments.map((seg) => (
        <div
          key={seg.category}
          className="flex items-center justify-center text-white text-xs font-semibold shrink-0"
          style={{
            width: `${seg.percent}%`,
            minWidth: seg.percent > 0 ? 1 : 0,
            backgroundColor: CATEGORY_COLORS[seg.category],
          }}
          title={`${seg.category}: ${seg.percent}%`}
        >
          {seg.percent >= 5 && (
            <span className="truncate px-1">{seg.percent}%</span>
          )}
        </div>
      ))}
    </div>
  );
}

function LegendRow() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
      {CATEGORIES.map((cat) => (
        <div key={cat} className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-sm inline-block"
            style={{ backgroundColor: CATEGORY_COLORS[cat] }}
          />
          {cat}
        </div>
      ))}
    </div>
  );
}

export default function DistributionChart({
  summary,
  groupSummary,
  groupBy,
  desks,
  title,
}: DistributionChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [maxWidth, setMaxWidth] = useState<string>("");

  const overallSegments = computeSegments(summary);

  const floorToNeighborhoods = new Map<string, Set<string>>();
  for (const d of desks) {
    if (!floorToNeighborhoods.has(d.floor)) {
      floorToNeighborhoods.set(d.floor, new Set());
    }
    floorToNeighborhoods.get(d.floor)!.add(d.neighborhood);
  }

  const groups = Object.entries(groupSummary)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, cs]) => {
      const asSummary: CategorySummary = {
        "Not Used": cs["Not Used"],
        "Pit Stop": cs["Pit Stop"],
        "In and Out": cs["In and Out"],
        "Deep Focus": cs["Deep Focus"],
        total: cs.total,
      };
      const deskCount = cs.total;
      let subtitle: string | undefined;
      let subtitleTooltip: string | undefined;
      if (groupBy === "floor") {
        const neighborhoods = floorToNeighborhoods.get(name);
        if (neighborhoods && neighborhoods.size > 0) {
          const sorted = [...neighborhoods].sort();
          subtitle = `${neighborhoods.size} neighborhood${neighborhoods.size !== 1 ? "s" : ""}`;
          subtitleTooltip = sorted.join(", ");
        }
      }
      return { name, deskCount, subtitle, subtitleTooltip, segments: computeSegments(asSummary) };
    });

  const groupLabel = GROUP_LABELS[groupBy];

  const parsedWidth = parseInt(maxWidth, 10);
  const widthStyle = parsedWidth > 0 ? { maxWidth: parsedWidth } : undefined;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-xs text-gray-500">Chart width (px):</label>
        <input
          type="number"
          value={maxWidth}
          onChange={(e) => setMaxWidth(e.target.value)}
          placeholder="Auto"
          className="w-20 rounded-md border border-gray-300 px-2 py-1 text-xs"
        />
      </div>
      <div ref={chartRef} className="relative bg-white border border-gray-200 rounded-lg p-6 space-y-6" style={widthStyle}>
        <DownloadButton targetRef={chartRef} filename={`distribution-by-${groupBy}`} />

        <div>
          <h3 className="text-base font-semibold text-gray-800 mb-3">
            {title ?? "Overall Distribution"}
          </h3>
          <StackedBar segments={overallSegments} height={36} />
          <div className="mt-2">
            <LegendRow />
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold text-gray-800 mb-3">
            Distribution by {groupLabel}
          </h3>
          <div className="space-y-3">
            {groups.map(({ name, deskCount, subtitle, subtitleTooltip, segments }) => (
              <div key={name}>
                <div className="mb-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-gray-700 truncate" title={name}>
                      {name}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {deskCount} desk{deskCount !== 1 ? "s" : ""}
                    </span>
                    {subtitle && (
                      <span className="text-xs text-gray-400 shrink-0" title={subtitleTooltip}>
                        {subtitle}
                      </span>
                    )}
                  </div>
                </div>
                <StackedBar segments={segments} height={28} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
