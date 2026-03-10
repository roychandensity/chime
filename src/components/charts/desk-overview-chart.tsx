"use client";

import { useRef } from "react";
import type { CategorySummary, DeskCategory, NarrativeInsight } from "@/lib/types";
import { CATEGORY_COLORS } from "@/lib/types";
import DownloadButton from "@/components/download-button";

const CATEGORIES: DeskCategory[] = ["Not Used", "Pit Stop", "In and Out", "Deep Focus"];

const CATEGORY_DESCRIPTIONS: Record<DeskCategory, string> = {
  "Not Used": "No detected activity during the analysis period, or minimal use (<15 min single visit).",
  "Pit Stop": "Brief or occasional visits. Sessions are short (<30 min avg) or infrequent.",
  "In and Out": "Multiple visits per day with moderate session lengths (>30 min avg).",
  "Deep Focus": "Extended individual sessions averaging over 90 minutes.",
};

interface DeskOverviewChartProps {
  summary: CategorySummary;
  narratives?: NarrativeInsight[];
}

export default function DeskOverviewChart({ summary, narratives }: DeskOverviewChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const total = summary["Not Used"] + summary["Pit Stop"] + summary["In and Out"] + summary["Deep Focus"];

  if (total === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-400">
        No desk data available
      </div>
    );
  }

  const segments = CATEGORIES.map((cat) => ({
    category: cat,
    count: summary[cat],
    percent: Math.round((summary[cat] / total) * 100),
  })).filter((s) => s.percent > 0);

  return (
    <div ref={chartRef} className="relative bg-white border border-gray-200 rounded-lg p-6">
      <DownloadButton targetRef={chartRef} filename="desk-overview" />

      <h3 className="text-base font-semibold text-gray-800 mb-1">
        Desk Usage Overview
      </h3>
      {narratives && narratives.length > 0 && (
        <p className="text-sm text-gray-500 mb-4">{narratives[0].text}</p>
      )}

      {/* Stacked bar */}
      <div className="flex w-full rounded overflow-hidden h-10 mb-4">
        {segments.map((seg) => (
          <div
            key={seg.category}
            className="flex items-center justify-center text-white text-xs font-semibold"
            style={{
              width: `${seg.percent}%`,
              backgroundColor: CATEGORY_COLORS[seg.category],
            }}
            title={`${seg.category}: ${seg.percent}%`}
          >
            {seg.percent >= 5 && <span className="truncate px-1">{seg.percent}%</span>}
          </div>
        ))}
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {CATEGORIES.map((cat) => {
          const count = summary[cat];
          const pct = Math.round((count / total) * 100);
          return (
            <div key={cat} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                />
                <span className="text-sm font-medium text-gray-700">{cat}</span>
              </div>
              <div className="text-xl font-bold text-gray-900">{Math.round(count)}</div>
              <div className="text-xs text-gray-500">{pct}%</div>
              <p className="text-xs text-gray-400 mt-1">{CATEGORY_DESCRIPTIONS[cat]}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
