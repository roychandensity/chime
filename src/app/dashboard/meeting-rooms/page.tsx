"use client";

import { useSpaces } from "@/hooks/use-spaces";
import { useAvailability } from "@/hooks/use-availability";
import { useGroupSize } from "@/hooks/use-group-size";
import { useFilters } from "@/contexts/filter-context";
import ChimeFilterPanel from "@/components/chime-filter-panel";
import AvailabilityHeatmap from "@/components/charts/availability-heatmap";
import GroupSizeChart from "@/components/charts/group-size-chart";
import { generateAvailabilityNarrative, generateGroupSizeNarrative } from "@/lib/narrative";

export default function MeetingRoomsPage() {
  const { spacesByFunction, floors, isLoading: spacesLoading, error: spacesError } = useSpaces();
  const { filters } = useFilters();

  const { data: availData, error: availError, isLoading: availLoading, analyze: analyzeAvail } = useAvailability();
  const { data: gsData, error: gsError, isLoading: gsLoading, analyze: analyzeGs } = useGroupSize();

  const isLoading = availLoading || gsLoading;

  function handleAnalyze() {
    const rooms = filters.floors.length === 0
      ? spacesByFunction.meeting_room
      : spacesByFunction.meeting_room.filter((s) => filters.floors.includes(s.floor));

    if (rooms.length === 0) return;

    const commonParams = {
      spaces: rooms,
      startDate: filters.startDate,
      endDate: filters.endDate,
    };

    analyzeAvail(commonParams);
    analyzeGs(commonParams);
  }

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

  const error = availError || gsError;

  return (
    <div className="space-y-6">
      <ChimeFilterPanel
        floors={floors}
        onAnalyze={handleAnalyze}
        isLoading={isLoading}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error.message}</p>
        </div>
      )}

      {availData && (
        <AvailabilityHeatmap
          data={availData}
          narratives={generateAvailabilityNarrative(availData)}
        />
      )}

      {gsData && (
        <GroupSizeChart
          data={gsData}
          narratives={generateGroupSizeNarrative(gsData)}
        />
      )}

      {!availData && !gsData && !error && !isLoading && (
        <div className="flex items-center justify-center h-64 bg-white border border-gray-200 rounded-lg">
          <p className="text-gray-400">
            Click Analyze to view meeting room data
          </p>
        </div>
      )}
    </div>
  );
}
