"use client";

import { useState, useRef, useCallback } from "react";
import { useSpaces } from "@/hooks/use-spaces";
import { useSessions } from "@/hooks/use-sessions";
import { useDeskSessions } from "@/hooks/use-desk-sessions";
import { useFilters } from "@/contexts/filter-context";
import ChimeFilterPanel from "@/components/chime-filter-panel";
import DeskOverviewChart from "@/components/charts/desk-overview-chart";
import DistributionChart from "@/components/distribution-chart";
import DeskTable from "@/components/desk-table";
import DeskDetailDrawer from "@/components/desk-detail-drawer";
import { generateDeskNarrative } from "@/lib/narrative";
import type { DeskMetrics } from "@/lib/types";

export default function DeskUsagePage() {
  const { spaces, floors, neighborhoods, workPointTypes, openCloseTypes, deskTypes, isLoading: spacesLoading, error: spacesError } = useSpaces();
  const { filters } = useFilters();
  const { data, error, isLoading: sessionsLoading, analyze } = useSessions();
  const { data: deskData, error: deskError, isLoading: deskLoading, fetch: fetchDesk, reset: resetDesk } = useDeskSessions();
  const [chartGroupBy, setChartGroupBy] = useState<"floor" | "neighborhood">("floor");
  const [selectedDesk, setSelectedDesk] = useState<DeskMetrics | null>(null);
  const lastFiltersRef = useRef(filters);

  function handleAnalyze() {
    lastFiltersRef.current = filters;

    const filteredSpaces = filters.floors.length === 0
      ? spaces
      : spaces.filter((s) => filters.floors.includes(s.floor));

    if (filteredSpaces.length === 0) return;

    analyze({
      space_ids: filteredSpaces.map((s) => s.id),
      start_date: filters.startDate,
      end_date: filters.endDate,
      time_filter: { start_hour: filters.startHour, end_hour: filters.endHour },
      day_of_week_filter: filters.daysOfWeek,
      spaces: filteredSpaces,
    });
  }

  const handleDeskClick = useCallback((desk: DeskMetrics) => {
    const f = lastFiltersRef.current;
    setSelectedDesk(desk);
    resetDesk();
    fetchDesk({
      space_id: desk.space_id,
      start_date: f.startDate,
      end_date: f.endDate,
      time_filter: { start_hour: f.startHour, end_hour: f.endHour },
      day_of_week_filter: f.daysOfWeek,
    });
  }, [fetchDesk, resetDesk]);

  const handleDrawerClose = useCallback(() => {
    setSelectedDesk(null);
  }, []);

  if (spacesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading spaces...</p>
      </div>
    );
  }

  if (spacesError) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-600">{spacesError.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ChimeFilterPanel
        floors={floors}
        onAnalyze={handleAnalyze}
        isLoading={sessionsLoading}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error.message}</p>
        </div>
      )}

      {data && (
        <>
          <DeskOverviewChart
            summary={data.summary}
            narratives={generateDeskNarrative(data.summary)}
          />

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Group by:</span>
            {([
              ["floor", "Floor"],
              ["neighborhood", "Neighborhood"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setChartGroupBy(key)}
                className={`rounded-md px-3 py-1 text-sm ${
                  chartGroupBy === key
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-gray-300 text-gray-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <DistributionChart
            summary={data.summary}
            groupSummary={chartGroupBy === "floor" ? data.floorSummary : data.neighborhoodSummary}
            groupBy={chartGroupBy}
            desks={data.desks}
            title={chartGroupBy === "floor" ? "Desk Usage by Floor" : "Desk Usage by Neighborhood"}
          />

          <DeskTable desks={data.desks} onDeskClick={handleDeskClick} />
        </>
      )}

      {!data && !error && !sessionsLoading && (
        <div className="flex items-center justify-center h-64 bg-white border border-gray-200 rounded-lg">
          <p className="text-gray-400">
            Click Analyze to view desk usage data
          </p>
        </div>
      )}

      {selectedDesk && (
        <DeskDetailDrawer
          desk={selectedDesk}
          data={deskData}
          isLoading={deskLoading}
          error={deskError}
          onClose={handleDrawerClose}
        />
      )}
    </div>
  );
}
