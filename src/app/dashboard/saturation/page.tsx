"use client";

import { useSpaces } from "@/hooks/use-spaces";
import { useSaturation } from "@/hooks/use-saturation";
import { useFilters } from "@/contexts/filter-context";
import ChimeFilterPanel from "@/components/chime-filter-panel";
import SaturationChart from "@/components/charts/saturation-chart";
import { generateSaturationNarrative } from "@/lib/narrative";

export default function SaturationPage() {
  const { spacesByFunction, floors, isLoading: spacesLoading, error: spacesError } = useSpaces();
  const { filters } = useFilters();

  const { data: mrData, error: mrError, isLoading: mrLoading, analyze: analyzeMr } = useSaturation("meeting_room");
  const { data: deskData, error: deskError, isLoading: deskLoading, analyze: analyzeDesk } = useSaturation("desk");
  const { data: ocData, error: ocError, isLoading: ocLoading, analyze: analyzeOc } = useSaturation("open_collab");

  const isLoading = mrLoading || deskLoading || ocLoading;

  function handleAnalyze() {
    const filterFloors = (spaces: typeof spacesByFunction.desk) =>
      filters.floors.length === 0 ? spaces : spaces.filter((s) => filters.floors.includes(s.floor));

    const mrSpaces = filterFloors(spacesByFunction.meeting_room);
    const deskSpaces = filterFloors(spacesByFunction.desk);
    const ocSpaces = filterFloors(spacesByFunction.open_collab);

    const commonParams = {
      startDate: filters.startDate,
      endDate: filters.endDate,
      startHour: filters.startHour,
      endHour: filters.endHour,
    };

    if (mrSpaces.length > 0) {
      analyzeMr({ spaceType: "meeting_room", spaces: mrSpaces, ...commonParams });
    }
    if (deskSpaces.length > 0) {
      analyzeDesk({ spaceType: "desk", spaces: deskSpaces, ...commonParams });
    }
    if (ocSpaces.length > 0) {
      analyzeOc({ spaceType: "open_collab", spaces: ocSpaces, ...commonParams });
    }
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

  const mrNarratives = mrData ? generateSaturationNarrative(mrData) : [];
  const error = mrError || deskError || ocError;

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

      {(mrData || deskData) && (
        <SaturationChart
          meetingRoomData={mrData ?? undefined}
          deskData={deskData ?? undefined}
          narratives={mrNarratives}
          title="Meeting Room & Desk Saturation"
          metadata={{
            dateRange: `${filters.startDate} to ${filters.endDate}`,
          }}
        />
      )}

      {ocData && (
        <SaturationChart
          openCollabData={ocData}
          narratives={generateSaturationNarrative(ocData)}
          title="Open Collaboration Space Saturation"
          metadata={{
            dateRange: `${filters.startDate} to ${filters.endDate}`,
          }}
        />
      )}

      {!mrData && !deskData && !ocData && !error && !isLoading && (
        <div className="flex items-center justify-center h-64 bg-white border border-gray-200 rounded-lg">
          <p className="text-gray-400">
            Click Analyze to view saturation data
          </p>
        </div>
      )}
    </div>
  );
}
