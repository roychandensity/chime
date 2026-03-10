"use client";

import type { CategorySummary, DeskCategory } from "@/lib/types";
import { CATEGORY_COLORS } from "@/lib/types";

interface SummaryCardsProps {
  summary: CategorySummary;
}

const CATEGORIES: DeskCategory[] = ["Not Used", "Pit Stop", "In and Out", "Deep Focus"];

export default function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {CATEGORIES.map((cat) => {
        const count = summary[cat];
        const pct = summary.total > 0 ? ((count / summary.total) * 100).toFixed(1) : "0";
        const color = CATEGORY_COLORS[cat];

        return (
          <div
            key={cat}
            className="bg-white border border-gray-200 rounded-lg p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm font-medium text-gray-600">{cat}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{Math.round(count)}</div>
            <div className="text-sm text-gray-500">{pct}%</div>
          </div>
        );
      })}
    </div>
  );
}
