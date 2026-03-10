import useSWRMutation from "swr/mutation";
import type { AvailabilityHeatmapData, ChimeSpace } from "@/lib/types";

interface AvailabilityRequest {
  spaces: ChimeSpace[];
  startDate: string;
  endDate: string;
  peakHours?: number[];
}

async function fetchAvailability(
  url: string,
  { arg }: { arg: AvailabilityRequest }
): Promise<AvailabilityHeatmapData> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || "Failed to fetch availability");
  }

  return res.json();
}

export function useAvailability() {
  const { data, error, isMutating, trigger } = useSWRMutation<
    AvailabilityHeatmapData,
    Error,
    string,
    AvailabilityRequest
  >("/api/availability", fetchAvailability);

  return {
    data,
    error,
    isLoading: isMutating,
    analyze: trigger,
  };
}
