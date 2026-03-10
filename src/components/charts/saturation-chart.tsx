"use client";

import { useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { DayOfWeekSaturation, NarrativeInsight } from "@/lib/types";
import { CHIME_COLORS } from "@/lib/colors";
import DownloadButton from "@/components/download-button";

interface SaturationChartProps {
  meetingRoomData?: DayOfWeekSaturation[];
  deskData?: DayOfWeekSaturation[];
  openCollabData?: DayOfWeekSaturation[];
  narratives?: NarrativeInsight[];
  title?: string;
  metadata?: { location?: string; floors?: string; dateRange?: string };
}

function formatHour(hour: number): string {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h}${ampm}`;
}

export default function SaturationChart({
  meetingRoomData,
  deskData,
  openCollabData,
  narratives,
  title = "Space Saturation by Day of Week",
  metadata,
}: SaturationChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  // Use whichever data is provided to determine day panels
  const dayPanels = meetingRoomData ?? deskData ?? openCollabData ?? [];

  if (dayPanels.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-400">
        No saturation data available
      </div>
    );
  }

  // Build merged data for each day
  const panels = dayPanels.map((day, idx) => {
    const mrDay = meetingRoomData?.[idx];
    const dkDay = deskData?.[idx];
    const ocDay = openCollabData?.[idx];

    const chartData = day.series.map((pt) => ({
      hour: pt.hour,
      hourLabel: formatHour(pt.hour),
      meetingRoom: mrDay?.series.find((s) => s.hour === pt.hour)?.saturationPercent,
      desk: dkDay?.series.find((s) => s.hour === pt.hour)?.saturationPercent,
      openCollab: ocDay?.series.find((s) => s.hour === pt.hour)?.saturationPercent,
    }));

    return { dayLabel: day.dayLabel, chartData };
  });

  return (
    <div ref={chartRef} className="relative bg-white border border-gray-200 rounded-lg p-6">
      <DownloadButton targetRef={chartRef} filename="saturation-chart" />

      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-800">{title}</h3>
          {narratives && narratives.length > 0 && (
            <p className="text-sm text-gray-500 mt-1">{narratives[0].text}</p>
          )}
        </div>
        {metadata && (
          <div className="text-xs text-gray-400 text-right">
            {metadata.location && <div>{metadata.location}</div>}
            {metadata.floors && <div>{metadata.floors}</div>}
            {metadata.dateRange && <div>{metadata.dateRange}</div>}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs text-gray-600">
        {meetingRoomData && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: CHIME_COLORS.meetingRoom }} />
            Meeting Rooms
          </div>
        )}
        {deskData && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: CHIME_COLORS.desk }} />
            Desks
          </div>
        )}
        {openCollabData && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: CHIME_COLORS.openCollab }} />
            Open Collab
          </div>
        )}
      </div>

      {/* 5-panel grid */}
      <div className="grid grid-cols-5 gap-3">
        {panels.map(({ dayLabel, chartData }) => (
          <div key={dayLabel}>
            <div className="text-xs font-medium text-gray-600 mb-1 text-center">{dayLabel}</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="hourLabel"
                  tick={{ fontSize: 9 }}
                  tickLine={false}
                  interval={1}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 9 }}
                  tickLine={false}
                  width={30}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(value) => [`${Math.round(value as number)}%`]}
                  labelFormatter={(label) => `${label}`}
                  contentStyle={{ fontSize: 11 }}
                />
                {meetingRoomData && (
                  <Line
                    type="monotone"
                    dataKey="meetingRoom"
                    stroke={CHIME_COLORS.meetingRoom}
                    strokeWidth={2}
                    dot={false}
                    name="Meeting Rooms"
                  />
                )}
                {deskData && (
                  <Line
                    type="monotone"
                    dataKey="desk"
                    stroke={CHIME_COLORS.desk}
                    strokeWidth={2}
                    dot={false}
                    name="Desks"
                  />
                )}
                {openCollabData && (
                  <Line
                    type="monotone"
                    dataKey="openCollab"
                    stroke={CHIME_COLORS.openCollab}
                    strokeWidth={2}
                    dot={false}
                    name="Open Collab"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </div>
  );
}
