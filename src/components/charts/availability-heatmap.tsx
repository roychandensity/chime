"use client";

import { useRef } from "react";
import type { AvailabilityHeatmapData, NarrativeInsight } from "@/lib/types";
import DownloadButton from "@/components/download-button";

interface AvailabilityHeatmapProps {
  data: AvailabilityHeatmapData;
  narratives?: NarrativeInsight[];
}

function saturationColor(pct: number): string {
  // Gradient from light blue (low saturation) to dark blue (high saturation)
  const t = Math.min(pct / 100, 1);
  const r = Math.round(232 - t * 206);
  const g = Math.round(240 - t * 154);
  const b = Math.round(254 - t * 35);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function AvailabilityHeatmap({ data, narratives }: AvailabilityHeatmapProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  if (data.floors.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-400">
        No availability data available
      </div>
    );
  }

  return (
    <div ref={chartRef} className="relative bg-white border border-gray-200 rounded-lg p-6">
      <DownloadButton targetRef={chartRef} filename="availability-heatmap" />

      <h3 className="text-base font-semibold text-gray-800 mb-1">
        Meeting Room Availability (Peak Hours)
      </h3>
      {narratives && narratives.length > 0 && (
        <p className="text-sm text-gray-500 mb-4">{narratives[0].text}</p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-200">
                Floor
              </th>
              {data.daysOfWeek.map((dow) => (
                <th
                  key={dow.dayOfWeek}
                  className="text-center px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-200"
                >
                  {dow.dayLabel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.floors.map((floor) => (
              <tr key={floor}>
                <td className="px-3 py-2 text-xs font-medium text-gray-700 border-b border-gray-100 whitespace-nowrap">
                  {floor}
                </td>
                {data.daysOfWeek.map((dow) => {
                  const cell = data.matrix[floor]?.[dow.dayOfWeek];
                  if (!cell) return <td key={dow.dayOfWeek} className="border-b border-gray-100" />;

                  return (
                    <td
                      key={dow.dayOfWeek}
                      className="text-center px-3 py-2 border-b border-gray-100"
                      style={{ backgroundColor: saturationColor(cell.saturationPercent) }}
                    >
                      <span className="text-xs font-medium" style={{ color: cell.saturationPercent > 60 ? "#fff" : "#374151" }}>
                        {cell.available} / {cell.total}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
        <span>Low saturation</span>
        <div className="flex h-3">
          {[0, 20, 40, 60, 80, 100].map((pct) => (
            <div
              key={pct}
              className="w-6 h-3"
              style={{ backgroundColor: saturationColor(pct) }}
            />
          ))}
        </div>
        <span>High saturation</span>
      </div>

      <div className="mt-2 text-xs text-gray-400">
        Each cell shows available / total rooms during peak hours (10AM-11AM, 2PM-3PM).
      </div>
    </div>
  );
}
