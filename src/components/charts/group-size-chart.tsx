"use client";

import { useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import type { GroupSizeChartData, GroupSizeBucket, NarrativeInsight } from "@/lib/types";
import { GROUP_SIZE_COLORS } from "@/lib/colors";
import DownloadButton from "@/components/download-button";

const BUCKETS: GroupSizeBucket[] = ["1", "2", "3-5", "6-9", "10+"];

const BUCKET_LABELS: Record<GroupSizeBucket, string> = {
  "1": "1 person",
  "2": "2 people",
  "3-5": "3-5 people",
  "6-9": "6-9 people",
  "10+": "10+ people",
};

interface GroupSizeChartProps {
  data: GroupSizeChartData;
  narratives?: NarrativeInsight[];
}

export default function GroupSizeChart({ data, narratives }: GroupSizeChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  const chartData = [data.overall, ...data.byFloor].map((dist) => ({
    name: dist.label,
    ...dist.buckets,
  }));

  return (
    <div ref={chartRef} className="relative bg-white border border-gray-200 rounded-lg p-6">
      <DownloadButton targetRef={chartRef} filename="group-size-chart" />

      <h3 className="text-base font-semibold text-gray-800 mb-1">
        Meeting Room Group Size Distribution
      </h3>
      {narratives && narratives.length > 0 && (
        <p className="text-sm text-gray-500 mb-4">{narratives[0].text}</p>
      )}

      <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 50 + 60)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 120 }}>
          <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
          <Tooltip
            formatter={(value, name) => [`${value}%`, BUCKET_LABELS[name as GroupSizeBucket] ?? name]}
            contentStyle={{ fontSize: 11 }}
          />
          <Legend
            formatter={(value: string) => BUCKET_LABELS[value as GroupSizeBucket] ?? value}
            wrapperStyle={{ fontSize: 11 }}
          />
          {BUCKETS.map((bucket) => (
            <Bar key={bucket} dataKey={bucket} stackId="a" fill={GROUP_SIZE_COLORS[bucket]}>
              {chartData.map((_, idx) => (
                <Cell key={idx} fill={GROUP_SIZE_COLORS[bucket]} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
